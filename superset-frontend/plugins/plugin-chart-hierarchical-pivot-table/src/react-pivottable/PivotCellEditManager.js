
import axios from 'axios';
import { notification } from 'antd';
import { flatKey } from './utilities';
import { transformPayload } from '../utils/payloadTransform';

export class PivotCellEditManager {
  constructor(
    rows,
    cols,
    data,
    aggregatorName,
    metrics,
    backendApiUrl,
    editableMetrics,
    datasource,
    notificationInstance,
    cellEditPayloadMapping,
  ) {
    this.modifications = new Map();
    this.changeListeners = new Set();
    this.rows = rows;
    this.cols = cols;
    this.data = data;
    this.aggregatorName = aggregatorName;
    this.metrics = metrics;
    this.backendApiUrl = backendApiUrl;
    this.editableMetrics = editableMetrics;
    this.datasource = datasource;
    this.notification = notificationInstance || notification;
    this.cellEditPayloadMapping = cellEditPayloadMapping;
  }

  addChangeListener = listener => {
    this.changeListeners.add(listener);
  };

  removeChangeListener = listener => {
    this.changeListeners.delete(listener);
  };

  notifyChange = () => {
    this.changeListeners.forEach(listener => listener());
  };

  getCellKey = (rowKey, colKey) => {
    return `${flatKey(rowKey)}::${flatKey(colKey)}`;
  };

  getValue = (rowKey, colKey, originalValue) => {
    const cellKey = this.getCellKey(rowKey, colKey);
    const modification = this.modifications.get(cellKey);
    return modification ? modification.current : originalValue;
  };

  setValue = (rowKey, colKey, originalValue, newValue) => {
    const getOriginalMetricName = displayLabel => {
      const metric = this.metrics.find(m => {
        if (typeof m === 'string') {
          return m === displayLabel;
        }
        // Assuming AdhocMetric has a 'label' and potentially 'column.column_name'
        return m.label === displayLabel;
      });
      // Return the original datasource column name if available, otherwise the metric string or label
      if (metric && typeof metric !== 'string' && metric.column?.column_name) {
        return metric.column.column_name;
      }
      return typeof metric === 'string' ? metric : metric?.label;
    };

    const cellKey = this.getCellKey(rowKey, colKey);

    let metricName = this.aggregatorName; // Default to aggregator name

    // Check if 'Metric' is part of rowKey or colKey and get the actual metric name
    const metricInRowKey = this.rows.includes('Metric');
    const metricInColKey = this.cols.includes('Metric');

    if (metricInRowKey) {
      const metricIndex = this.rows.indexOf('Metric');
      const metricDisplayLabel = rowKey[metricIndex]; // Assuming next element is the metric display label
      metricName = getOriginalMetricName(metricDisplayLabel) || metricName;
    } else if (metricInColKey) {
      const metricIndex = this.cols.indexOf('Metric');
      const metricDisplayLabel = colKey[metricIndex]; // Assuming next element is the metric display label
      metricName = getOriginalMetricName(metricDisplayLabel) || metricName;
    }

    if (newValue === originalValue) {
      // Remove modification if value equals original
      this.modifications.delete(cellKey);
    } else {
      this.modifications.set(cellKey, {
        original: originalValue,
        current: newValue,
        timestamp: Date.now(),
        rowKey,
        colKey,
        rowDimensions: this.rows,
        columnDimensions: this.cols,
        metric: metricName,
      });
    }

    this.notifyChange();
  };

  isModified = (rowKey, colKey) => {
    const cellKey = this.getCellKey(rowKey, colKey);
    return this.modifications.has(cellKey);
  };

  getModifications = () => {
    const payloadData = [];
    const processedDimensions = new Map();

    this.modifications.forEach(mod => {
      const dimensions = {};
      mod.rowKey.forEach((key, index) => {
        if (this.rows[index] && this.rows[index] !== 'Metric') {
          dimensions[this.rows[index]] = key;
        }
      });
      mod.colKey.forEach((key, index) => {
        if (this.cols[index] && this.cols[index] !== 'Metric') {
          dimensions[this.cols[index]] = key;
        }
      });

      const measures = { [mod.metric]: mod.current };

      // Create a unique key for the dimensions to check for existing entries
      const dimensionsKey = JSON.stringify(dimensions);

      if (processedDimensions.has(dimensionsKey)) {
        // If dimensions already exist, merge measures
        const existingEntry = processedDimensions.get(dimensionsKey);
        existingEntry.measures = { ...existingEntry.measures, ...measures };
      } else {
        // Otherwise, add a new entry
        const newEntry = { dimensions, measures };
        payloadData.push(newEntry);
        processedDimensions.set(dimensionsKey, newEntry);
      }
    });

    return {
      data: payloadData,
      datasource: this.datasource,
    };
  };

  clearModifications = () => {
    this.modifications.clear();
    this.notifyChange();
  };

  getModificationCount = () => {
    return this.modifications.size;
  };

  sendModifications = async () => {
    const backendApiUrl = this.backendApiUrl?.trim();

    if (!backendApiUrl) {
      console.warn(
        'Backend URL is not configured. Modifications will not be sent.',
      );
      return;
    }

    if (this.modifications.size === 0) {
      console.log('No modifications to send.');
      this.notification.info({
        message: 'info',
        description: 'No modifications to send.',
      });
      return;
    }

    let payload = this.getModifications();
    if (this.cellEditPayloadMapping) {
      try {
        const mapping = JSON.parse(this.cellEditPayloadMapping);
        payload = transformPayload(payload, mapping);
      } catch (e) {
        console.error('Error parsing cellEditPayloadMapping:', e);
      }
    }
    console.log('Sending modifications to backend:', payload);


    try {
      const response = await axios.post(backendApiUrl, payload);
      console.log('Modifications sent successfully:', response.data);
      this.notification.success({
        message: 'Success',
        description: 'Modifications sent successfully.',
      });
      // Do NOT clear modifications here.
      // We wait for the parent component to trigger a data refresh.
      // When new data arrives, this manager will be re-instantiated (clearing state),
      // and the cell will show the new value from the backend.
      // this.clearModifications();
      return true;
    } catch (error) {
      console.error('Error sending modifications:', error);
      this.notification.error({
        message: 'Error',
        description: `Failed to send modifications: ${error.message}`,
      });
      return false;
    }
  };
}
