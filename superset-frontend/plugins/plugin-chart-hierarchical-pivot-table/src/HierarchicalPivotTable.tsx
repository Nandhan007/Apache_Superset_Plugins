/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  MinusSquareOutlined,
  PlusSquareOutlined,
  TableOutlined,
} from '@ant-design/icons';
import * as AntdIcons from '@ant-design/icons';

const renderIcon = (iconName: string) => {
  const Icon = (AntdIcons as any)[iconName];
  return Icon ? <Icon /> : null;
};
import { Button, notification, Spin } from 'antd';
import {
  AdhocMetric,
  BinaryQueryObjectFilterClause,
  CurrencyFormatter,
  DataRecordValue,
  FeatureFlag,
  getColumnLabel,
  getNumberFormatter,
  getSelectedText,
  isAdhocColumn,
  isFeatureEnabled,
  isPhysicalColumn,
  NumberFormatter,
  SupersetClient,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import buildQuery from './plugin/buildQuery';
import {
  aggregatorTemplates,
  PivotTable,
  sortAs,
  getCustomSortKey,
  naturalSort,
} from './react-pivottable';
import LayoutEditor from './LayoutEditor';
import {
  FilterType,
  MetricsLayoutEnum,
  PivotTableProps,
  DatasourceColumn,
  DatasourceMetric,
  PivotTableStylesProps,
  SelectedFiltersType,
} from './types';
import SupersetDataForm from './components/SupersetDataForm';
import {
  ChartLevelActionConfig,
  RowLevelActionConfig,
  HTMLViewerActionConfig,
} from './types/hierarchy';
import Handlebars from 'handlebars';
import { transformPayload } from './utils/payloadTransform';
import { Modal } from 'antd';

const Styles = styled.div<PivotTableStylesProps>`
  ${({ height, width, margin }) => `
      margin: ${margin}px;
      height: ${height - margin * 2}px;
      width: ${
        typeof width === 'string' ? parseInt(width, 10) : width - margin * 2
      }px;
      
      .ant-spin-nested-loading,
      .ant-spin-container {
        height: 100%;
      }
 `}
`;

const PivotTableWrapper = styled.div`
  height: 100%;
  max-width: inherit;
  overflow: auto;
`;

const METRIC_KEY = t('Metric');
const vals = ['value'];

const StyledPlusSquareOutlined = styled(PlusSquareOutlined)`
  stroke: ${({ theme }) => theme.colorPrimary};
  stroke-width: 16px;
`;

const StyledMinusSquareOutlined = styled(MinusSquareOutlined)`
  stroke: ${({ theme }) => theme.colorPrimary};
  stroke-width: 16px;
`;

const aggregatorsFactory = (formatter: NumberFormatter) => ({
  Count: aggregatorTemplates.count(formatter),
  'Count Unique Values': aggregatorTemplates.countUnique(formatter),
  'List Unique Values': aggregatorTemplates.listUnique(', ', formatter),
  Sum: aggregatorTemplates.sum(formatter),
  Average: aggregatorTemplates.average(formatter),
  Median: aggregatorTemplates.median(formatter),
  'Sample Variance': aggregatorTemplates.var(1, formatter),
  'Sample Standard Deviation': aggregatorTemplates.stdev(1, formatter),
  Minimum: aggregatorTemplates.min(formatter),
  Maximum: aggregatorTemplates.max(formatter),
  First: aggregatorTemplates.first(formatter),
  Last: aggregatorTemplates.last(formatter),
  'Sum as Fraction of Total': aggregatorTemplates.fractionOf(
    aggregatorTemplates.sum(),
    'total',
    formatter,
  ),
  'Sum as Fraction of Rows': aggregatorTemplates.fractionOf(
    aggregatorTemplates.sum(),
    'row',
    formatter,
  ),
  'Sum as Fraction of Columns': aggregatorTemplates.fractionOf(
    aggregatorTemplates.sum(),
    'col',
    formatter,
  ),
  'Count as Fraction of Total': aggregatorTemplates.fractionOf(
    aggregatorTemplates.count(),
    'total',
    formatter,
  ),
  'Count as Fraction of Rows': aggregatorTemplates.fractionOf(
    aggregatorTemplates.count(),
    'row',
    formatter,
  ),
  'Count as Fraction of Columns': aggregatorTemplates.fractionOf(
    aggregatorTemplates.count(),
    'col',
    formatter,
  ),
});

/* If you change this logic, please update the corresponding Python
 * function (https://github.com/apache/superset/blob/master/superset/charts/post_processing.py),
 * or reach out to @betodealmeida.
 */
export default function HierarchicalPivotTable(props: PivotTableProps) {
  const {
    data,
    height,
    width,
    groupbyRows: groupbyRowsRaw,
    groupbyColumns: groupbyColumnsRaw,
    metrics,
    colOrder,
    rowOrder,
    aggregateFunction,
    transposePivot,
    combineMetric,
    rowSubtotalPosition,
    colSubtotalPosition,
    colTotals,
    colSubTotals,
    rowTotals,
    rowSubTotals,
    valueFormat,
    currencyFormat,
    emitCrossFilters,
    setDataMask,
    selectedFilters,
    verboseMap,
    columnFormats,
    currencyFormats,
    metricsLayout,
    metricColorFormatters,
    dateFormatters,
    onContextMenu,
    timeGrainSqla,
    allowRenderHtml,
    backendApiUrl,
    editableMetrics,
    datasource,
    allColumns,
    setControlValue,
    datasourceId,
    datasourceType,
    sliceId,
    rawFormData,
    useCustomSorting,
    isRefreshing,
    hierarchyFields = [],
    chartLevelActions = [],
    rowLevelActions = [],
    excludeOptionFilter = false,
    cellEditPayloadMapping,
    redirectionUrls = [],
    globalRedirectionUrls = [],
    enableLayout,
    htmlViewerActions = [],
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const saveDataRef = useRef<() => Promise<boolean | void> | void>();
  const resetFiltersRef = useRef<() => void>();
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  // State for columns fetched explicitly from API
  const [fetchedColumns, setFetchedColumns] = useState<DatasourceColumn[]>([]);
  const [fetchedMetrics, setFetchedMetrics] = useState<DatasourceMetric[]>([]);

  const allAvailableMetrics = useMemo(() => {
    const list = [...fetchedMetrics];
    (metrics || []).forEach((m: any) => {
      const name =
        typeof m === 'string' ? m : m.label || m.metric_name || String(m);
      if (name && !list.some(existing => existing.metric_name === name)) {
        list.push({
          metric_name: name,
          verbose_name:
            typeof m === 'string' ? undefined : m.label || m.verbose_name,
        });
      }
    });

    const rawMetrics = rawFormData?.metrics || [];
    rawMetrics.forEach((m: any) => {
      const name = typeof m === 'string' ? m : m.label || m.metric_name;
      if (name && !list.some(existing => existing.metric_name === name)) {
        list.push({
          metric_name: name,
          verbose_name:
            typeof m === 'string' ? undefined : m.label || m.verbose_name,
        });
      }
    });

    return list;
  }, [fetchedMetrics, metrics, rawFormData?.metrics]);

  // Action Modal State
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<
    ChartLevelActionConfig | RowLevelActionConfig | null
  >(null);
  const [currentRow, setCurrentRow] = useState<Record<string, any> | undefined>(
    undefined,
  );
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [selectedRowData, setSelectedRowData] = useState<
    Map<string, Record<string, any>>
  >(new Map());
  const [editCount, setEditCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // HTML Template Viewer Action State
  const [htmlModalVisible, setHtmlModalVisible] = useState(false);
  const [currentHtmlAction, setCurrentHtmlAction] =
    useState<HTMLViewerActionConfig | null>(null);

  const hasUniqueField = useMemo(
    () =>
      rowLevelActions?.some((action: any) => action.uniqueField) ||
      htmlViewerActions?.some(
        (action: any) => action.onlySelectedRow && action.uniqueField,
      ),
    [rowLevelActions, htmlViewerActions],
  );

  const handleRowSelectionChange = useCallback(
    (rowKey: string, rowData: Record<string, any>, isSelected: boolean) => {
      setSelectedRowData(prev => {
        if (hasUniqueField) {
          const next = new Map();
          if (isSelected) {
            next.set(rowKey, rowData);
          }
          return next;
        }
        const next = new Map(prev);
        if (isSelected) {
          next.set(rowKey, rowData);
        } else {
          next.delete(rowKey);
        }
        return next;
      });
    },
    [hasUniqueField],
  );

  const handleActionClick = (
    action: ChartLevelActionConfig | RowLevelActionConfig,
    rowData?: Record<string, any>,
    rowKey?: string,
  ) => {
    let actionRowData: Record<string, any> | undefined = rowData;

    // If it's a Row Level Action (check prefillFromRow property)
    if ('prefillFromRow' in action && action.prefillFromRow) {
      // If singular row clicked (via row button), use that.
      // If toolbar button clicked (rowData undefined), use selectedRowData.

      if (!rowData) {
        if (selectedRowData.size > 0) {
          // Aggregate data from all selected rows
          const allRows = Array.from(selectedRowData.values());
          const aggregatedData: Record<string, any> = {};

          // Initialize with first row's keys
          const keys = Object.keys(allRows[0]);

          keys.forEach(key => {
            const uniqueValues = Array.from(new Set(allRows.map(r => r[key])));
            // If multiple values, store as array. If single, store as single value.
            // Actually, for SupersetDataForm to render multi-select, we MUST pass as array if we want multi-select.
            // If we pass single value, it might render as single select (depending on our change in SupersetDataForm).
            // Let's pass as Array always if size > 1 OR if we want to force multi-select capable fields.
            // However, existing single-select logic in SupersetDataForm keys off "isArray".
            aggregatedData[key] =
              uniqueValues.length > 1 ? uniqueValues : uniqueValues[0];

            // Edge case: If uniqueValues length is 1 but we still want it to be an array so the form renders as multi-select?
            // If the user selected 1 row, maybe they still want to add more values?
            // But standard behavior is usually: 1 row -> single value. Multiple rows -> multiple values (array).
            // Let's stick to: >1 unique values = Array. 1 value = Scalar.
            // WAIT. If I select 2 rows with SAME Year=2020. uniqueValues is [2020]. Length 1.
            // The form will render as Single Select.
            // If I select 2 rows with Year=2020 and Year=2021. uniqueValues is [2020, 2021]. Form renders as Multi Select.
            // This seems acceptable for now.
          });

          actionRowData = aggregatedData;
        } else {
          // No rows selected. Manual mode.
          actionRowData = {}; // Empty object for manual entry
        }
      }
    }

    setCurrentAction(action);
    setCurrentRow(actionRowData);
    if (rowKey) setActiveRowKey(rowKey);
    setActionModalVisible(true);
  };

  const handleCloseModal = () => {
    setActionModalVisible(false);
    setActiveRowKey(null);
    setSelectedRowData(new Map()); // Clear checkboxes
  };

  const handleHtmlActionClick = (
    action: HTMLViewerActionConfig,
    rowData?: Record<string, any>,
  ) => {
    let actionRowData: Record<string, any> | undefined = rowData;
    if (!rowData) {
      if (selectedRowData.size > 0) {
        const allRows = Array.from(selectedRowData.values());
        const aggregatedData: Record<string, any> = {};
        const keys = Object.keys(allRows[0]);
        keys.forEach(key => {
          const uniqueValues = Array.from(new Set(allRows.map(r => r[key])));
          aggregatedData[key] =
            uniqueValues.length > 1 ? uniqueValues : uniqueValues[0];
        });
        actionRowData = aggregatedData;
      } else {
        actionRowData = {};
      }
    }
    setCurrentRow(actionRowData);
    setCurrentHtmlAction(action);
    setHtmlModalVisible(true);
  };

  const handleTopLevelRedirect = (config: any) => {
    let targetUrl = config.url?.trim() || '';
    const { openInNewTab } = config;

    if (config.uniqueField && selectedRowData.size > 0) {
      const firstRow = Array.from(selectedRowData.values())[0];
      const uniqueValue = firstRow?.[config.uniqueField];
      if (uniqueValue !== undefined && uniqueValue !== null) {
        const separator = targetUrl.endsWith('/') ? '' : '/';
        targetUrl = `${targetUrl}${separator}${encodeURIComponent(String(uniqueValue))}`;
      }
    }

    const safeBtoa = (str: string) => {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        console.error('Failed to Base64 encode string:', e);
        return str;
      }
    };

    const paramsObj: Record<string, string> = {};

    // 1. Process adhoc_filters from rawFormData (explore page / chart config)
    const adhocFilters = rawFormData?.adhoc_filters || [];
    adhocFilters.forEach((filter: any) => {
      if (
        filter.expressionType === 'SIMPLE' &&
        filter.subject &&
        filter.comparator !== undefined &&
        filter.comparator !== null
      ) {
        paramsObj[filter.subject] = Array.isArray(filter.comparator)
          ? filter.comparator.join(',')
          : String(filter.comparator);
      }
    });

    // 2. Process extra_form_data.adhoc_filters (dashboard adhoc filters)
    const extraAdhocFilters = rawFormData?.extra_form_data?.adhoc_filters || [];
    extraAdhocFilters.forEach((filter: any) => {
      if (
        filter.expressionType === 'SIMPLE' &&
        filter.subject &&
        filter.comparator !== undefined &&
        filter.comparator !== null
      ) {
        paramsObj[filter.subject] = Array.isArray(filter.comparator)
          ? filter.comparator.join(',')
          : String(filter.comparator);
      }
    });

    // 3. Process extra_form_data.filters (dashboard standard filters: array of { col, op, val })
    const extraFilters = rawFormData?.extra_form_data?.filters || [];
    extraFilters.forEach((filter: any) => {
      if (filter.col && filter.val !== undefined && filter.val !== null) {
        paramsObj[filter.col] = Array.isArray(filter.val)
          ? filter.val.join(',')
          : String(filter.val);
      }
    });

    // 4. Process selectedFilters (dashboard cross-filters)
    if (selectedFilters && Object.keys(selectedFilters).length > 0) {
      Object.entries(selectedFilters).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          paramsObj[key] = Array.isArray(val) ? val.join(',') : String(val);
        }
      });
    }

    // 5. Dimension filters are explicitly excluded from top-level redirection

    // Serialize and Base64 encode all collected params into a single query param "params"
    if (Object.keys(paramsObj).length > 0) {
      try {
        const hasProtocol = targetUrl.includes('://');
        const urlToParse = hasProtocol ? targetUrl : `http://${targetUrl}`;
        const urlObj = new URL(urlToParse);

        const jsonStr = JSON.stringify(paramsObj);
        const encodedParams = safeBtoa(jsonStr);
        urlObj.searchParams.set('params', encodedParams);

        targetUrl = hasProtocol
          ? urlObj.toString()
          : urlObj.toString().replace('http://', '');
      } catch (e) {
        console.error('Failed to parse and append params query parameter:', e);
      }
    }

    if (openInNewTab === true) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = targetUrl;
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (!currentAction) return;
    setIsSaving(true);
    try {
      // Add row context if available?
      // The form component handles rowData merging if passed, but here we just send payload.
      // The prompt says "onSubmit handler that sends to configured apiEndpoint".
      // We include user metadata, etc.
      // Note: SupersetClient handles auth headers automatically.

      const endpoint = currentAction.apiEndpoint?.trim() || '';
      const isAbsoluteUrl =
        endpoint.startsWith('http://') || endpoint.startsWith('https://');

      let payload: any = {
        ...formData,
      };

      if (currentAction.payloadMapping) {
        try {
          const mapping = JSON.parse(currentAction.payloadMapping);
          payload = transformPayload(payload, mapping);
        } catch (e) {
          console.error('Error parsing action payloadMapping:', e);
        }
      }

      const containsFile = Object.values(formData).some(
        val =>
          val instanceof File ||
          (Array.isArray(val) && val.some(v => v instanceof File)),
      );

      let requestBody: any = JSON.stringify(payload);
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (containsFile) {
        const formPayload = new FormData();

        // 1. Append files directly to the root of the FormData
        Object.entries(formData).forEach(([key, val]) => {
          if (val instanceof File) {
            formPayload.append(key, val, val.name);
          } else if (Array.isArray(val)) {
            val.forEach(item => {
              if (item instanceof File) {
                formPayload.append(key, item, item.name);
              }
            });
          }
        });

        // 2. Sanitize payload to strip File instances
        const sanitizePayload = (obj: any): any => {
          if (obj instanceof File) {
            return undefined;
          }
          if (Array.isArray(obj)) {
            const cleaned = obj
              .map(sanitizePayload)
              .filter(v => v !== undefined);
            return cleaned.length > 0 ? cleaned : undefined;
          }
          if (obj && typeof obj === 'object') {
            const newObj: Record<string, any> = {};
            Object.entries(obj).forEach(([k, v]) => {
              const sanitized = sanitizePayload(v);
              if (sanitized !== undefined) {
                newObj[k] = sanitized;
              }
            });
            return newObj;
          }
          return obj;
        };

        const cleanPayload = sanitizePayload(payload);

        // 3. Append non-file payload keys
        Object.entries(cleanPayload).forEach(([key, val]) => {
          if (val && typeof val === 'object') {
            formPayload.append(key, JSON.stringify(val));
          } else if (val !== undefined && val !== null) {
            formPayload.append(key, String(val));
          }
        });

        requestBody = formPayload;
        headers = {}; // Let browser define Content-Type with boundary automatically
      }

      if (isAbsoluteUrl) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: requestBody,
        });

        if (!response.ok) {
          throw new Error(`API Request failed with status ${response.status}`);
        }
      } else {
        if (containsFile) {
          await SupersetClient.post({
            endpoint: endpoint,
            body: requestBody,
            headers: { Accept: 'application/json' },
          });
        } else {
          await SupersetClient.post({
            endpoint: endpoint,
            jsonPayload: payload,
          });
        }
      }

      notification.success({
        message: 'Success',
        description: 'Action submitted successfully.',
      });

      setActionModalVisible(false);

      // Trigger refresh
      setTimeout(async () => {
        // Manual Force Refresh to prime the cache with fresh data.
        try {
          const baseQueryContext = buildQuery(rawFormData as any);
          const queryContext = { ...baseQueryContext, force: true };

          await SupersetClient.post({
            endpoint: '/api/v1/chart/data',
            jsonPayload: {
              datasource: { id: datasourceId, type: datasourceType },
              queries: queryContext.queries,
              force: true,
              form_data: rawFormData,
              result_format: 'json',
              result_type: 'full',
            },
          });
        } catch (e) {
          console.error('Force refresh failed', e);
        }

        // Trigger global UI update safely for embedded and normal dashboards
        const store =
          typeof window !== 'undefined' ? (window as any).store : null;
        if (store && store.dispatch && store.getState) {
          // Temporarily inject force=true into window history so all charts synchronously bypass Redis cache
          const currentUrl = new URL(window.location.href);
          let tempForceAdded = false;
          if (!currentUrl.searchParams.has('force')) {
            currentUrl.searchParams.set('force', 'true');
            window.history.replaceState({}, '', currentUrl.toString());
            tempForceAdded = true;
          }

          const state = store.getState();
          if (state.charts) {
            Object.keys(state.charts).forEach(chartIdStr => {
              const chartId = parseInt(chartIdStr, 10);
              if (!isNaN(chartId)) {
                store.dispatch({
                  type: 'TRIGGER_QUERY',
                  value: Date.now(),
                  key: chartId,
                });
              }
            });
          }

          // Clear history cleanly after 3 seconds, ensuring Redux propagates the full lifecycle completely
          if (tempForceAdded) {
            setTimeout(() => {
              const cleanUrl = new URL(window.location.href);
              cleanUrl.searchParams.delete('force');
              window.history.replaceState({}, '', cleanUrl.toString());
            }, 3000);
          }
        } else {
          setDataMask({
            ownState: {
              forceRefresh: Date.now(),
            },
          });
        }
      }, 2000);
    } catch (err: any) {
      console.error('Action submission failed', err);
      notification.error({
        message: 'Error',
        description: err.message || 'Submission failed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    // Always fetch full metadata if possible to ensure we have all dimensions (especially for Dashboard view)
    if (datasourceId && datasourceType) {
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${datasourceId}`,
      })
        .then(({ json }) => {
          const columns =
            json.result?.columns?.map((col: any) => ({
              column_name: col.column_name,
              groupby: col.groupby,
              verbose_name: col.verbose_name,
            })) || [];
          setFetchedColumns(columns);
          const metrics =
            json.result?.metrics?.map((m: any) => ({
              metric_name: m.metric_name,
              verbose_name: m.verbose_name,
              expression: m.expression,
            })) || [];
          setFetchedMetrics(metrics);
        })
        .catch(err => {
          console.error('Failed to fetch datasource metadata', err);
        });
    }
  }, [datasourceId]);

  // Use fetched columns if available, otherwise fall back to props (legacy/explore view behavior)
  const layoutAvailableColumns =
    fetchedColumns.length > 0 ? fetchedColumns : allColumns || [];
  const defaultFormatter = useMemo(
    () =>
      currencyFormat?.symbol
        ? new CurrencyFormatter({
            currency: currencyFormat,
            d3Format: valueFormat,
          })
        : getNumberFormatter(valueFormat),
    [valueFormat, currencyFormat],
  );
  const customFormatsArray = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(columnFormats || {}),
          ...Object.keys(currencyFormats || {}),
        ]),
      ).map(metricName => [
        metricName,
        columnFormats[metricName] || valueFormat,
        currencyFormats[metricName] || currencyFormat,
      ]),
    [columnFormats, currencyFormat, currencyFormats, valueFormat],
  );
  const hasCustomMetricFormatters = customFormatsArray.length > 0;
  const metricFormatters = useMemo(
    () =>
      hasCustomMetricFormatters
        ? {
            [METRIC_KEY]: Object.fromEntries(
              customFormatsArray.map(([metric, d3Format, currency]) => [
                metric,
                currency
                  ? new CurrencyFormatter({
                      currency,
                      d3Format,
                    })
                  : getNumberFormatter(d3Format),
              ]),
            ),
          }
        : undefined,
    [customFormatsArray, hasCustomMetricFormatters],
  );

  const metricNames = useMemo(
    () =>
      metrics.map((metric: string | AdhocMetric) =>
        typeof metric === 'string' ? metric : (metric.label as string),
      ),
    [metrics],
  );

  const enhancedVerboseMap = useMemo(() => {
    const map = { ...verboseMap };
    fetchedMetrics.forEach(m => {
      if (m.verbose_name && m.metric_name) {
        map[m.metric_name] = m.verbose_name;
      }
    });
    fetchedColumns.forEach(c => {
      if (c.verbose_name && c.column_name) {
        map[c.column_name] = c.verbose_name;
      }
    });
    return map;
  }, [verboseMap, fetchedMetrics, fetchedColumns]);

  const unpivotedData = useMemo(
    () =>
      data.reduce(
        (acc: Record<string, any>[], record: Record<string, any>) => [
          ...acc,
          ...metricNames
            .map((name: string) => ({
              ...record,
              [METRIC_KEY]: name,
              value: record[name],
            }))
            .filter(record => record.value !== null),
        ],
        [],
      ),
    [data, metricNames],
  );
  const groupbyRows = useMemo(
    () => groupbyRowsRaw.map(getColumnLabel),
    [groupbyRowsRaw],
  );
  const groupbyColumns = useMemo(
    () => groupbyColumnsRaw.map(getColumnLabel),
    [groupbyColumnsRaw],
  );

  const [layoutRows, setLayoutRows] = useState<string[]>([]);
  const [layoutCols, setLayoutCols] = useState<string[]>([]);
  const [isLayoutEditorVisible, setIsLayoutEditorVisible] = useState(false);

  const sorters = useMemo(() => {
    const metricSorters = { [METRIC_KEY]: sortAs(metricNames) };

    const timeSorters: Record<string, (a: any, b: any) => number> = {};

    // Helper to detect time dimensions
    const isTimeDimension = (name: string) => {
      return /year|month|quarter|half|season|week|day/i.test(
        name.toLowerCase(),
      );
    };

    // 1. Check Hierarchy Fields Configuration
    hierarchyFields.forEach(field => {
      // Determine if we should sort chronologically
      // Priority: Explicit Configuration -> Auto-detection based on name
      let useChrono = false;

      if (field.sortMethod === 'Chronological') {
        useChrono = true;
      } else if (!field.sortMethod || field.sortMethod === 'Default') {
        // Auto-detect if name looks like time dimension
        // User requirement: "If it is related to Time... it must be arranged in chronological order"
        if (
          isTimeDimension(field.fieldLabel) ||
          isTimeDimension(field.columnName)
        ) {
          useChrono = true;
        }
      }

      if (useChrono) {
        // We need to ensure the key matches what React-Pivottable sees as the attribute name.
        // Typically this is the physical column name.
        // However, we also map the verbose name just in case standard Superset labels are used.

        const colDef =
          fetchedColumns.find(c => c.column_name === field.columnName) ||
          (allColumns || []).find(c => c.column_name === field.columnName);
        const verboseName = colDef?.verbose_name;

        // Register for physical name
        timeSorters[field.columnName] = (a, b) => {
          return naturalSort(
            getCustomSortKey(a, true),
            getCustomSortKey(b, true),
          );
        };

        // Register for verbose name if exists
        if (verboseName) {
          timeSorters[verboseName] = timeSorters[field.columnName];
        }

        // Register for field label (from hierarchy config) if different
        if (
          field.fieldLabel &&
          field.fieldLabel !== field.columnName &&
          field.fieldLabel !== verboseName
        ) {
          timeSorters[field.fieldLabel] = timeSorters[field.columnName];
        }
      }
    });

    // 2. Auto-detect time dimensions in active layout columns and rows
    const activeLayoutDimensions = [...layoutRows, ...layoutCols];
    activeLayoutDimensions.forEach(dim => {
      if (isTimeDimension(dim)) {
        timeSorters[dim] = (a, b) => {
          return naturalSort(
            getCustomSortKey(a, true),
            getCustomSortKey(b, true),
          );
        };
      }
    });

    return {
      ...metricSorters,
      ...timeSorters,
    };
  }, [
    metricNames,
    hierarchyFields,
    fetchedColumns,
    allColumns,
    layoutRows,
    layoutCols,
  ]);

  useEffect(() => {
    // Collect all unique columns from the initial query
    const currentRows = groupbyRows;
    const currentCols = groupbyColumns;

    // Initialize state: Configured Rows, Configured Cols
    setLayoutRows(currentRows);
    setLayoutCols(currentCols);
  }, [groupbyRows, groupbyColumns]);

  const [rows, cols] = useMemo(() => {
    let [rows_, cols_] = transposePivot
      ? [layoutCols, layoutRows]
      : [layoutRows, layoutCols];

    if (metricsLayout === MetricsLayoutEnum.ROWS) {
      rows_ = combineMetric ? [...rows_, METRIC_KEY] : [METRIC_KEY, ...rows_];
    } else {
      cols_ = combineMetric ? [...cols_, METRIC_KEY] : [METRIC_KEY, ...cols_];
    }
    return [rows_, cols_];
  }, [combineMetric, layoutCols, layoutRows, metricsLayout, transposePivot]);

  const handleSaveLayout = (newRows: string[], newCols: string[]) => {
    setLayoutRows(newRows);
    setLayoutCols(newCols);
    setIsLayoutEditorVisible(false);

    if (setControlValue) {
      setControlValue('groupbyRows', newRows);
      setControlValue('groupbyColumns', newCols);

      // Trigger execution via ownState change, which ExploreViewContainer observes to call onQuery
      setDataMask({
        ownState: {
          _trigger: Date.now(),
        },
      });

      // Auto-Save: Persist changes to the backend
      if (sliceId && rawFormData) {
        const updatedFormData = {
          ...rawFormData,
          groupbyRows: newRows,
          groupbyColumns: newCols,
        };

        const queryContext = buildQuery(updatedFormData as any);

        SupersetClient.put({
          endpoint: `/api/v1/chart/${sliceId}`,
          jsonPayload: {
            params: JSON.stringify(updatedFormData),
            query_context: JSON.stringify(queryContext),
          },
        })
          .then(() => {
            console.log('Chart layout auto-saved successfully.');
            notification.success({
              message: 'Success',
              description: 'Chart layout saved successfully.',
            });
          })
          .catch(err => {
            console.error('Failed to auto-save chart layout:', err);
            notification.error({
              message: 'Error',
              description: 'Unable to save layout changes. Please try again.',
            });
          });
      }
    } else {
      // Fallback or standard update
      setDataMask({
        ownState: {
          groupbyRows: newRows,
          groupbyColumns: newCols,
          forceRefresh: Date.now(),
        },
        extraFormData: {
          custom_form_data: {
            force_refresh: Date.now(),
          },
        },
      });
    }
  };

  const handleChange = useCallback(
    (filters: SelectedFiltersType) => {
      const filterKeys = Object.keys(filters);
      const groupby = [...groupbyRowsRaw, ...groupbyColumnsRaw];
      setDataMask({
        extraFormData: {
          filters:
            filterKeys.length === 0
              ? undefined
              : filterKeys.map(key => {
                  const val = filters?.[key];
                  const col =
                    groupby.find(item => {
                      if (isPhysicalColumn(item)) {
                        return item === key;
                      }
                      if (isAdhocColumn(item)) {
                        return item.label === key;
                      }
                      return false;
                    }) ?? '';
                  if (val === null || val === undefined)
                    return {
                      col,
                      op: 'IS NULL',
                    };
                  return {
                    col,
                    op: 'IN',
                    val: val as (string | number | boolean)[],
                  };
                }),
        },
        filterState: {
          value:
            filters && Object.keys(filters).length
              ? Object.values(filters)
              : null,
          selectedFilters:
            filters && Object.keys(filters).length ? filters : null,
        },
      });
    },
    [groupbyColumnsRaw, groupbyRowsRaw, setDataMask],
  );

  const getCrossFilterDataMask = useCallback(
    (value: { [key: string]: string }) => {
      const isActiveFilterValue = (key: string, val: DataRecordValue) =>
        !!selectedFilters && selectedFilters[key]?.includes(val);

      if (!value) {
        return undefined;
      }

      const [key, val] = Object.entries(value)[0];
      let values = { ...selectedFilters };
      if (isActiveFilterValue(key, val)) {
        values = {};
      } else {
        values = { [key]: [val] };
      }

      const filterKeys = Object.keys(values);
      const groupby = [...groupbyRowsRaw, ...groupbyColumnsRaw];
      return {
        dataMask: {
          extraFormData: {
            filters:
              filterKeys.length === 0
                ? undefined
                : filterKeys.map(key => {
                    const val = values?.[key];
                    const col =
                      groupby.find(item => {
                        if (isPhysicalColumn(item)) {
                          return item === key;
                        }
                        if (isAdhocColumn(item)) {
                          return item.label === key;
                        }
                        return false;
                      }) ?? '';
                    if (val === null || val === undefined)
                      return {
                        col,
                        op: 'IS NULL' as const,
                      };
                    return {
                      col,
                      op: 'IN' as const,
                      val: val as (string | number | boolean)[],
                    };
                  }),
          },
          filterState: {
            value:
              values && Object.keys(values).length
                ? Object.values(values)
                : null,
            selectedFilters:
              values && Object.keys(values).length ? values : null,
          },
        },
        isCurrentValueSelected: isActiveFilterValue(key, val),
      };
    },
    [groupbyColumnsRaw, groupbyRowsRaw, selectedFilters],
  );

  const toggleFilter = useCallback(
    (
      e: MouseEvent,
      value: string,
      filters: FilterType,
      pivotData: Record<string, any>,
      isSubtotal: boolean,
      isGrandTotal: boolean,
    ) => {
      if (isSubtotal || isGrandTotal || !emitCrossFilters) {
        return;
      }

      // allow selecting text in a cell
      if (getSelectedText()) {
        return;
      }

      const isActiveFilterValue = (key: string, val: DataRecordValue) =>
        !!selectedFilters && selectedFilters[key]?.includes(val);

      const filtersCopy = { ...filters };
      delete filtersCopy[METRIC_KEY];

      const filtersEntries = Object.entries(filtersCopy);
      if (filtersEntries.length === 0) {
        return;
      }

      const [key, val] = filtersEntries[filtersEntries.length - 1];

      let updatedFilters = { ...(selectedFilters || {}) };
      // multi select
      // if (selectedFilters && isActiveFilterValue(key, val)) {
      //   updatedFilters[key] = selectedFilters[key].filter((x: DataRecordValue) => x !== val);
      // } else {
      //   updatedFilters[key] = [...(selectedFilters?.[key] || []), val];
      // }
      // single select
      if (selectedFilters && isActiveFilterValue(key, val)) {
        updatedFilters = {};
      } else {
        updatedFilters = {
          [key]: [val],
        };
      }
      if (
        Array.isArray(updatedFilters[key]) &&
        updatedFilters[key].length === 0
      ) {
        delete updatedFilters[key];
      }
      handleChange(updatedFilters);
    },
    [emitCrossFilters, selectedFilters, handleChange],
  );

  const tableOptions = useMemo(
    () => ({
      clickRowHeaderCallback: toggleFilter,
      clickColumnHeaderCallback: toggleFilter,
      colTotals,
      colSubTotals,
      rowTotals,
      rowSubTotals,
      highlightHeaderCellsOnHover:
        emitCrossFilters ||
        isFeatureEnabled(FeatureFlag.DrillBy) ||
        isFeatureEnabled(FeatureFlag.DrillToDetail),
      highlightedHeaderCells: selectedFilters,
      omittedHighlightHeaderGroups: [METRIC_KEY],
      cellColorFormatters: { [METRIC_KEY]: metricColorFormatters },
      dateFormatters,
      rowLevelActions,
      htmlViewerActions,
      activeRowKey,
      activeAction: currentAction,
      onRowAction: handleActionClick,
    }),
    [
      colTotals,
      colSubTotals,
      dateFormatters,
      emitCrossFilters,
      metricColorFormatters,
      rowTotals,
      rowSubTotals,
      selectedFilters,
      toggleFilter,
      rowLevelActions,
      htmlViewerActions,
      currentAction,
      activeRowKey,
    ],
  );

  const subtotalOptions = useMemo(
    () => ({
      colSubtotalDisplay: { displayOnTop: colSubtotalPosition },
      rowSubtotalDisplay: { displayOnTop: rowSubtotalPosition },
      arrowCollapsed: <StyledPlusSquareOutlined />,
      arrowExpanded: <StyledMinusSquareOutlined />,
    }),
    [colSubtotalPosition, rowSubtotalPosition],
  );

  const handleContextMenu = useCallback(
    (
      e: MouseEvent,
      colKey: (string | number | boolean)[] | undefined,
      rowKey: (string | number | boolean)[] | undefined,
      dataPoint: { [key: string]: string },
    ) => {
      if (onContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        if (colKey && colKey.length > 1) {
          colKey.forEach((val, i) => {
            const col = cols[i];
            const formatter = dateFormatters[col];
            const formattedVal = formatter?.(val as number) || String(val);
            if (i > 0) {
              drillToDetailFilters.push({
                col,
                op: '==',
                val,
                formattedVal,
                grain: formatter ? timeGrainSqla : undefined,
              });
            }
          });
        }
        if (rowKey) {
          rowKey.forEach((val, i) => {
            const col = rows[i];
            const formatter = dateFormatters[col];
            const formattedVal = formatter?.(val as number) || String(val);
            drillToDetailFilters.push({
              col,
              op: '==',
              val,
              formattedVal,
              grain: formatter ? timeGrainSqla : undefined,
            });
          });
        }
        onContextMenu(e.clientX, e.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: getCrossFilterDataMask(dataPoint),
          drillBy: dataPoint && {
            filters: [
              {
                col: Object.keys(dataPoint)[0],
                op: '==',
                val: Object.values(dataPoint)[0],
              },
            ],
            groupbyFieldName: rowKey ? 'groupbyRows' : 'groupbyColumns',
          },
        });
      }
    },
    [
      cols,
      dateFormatters,
      getCrossFilterDataMask,
      onContextMenu,
      rows,
      timeGrainSqla,
    ],
  );

  return (
    <Styles height={height} width={width} margin={theme.sizeUnit * 4}>
      <Spin
        spinning={isSaving || isRefreshing}
        tip={isSaving ? t('Saving changes...') : t('Loading...')}
        style={{ height: '100%', width: '100%' }}
      >
        <div
          ref={containerRef}
          style={{
            height: '100%',
            width: '100%',
            paddingTop: '10px',
            position: 'relative',
          }}
        >
          <Modal
            title={currentAction?.modalTitle || 'Action'}
            open={actionModalVisible}
            onCancel={handleCloseModal}
            footer={null}
            destroyOnHidden
          >
            {currentAction && (
              <SupersetDataForm
                hierarchyConfig={hierarchyFields.filter(
                  h =>
                    (
                      ('hierarchyFields' in currentAction &&
                        currentAction.hierarchyFields) ||
                      []
                    ).includes(h.fieldName) ||
                    (
                      ('hierarchyFields' in currentAction &&
                        currentAction.hierarchyFields) ||
                      []
                    ).includes(h.columnName) ||
                    (currentAction.additionalFields || []).some(
                      f =>
                        f.type === 'hierarchy' &&
                        (Array.isArray(f.name)
                          ? f.name.includes(h.fieldName) ||
                            f.name.includes(h.columnName)
                          : f.name === h.fieldName || f.name === h.columnName),
                    ),
                )}
                formFields={[
                  ...('hierarchyFields' in currentAction
                    ? currentAction.hierarchyFields || []
                    : []),
                  ...(currentAction.formFields || []), // Legacy support
                  ...(currentAction.additionalFields || []).flatMap(
                    f => f.name,
                  ),
                ].filter((v, i, a) => a.indexOf(v) === i)} // Unique
                additionalFields={currentAction.additionalFields}
                onSubmit={handleFormSubmit}
                onCancel={handleCloseModal}
                datasourceId={datasourceId ? Number(datasourceId) : 0}
                rowData={currentRow}
                initialValues={currentRow} // Basic prefill if keys match
                data={data}
                excludeOptionFilter={excludeOptionFilter}
              />
            )}
          </Modal>
          {currentHtmlAction && (
            <Modal
              title={currentHtmlAction.modalTitle || 'HTML Viewer'}
              open={htmlModalVisible}
              onCancel={() => {
                setHtmlModalVisible(false);
                setCurrentHtmlAction(null);
              }}
              footer={[
                <Button
                  key="close"
                  type="primary"
                  onClick={() => {
                    setHtmlModalVisible(false);
                    setCurrentHtmlAction(null);
                  }}
                >
                  {t('Close')}
                </Button>,
              ]}
              destroyOnClose
              width="85vw"
              centered
              style={{ maxWidth: '85vw', height: '85vh' }}
              bodyStyle={{ height: 'calc(85vh - 110px)', overflowY: 'auto' }}
            >
              {(() => {
                try {
                  const template = Handlebars.compile(
                    `${currentHtmlAction.handlebarsTemplate}\n<style>${currentHtmlAction.styleTemplate || ''}</style>`,
                  );
                  const templateContext = {
                    data: currentHtmlAction.onlySelectedRow
                      ? Array.from(selectedRowData.values())
                      : props.data || [],
                  };
                  const compiledHtml = template(templateContext);
                  return (
                    <div dangerouslySetInnerHTML={{ __html: compiledHtml }} />
                  );
                } catch (err: any) {
                  return (
                    <pre style={{ color: 'red' }}>
                      {err.message || 'Template compilation error'}
                    </pre>
                  );
                }
              })()}
            </Modal>
          )}
          <div
            className="editable-pivot-table-toolbar"
            style={{
              position: 'absolute',
              top: '-16px',
              right: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {rowLevelActions.map(
              (action: RowLevelActionConfig, index: number) => (
                <Button
                  key={`row-action-${index}`}
                  size="small"
                  icon={renderIcon(action.buttonIcon)}
                  onClick={() => handleActionClick(action)}
                  disabled={selectedRowData.size === 0}
                >
                  {action.buttonLabel}
                </Button>
              ),
            )}
            {chartLevelActions.map(
              (action: ChartLevelActionConfig, index: number) => (
                <Button
                  key={index}
                  size="small"
                  icon={renderIcon(action.buttonIcon)}
                  onClick={() => handleActionClick(action)}
                >
                  {action.buttonLabel}
                </Button>
              ),
            )}
            {htmlViewerActions.map(
              (action: HTMLViewerActionConfig, index: number) => (
                <Button
                  key={`html-viewer-action-${index}`}
                  size="small"
                  icon={renderIcon(action.buttonIcon)}
                  onClick={() => handleHtmlActionClick(action)}
                  disabled={selectedRowData.size === 0}
                >
                  {action.buttonLabel}
                </Button>
              ),
            )}
            {globalRedirectionUrls.map((config: any, index: number) => (
              <Button
                key={`global-redirect-${index}`}
                size="small"
                icon={renderIcon('LinkOutlined')}
                onClick={() => handleTopLevelRedirect(config)}
              >
                {config.label}
              </Button>
            ))}
            {hasActiveFilters && (
              <Button
                size="small"
                className="editable-pivot-table-reset-filters-btn"
                onClick={() => {
                  if (resetFiltersRef.current) resetFiltersRef.current();
                }}
              >
                {t('Clear Filters')}
              </Button>
            )}
            {editCount > 0 && (
              <Button
                size="small"
                className="editable-pivot-table-save-btn"
                loading={isSaving || isRefreshing}
                onClick={async () => {
                  if (saveDataRef.current) {
                    setIsSaving(true);
                    try {
                      const success = await saveDataRef.current();
                      if (success) {
                        // Slight delay to allow the "Success" notification to appear before the refresh cycle
                        // potentially unmounts/re-renders the component context.
                        setTimeout(async () => {
                          try {
                            // Manual Force Refresh: Since setForceQuery hook is unavailable,
                            // we manually call the API with force: true to prime the cache with fresh data.
                            try {
                              const baseQueryContext = buildQuery(
                                rawFormData as any,
                              );
                              const queryContext = {
                                ...baseQueryContext,
                                force: true,
                              };

                              await SupersetClient.post({
                                endpoint: '/api/v1/chart/data',
                                jsonPayload: {
                                  datasource: {
                                    id: datasourceId,
                                    type: datasourceType,
                                  },
                                  queries: queryContext.queries,
                                  force: true,
                                  form_data: rawFormData,
                                  result_format: 'json',
                                  result_type: 'full',
                                },
                              });
                            } catch (e) {
                              console.error('Force refresh failed', e);
                            }

                            // 3. Trigger global UI update safely for embedded and normal dashboards
                            const store =
                              typeof window !== 'undefined'
                                ? (window as any).store
                                : null;
                            if (store && store.dispatch && store.getState) {
                              // Temporarily inject force=true into window history so all charts synchronously bypass Redis cache
                              const currentUrl = new URL(window.location.href);
                              let tempForceAdded = false;
                              if (!currentUrl.searchParams.has('force')) {
                                currentUrl.searchParams.set('force', 'true');
                                window.history.replaceState(
                                  {},
                                  '',
                                  currentUrl.toString(),
                                );
                                tempForceAdded = true;
                              }

                              const state = store.getState();
                              if (state.charts) {
                                Object.keys(state.charts).forEach(
                                  chartIdStr => {
                                    const chartId = parseInt(chartIdStr, 10);
                                    if (!isNaN(chartId)) {
                                      store.dispatch({
                                        type: 'TRIGGER_QUERY',
                                        value: Date.now(),
                                        key: chartId,
                                      });
                                    }
                                  },
                                );
                              }

                              // Clear history cleanly after 3 seconds, ensuring Redux propagates the full lifecycle completely
                              if (tempForceAdded) {
                                setTimeout(() => {
                                  const cleanUrl = new URL(
                                    window.location.href,
                                  );
                                  cleanUrl.searchParams.delete('force');
                                  window.history.replaceState(
                                    {},
                                    '',
                                    cleanUrl.toString(),
                                  );
                                }, 3000);
                              }
                            } else {
                              setDataMask({
                                ownState: {
                                  forceRefresh: Date.now(),
                                },
                              });
                            }
                          } finally {
                            setIsSaving(false);
                          }
                        }, 2000);
                      } else {
                        setIsSaving(false);
                      }
                    } catch (e) {
                      console.error('Failed to save changes', e);
                      setIsSaving(false);
                    }
                  } else {
                    console.warn('Save function not registered yet');
                  }
                }}
                disabled={isSaving}
                type="primary"
              >
                Save
              </Button>
            )}
            {enableLayout && (
              <Button
                size="small"
                onClick={() => setIsLayoutEditorVisible(true)}
                className="editable-pivot-table-layout-btn pivot-editable-table-layout-button"
                icon={<TableOutlined />}
                disabled={isRefreshing}
              >
                Layout
              </Button>
            )}
          </div>
          <LayoutEditor
            visible={isLayoutEditorVisible}
            onCancel={() => setIsLayoutEditorVisible(false)}
            onSave={handleSaveLayout}
            initialRows={layoutRows}
            initialCols={layoutCols}
            allColumns={layoutAvailableColumns}
            initialMetrics={metricNames}
            allMetrics={allAvailableMetrics}
            onSaveMetrics={(newMetrics: string[]) => {
              if (setControlValue) {
                setControlValue('metrics', newMetrics);
              }
            }}
            mountNode={containerRef.current}
          />
          <PivotTableWrapper className="scrollable">
            <PivotTable
              data={unpivotedData}
              rows={rows}
              cols={cols}
              aggregatorsFactory={aggregatorsFactory}
              defaultFormatter={defaultFormatter}
              customFormatters={metricFormatters}
              aggregatorName={aggregateFunction}
              vals={vals}
              colOrder={colOrder}
              rowOrder={rowOrder}
              sorters={sorters}
              tableOptions={tableOptions}
              subtotalOptions={subtotalOptions}
              namesMapping={enhancedVerboseMap}
              onContextMenu={handleContextMenu}
              allowRenderHtml={allowRenderHtml}
              metrics={metrics}
              theme={theme}
              backendApiUrl={backendApiUrl}
              editableMetrics={editableMetrics}
              datasource={datasource}
              onRegisterSave={(
                saveFn: () => Promise<boolean | void> | void,
              ) => {
                saveDataRef.current = saveFn;
              }}
              onRegisterReset={(resetFn: () => void) => {
                resetFiltersRef.current = resetFn;
              }}
              onFilterChange={(filters: any) => {
                setHasActiveFilters(
                  filters &&
                    Object.values(filters).some((v: any) => v && v.length > 0),
                );
              }}
              useCustomSorting={useCustomSorting}
              notification={notification}
              rowLevelActions={rowLevelActions}
              onRowAction={handleActionClick}
              onEditCountChange={setEditCount}
              selectedRowKeys={new Set(selectedRowData.keys())}
              onRowSelectionChange={handleRowSelectionChange}
              hasUniqueField={hasUniqueField}
              cellEditPayloadMapping={cellEditPayloadMapping}
              redirectionUrls={redirectionUrls}
              rawFormData={rawFormData}
              dashboardFilters={selectedFilters}
            />
          </PivotTableWrapper>
        </div>
      </Spin>
    </Styles>
  );
}
