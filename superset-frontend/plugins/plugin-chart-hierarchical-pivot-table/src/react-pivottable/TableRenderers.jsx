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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { safeHtmlSpan } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import PropTypes from 'prop-types';
import { PivotData, flatKey, isColorDark, getCustomSortKey } from './utilities';
import { Styles } from './Styles';
import { css } from '@emotion/react';
import axios from 'axios';
import { Popover, Checkbox, Input, notification, Button, List } from 'antd';
import { FilterOutlined, SearchOutlined, CaretUpOutlined, CaretDownOutlined, MenuOutlined, LinkOutlined } from '@ant-design/icons';
import * as AntdIcons from '@ant-design/icons';

import { FilterPopover } from './FilterPopover';

import { PivotCellEditManager } from './PivotCellEditManager';

const parseLabel = value => {
  if (typeof value === 'string') {
    if (value === 'metric') return t('metric');
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  return String(value);
};

function displayCell(value, allowRenderHtml) {
  if (allowRenderHtml && typeof value === 'string') {
    return safeHtmlSpan(value);
  }
  return parseLabel(value);
}

function displayHeaderCell(
  needToggle,
  ArrowIcon,
  onArrowClick,
  value,
  namesMapping,
  allowRenderHtml,
) {
  const name = namesMapping[value] || value;
  const parsedLabel = parseLabel(name);
  const labelContent =
    allowRenderHtml && typeof parsedLabel === 'string'
      ? safeHtmlSpan(parsedLabel)
      : parsedLabel;
  return needToggle ? (
    <span className="toggle-wrapper">
      <span
        role="button"
        tabIndex="0"
        className="toggle"
        onClick={onArrowClick}
      >
        {ArrowIcon}
      </span>
      <span className="toggle-val">{labelContent}</span>
    </span>
  ) : (
    labelContent
  );
}

const RedirectionMenu = ({
  rowData,
  redirectionUrls,
  dimensionKeys,
  rawFormData,
  dashboardFilters,
}) => {
  const handleRedirect = (config) => {
    let targetUrl = config.url?.trim() || '';
    const { addDimensionsAsParams, openInNewTab } = config;

    const safeBtoa = (str) => {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        console.error('Failed to Base64 encode string:', e);
        return str;
      }
    };

    // Placeholders replacement
    Object.entries(rowData).forEach(([key, val]) => {
      const strVal = val !== null && val !== undefined ? String(val) : '';
      targetUrl = targetUrl.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), encodeURIComponent(strVal));
      targetUrl = targetUrl.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(strVal));
    });

    if (config.uniqueField) {
      const uniqueValue = rowData[config.uniqueField];
      if (uniqueValue !== undefined && uniqueValue !== null) {
        const separator = targetUrl.endsWith('/') ? '' : '/';
        targetUrl = `${targetUrl}${separator}${encodeURIComponent(String(uniqueValue))}`;
      }
    }

    const paramsObj = {};

    // 1. Process adhoc_filters from rawFormData (explore page / chart config)
    const adhocFilters = rawFormData?.adhoc_filters || [];
    adhocFilters.forEach((filter) => {
      if (
        filter.expressionType === 'SIMPLE' &&
        filter.subject &&
        filter.comparator !== undefined &&
        filter.comparator !== null
      ) {
        paramsObj[filter.subject] = Array.isArray(filter.comparator) ? filter.comparator.join(',') : String(filter.comparator);
      }
    });

    // 2. Process extra_form_data.adhoc_filters (dashboard adhoc filters)
    const extraAdhocFilters = rawFormData?.extra_form_data?.adhoc_filters || [];
    extraAdhocFilters.forEach((filter) => {
      if (
        filter.expressionType === 'SIMPLE' &&
        filter.subject &&
        filter.comparator !== undefined &&
        filter.comparator !== null
      ) {
        paramsObj[filter.subject] = Array.isArray(filter.comparator) ? filter.comparator.join(',') : String(filter.comparator);
      }
    });

    // 3. Process extra_form_data.filters (dashboard standard filters: array of { col, op, val })
    const extraFilters = rawFormData?.extra_form_data?.filters || [];
    extraFilters.forEach((filter) => {
      if (filter.col && filter.val !== undefined && filter.val !== null) {
        paramsObj[filter.col] = Array.isArray(filter.val) ? filter.val.join(',') : String(filter.val);
      }
    });

    // 4. Process dashboardFilters (filterState/cross-filters)
    if (dashboardFilters && Object.keys(dashboardFilters).length > 0) {
      Object.entries(dashboardFilters).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          paramsObj[key] = Array.isArray(val) ? val.join(',') : String(val);
        }
      });
    }

    // 5. Append dimensions if checked
    if (addDimensionsAsParams) {
      Object.entries(rowData).forEach(([key, val]) => {
        if (dimensionKeys.has(key) && val !== null && val !== undefined && typeof val !== 'object') {
          paramsObj[key] = String(val);
        }
      });
    }

    // Serialize and Base64 encode all collected params into a single query param "params"
    if (Object.keys(paramsObj).length > 0) {
      try {
        const hasProtocol = targetUrl.includes('://');
        const urlToParse = hasProtocol ? targetUrl : `http://${targetUrl}`;
        const urlObj = new URL(urlToParse);

        const jsonStr = JSON.stringify(paramsObj);
        const encodedParams = safeBtoa(jsonStr);
        urlObj.searchParams.set('params', encodedParams);

        targetUrl = hasProtocol ? urlObj.toString() : urlObj.toString().replace('http://', '');
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

  const menuContent = (
    <List
      size="small"
      dataSource={redirectionUrls}
      renderItem={(item) => (
        <List.Item
          style={{ cursor: 'pointer', padding: '4px 10px' }}
          onClick={() => handleRedirect(item)}
          className="redirection-menu-item"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1890ff' }}>
            <LinkOutlined style={{ color: '#1890ff' }} />
            <span style={{ color: '#1890ff', fontWeight: 500 }}>{item.label}</span>
          </div>
        </List.Item>
      )}
    />
  );

  return (
    <Popover
      content={menuContent}
      trigger="click"
      placement="bottom"
      overlayInnerStyle={{
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: '4px',
      }}
      styles={{
        body: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '4px',
        }
      }}
    >
      <Button size="small" type="text" icon={<MenuOutlined />} />
    </Popover>
  );
};

class EditableCell extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tempValue: String(props.value || ''),
      isValid: true,
    };
    this.cellRef = null;
  }

  componentDidMount() {
    if (this.cellRef) {
      this.cellRef.focus();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.setState({ tempValue: String(this.props.value || '') });
    }
  }

  validateValue = value => {
    const { validator = v => !isNaN(parseFloat(v)) && isFinite(v) } =
      this.props;
    return validator(value);
  };

  handleInput = e => {
    const value = e.target.value;
    const isValid = this.validateValue(value);
    this.setState({
      tempValue: value,
      isValid,
    });
  };

  handleSave = () => {
    const { tempValue, isValid } = this.state;
    const { onSave } = this.props;

    if (isValid && tempValue.trim() !== '') {
      const numValue = parseFloat(tempValue);
      onSave(numValue);
    } else {
      // Revert if invalid or empty (or maybe save empty/null?)
      // User flow suggests reverting or keeping original if error
       this.props.onCancel();
    }
  };

  handleKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.props.onCancel();
    }
  };

  handleBlur = e => {
    // Check if the new focus target is inside the container (if we had one) or if it's a save action
    // small delay
    setTimeout(() => {
        this.handleSave();
    }, 100);
  };

  render() {
    const { tempValue, isValid } = this.state;
    const { theme } = this.props;

    // Overlay style to expand over the cell
    return (
      <div
        css={css`
            position: absolute;
            top: -5px;
            left: -5px;
            right: -5px;
            bottom: auto;
            min-height: calc(100% + 10px);
            z-index: 100;
            background: #fff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 1px solid #20a7c9;
            border-radius: 4px;
            padding: 4px;
            display: flex;
            align-items: center;
        `}
      >
        <input
            type="number"
            ref={ref => { this.cellRef = ref; }}
            value={tempValue}
            onChange={this.handleInput}
            onKeyDown={this.handleKeyDown}
            onBlur={this.handleBlur}
            className={`ant-input ${!isValid ? 'ant-input-status-error' : ''}`}
            css={css`
                width: 100%;
                height: 100%;
                border: none;
                outline: none;
                background: transparent;
                margin: 0;
                padding: 0;
                font-family: inherit;
                font-size: inherit;
                &:focus {
                    box-shadow: none;
                }
            `}
        />
      </div>
    );
  }
}




export const TableRenderer = React.memo(props => {
  const {
    data,
    aggregatorName,
    metrics,
    rows: initialRows,
    cols: initialCols,
    tableOptions,
    subtotalOptions,
    namesMapping,
    onContextMenu,
    onCellEdit,
    allowRenderHtml,
    theme,
    backendApiUrl,
    editableMetrics,
    datasource,
    metricsLayout,
    onRegisterSave, // Destructure new prop
    onRegisterReset,
    onFilterChange,
    useCustomSorting,
    notification,
    onEditCountChange,
    onRowSelectionChange,
    selectedRowKeys = new Set(), // Allow props to control selection
    cellEditPayloadMapping,
    redirectionUrls = [],
    rawFormData,
    dashboardFilters,
  } = props;

  const hasRedirection = redirectionUrls && redirectionUrls.length > 0;

  const hasRowActions =
    tableOptions.rowLevelActions && tableOptions.rowLevelActions.length > 0;

  const [collapsedRows, setCollapsedRows] = useState({});
  const [collapsedCols, setCollapsedCols] = useState({});
  const [editingCell, setEditingCell] = useState(null); // { rowKey, colKey }
  const [forceUpdate, setForceUpdate] = useState(0); // For triggering re-renders when cell values change
  const [filters, setFilters] = useState({});
  const [activeFilterMenu, setActiveFilterMenu] = useState(null);
  const [sortModel, setSortModel] = useState([]); // Array of { key, direction }

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value, // value is array of selected strings
    }));
    setActiveFilterMenu(null);
  }, []);

  // 1. Filter Data based on Filters (Global Filter Application)
  const filteredData = useMemo(() => {
     if (!filters || Object.keys(filters).length === 0) return data;
     
     return data.filter(record => {
        for (const [attr, selectedValues] of Object.entries(filters)) {
             if (selectedValues && selectedValues.length > 0) {
                 // Skip if attr is not in record (e.g. Metric filters if specific logic needed, skipping record-level filtering for now if key not found)
                 if (record[attr] !== undefined) {
                     if (!selectedValues.includes(String(record[attr]))) return false;
                 }
                 // If it's a metric key (flatKey), we currently can't filter raw records by it easily without pre-aggregation. 
                 // Assuming dependent filtering requested is for Dimensions.
             }
        }
        return true;
     });
  }, [data, filters]);

  const cellEditManager = useMemo(
    () =>
      new PivotCellEditManager(
        initialRows,
        initialCols,
        data,
        aggregatorName,
        metrics,
        backendApiUrl,
        editableMetrics,
        datasource,
        notification,
        cellEditPayloadMapping,
      ),
    [
      initialRows,
      initialCols,
      data,
      aggregatorName,
      metrics,
      backendApiUrl,
      editableMetrics,
      datasource,
      metricsLayout,
      cellEditPayloadMapping,
    ],
  );

  useEffect(() => {
    const handleChange = () => {
      setForceUpdate(prev => prev + 1);
      if (onEditCountChange) {
        onEditCountChange(cellEditManager.getModificationCount());
      }
    };
    
    cellEditManager.addChangeListener(handleChange);
    return () =>
      cellEditManager.removeChangeListener(handleChange);
  }, [cellEditManager, onEditCountChange]);

  useEffect(() => {
    if (onRegisterSave) {
      onRegisterSave(cellEditManager.sendModifications);
    }
  }, [cellEditManager, onRegisterSave]);

  useEffect(() => {
    if (onRegisterReset) {
      onRegisterReset(() => {
        setFilters({});
      });
    }
  }, [onRegisterReset]);

  const handleCellModification = useCallback(() => {
    // Trigger re-render when cell modifications change
    setForceUpdate(prev => prev + 1);
  }, []);

  // Expose methods for external access to modifications
  const getCellModifications = useCallback(() => {
    return cellEditManager.getModifications();
  }, [cellEditManager]);

  const clearCellModifications = useCallback(() => {
    cellEditManager.clearModifications();
  }, [cellEditManager]);

  const getModificationCount = useCallback(() => {
    return cellEditManager.getModificationCount();
  }, [cellEditManager]);

  const getBasePivotSettings = useCallback(() => {
    const colAttrs = initialCols;
    const rowAttrs = initialRows;

    const mergedTableOptions = {
      rowTotals: true,
      colTotals: true,
      ...tableOptions,
    };
    const rowTotals = mergedTableOptions.rowTotals || colAttrs.length === 0;
    const colTotals = mergedTableOptions.colTotals || rowAttrs.length === 0;

    const mergedNamesMapping = namesMapping || {};
    const mergedSubtotalOptions = {
      arrowCollapsed: '\u25B2',
      arrowExpanded: '\u25BC',
      ...subtotalOptions,
    };

    const colSubtotalDisplay = {
      displayOnTop: false,
      enabled: mergedTableOptions.colSubTotals,
      hideOnExpand: false,
      ...mergedSubtotalOptions.colSubtotalDisplay,
    };

    const rowSubtotalDisplay = {
      displayOnTop: false,
      enabled: mergedTableOptions.rowSubTotals,
      hideOnExpand: false,
      ...mergedSubtotalOptions.rowSubtotalDisplay,
    };

    const pivotData = new PivotData({ ...props, data: filteredData }, {
      rowEnabled: rowSubtotalDisplay.enabled,
      colEnabled: colSubtotalDisplay.enabled,
      rowPartialOnTop: rowSubtotalDisplay.displayOnTop,
      colPartialOnTop: colSubtotalDisplay.displayOnTop,
    });
    let rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();



    const customSort = (a, b) => {
       for (let i = 0; i < Math.min(a.length, b.length); i++) {
          if (a[i] !== b[i]) {
              const valA = getCustomSortKey(a[i], useCustomSorting);
              const valB = getCustomSortKey(b[i], useCustomSorting);
              if (valA < valB) return -1;
              if (valA > valB) return 1;
          }
       }
       return 0;
    };

    if (useCustomSorting) {
        // ALWAYS sort colKeys if custom sorting is enabled, regardless of row sort
        colKeys.sort(customSort);
        
        if (sortModel.length === 0) {
            rowKeys.sort(customSort);
        }
    }

    // Note: PivotData sorts colKeys internally. If we re-sort here, render will use our order 
    // because we pass these 'sorted' keys (via PivotData iteration or directly if we managed loops). 
    // Wait, renderColHeaderRow iterates over colAttrs and builds structure. 
    // PivotData.getColKeys() returns the tree structure keys. 
    // If we sort `colKeys`, it doesn't affect `renderColHeaderRow` directly unless `renderColHeaderRow` uses `pivotData.getColKeys()`.
    // Actually `renderColHeaderRow` (and `renderCols`) logic typically iterates `colKeys`.
    // Let's check renderCols... It works on `colKeys`.
    // But `renderColHeaderRow` works on `colAttrs`.
    // `PivotTable` implementation usually iterates `colKeys`.
    // Let's assume `colKeys` variable is used. Actually, looking at `TableRenderer` logic (lines ~1000+),
    // it seems `colKeys` is used for value cells, but header structure is built from `colKeys`?
    // Start of render loop: `const colKeys = pivotData.getColKeys();`
    // If I modify `colKeys` array in place here, `pivotData.getColKeys()` returns a COPY? 
    // PivotData usually caches it. 
    // If I sort the variable `colKeys` locally, I need to ensure it's used deeper.
    // It is used in `cachedBasePivotSettings`.
    
    // BUT! `renderColHeaderRow` doesn't take `colKeys` as arg. It computes them?
    // Let's double check `renderColHeaderRow` usage. 
    // It is called in `render()`... wait, `renderColHeaderRow` isn't called directly in main render?
    // It is used in `thead`.
    // We export `TableRenderer`.
    // Inside `TableRenderer`:
    // It logic is complex.
    
    // Let's stick to modifying `rowKeys` for now as primary goal.
    // User asked for "column-specific custom sort logic... for time-dimension columns".
    
    if (sortModel.length > 0) {
      rowKeys.sort((a, b) => {
        for (const sortItem of sortModel) {
            const { key, direction } = sortItem;
            let comparison = 0;
            
            // Check if sortItem.key matches a Row Attribute (Dimension Sorting)
            const rowAttrIdx = initialRows.indexOf(key);
            if (rowAttrIdx !== -1) {
                 const valA = getCustomSortKey(a[rowAttrIdx], useCustomSorting);
                 const valB = getCustomSortKey(b[rowAttrIdx], useCustomSorting);
                 if (valA < valB) comparison = -1;
                 else if (valA > valB) comparison = 1;
            } else {
                // Metric Sorting
                const targetColKey = colKeys.find(k => flatKey(k) === key);
                if (targetColKey) {
                    const valA = pivotData.getAggregator(a, targetColKey).value();
                    const valB = pivotData.getAggregator(b, targetColKey).value();
                    if (valA < valB) comparison = -1;
                    else if (valA > valB) comparison = 1;
                }
            }
            
            if (comparison !== 0) {
                return direction === 'asc' ? comparison : -comparison;
            }
        }
        return 0; // Equal
      });
    }


    const cellCallbacks = {};
    const rowTotalCallbacks = {};
    const colTotalCallbacks = {};
    let grandTotalCallback = null;

    if (mergedTableOptions.clickCallback) {
      rowKeys.forEach(rowKey => {
        const flatRowKey = flatKey(rowKey);
        if (!(flatRowKey in cellCallbacks)) {
          cellCallbacks[flatRowKey] = {};
        }
        colKeys.forEach(colKey => {
          cellCallbacks[flatRowKey][flatKey(colKey)] = clickHandler(
            pivotData,
            rowKey,
            colKey,
          );
        });
      });

      if (rowTotals) {
        rowKeys.forEach(rowKey => {
          rowTotalCallbacks[flatKey(rowKey)] = clickHandler(
            pivotData,
            rowKey,
            [],
          );
        });
      }
      if (colTotals) {
        colKeys.forEach(colKey => {
          colTotalCallbacks[flatKey(colKey)] = clickHandler(
            pivotData,
            [],
            colKey,
          );
        });
      }
      if (rowTotals && colTotals) {
        grandTotalCallback = clickHandler(pivotData, [], []);
      }
    }

    return {
      pivotData,
      colAttrs,
      rowAttrs,
      colKeys,
      rowKeys,
      rowTotals,
      colTotals,
      arrowCollapsed: mergedSubtotalOptions.arrowCollapsed,
      arrowExpanded: mergedSubtotalOptions.arrowExpanded,
      colSubtotalDisplay,
      rowSubtotalDisplay,
      cellCallbacks,
      rowTotalCallbacks,
      colTotalCallbacks,
      grandTotalCallback,
      namesMapping: mergedNamesMapping,
      allowRenderHtml: props.allowRenderHtml,
    };
  }, [
    aggregatorName,
    initialCols,
    initialRows,
    data,
    filteredData,
    namesMapping,
    subtotalOptions,
    tableOptions,
    props.allowRenderHtml,
    props.onContextMenu,
    props.tableOptions.clickColumnHeaderCallback,
    props.tableOptions.clickRowHeaderCallback,
    props.tableOptions.clickCallback,
    sortModel,
    useCustomSorting,
  ]);

  const clickHandler = useCallback(
    (pivotData, rowValues, colValues) => {
      const colAttrs = initialCols;
      const rowAttrs = initialRows;
      const value = pivotData.getAggregator(rowValues, colValues).value();
      const filters = {};
      const colLimit = Math.min(colAttrs.length, colValues.length);
      for (let i = 0; i < colLimit; i += 1) {
        const attr = colAttrs[i];
        if (colValues[i] !== null) {
          filters[attr] = colValues[i];
        }
      }
      const rowLimit = Math.min(rowAttrs.length, rowValues.length);
      for (let i = 0; i < rowLimit; i += 1) {
        const attr = rowAttrs[i];
        if (rowValues[i] !== null) {
          filters[attr] = rowValues[i];
        }
      }
      return e => tableOptions.clickCallback(e, value, filters, pivotData);
    },
    [tableOptions, initialCols, initialRows],
  );

  const clickHeaderHandler = useCallback(
    (
      pivotData,
      values,
      attrs,
      attrIdx,
      callback,
      isSubtotal = false,
      isGrandTotal = false,
    ) => {
      const filters = {};
      for (let i = 0; i <= attrIdx; i += 1) {
        const attr = attrs[i];
        filters[attr] = values[i];
      }
      return e =>
        callback(
          e,
          values[attrIdx],
          filters,
          pivotData,
          isSubtotal,
          isGrandTotal,
        );
    },
    [],
  );

  // Cell editing handlers
  const handleCellClick = useCallback(
    (rowKey, colKey, originalValue) => e => {
      if (tableOptions.clickCallback) {
        return;
      }
      e.stopPropagation();
      const isSameCell =
        editingCell &&
        flatKey(editingCell.rowKey) === flatKey(rowKey) &&
        flatKey(editingCell.colKey) === flatKey(colKey);

      if (!isSameCell) {
        setEditingCell({ rowKey, colKey, originalValue });
      }
    },
    [editingCell, tableOptions.clickCallback],
  );

  const handleCellSave = useCallback(
    (rowKey, colKey, originalValue, newValue) => {
      cellEditManager.setValue(rowKey, colKey, originalValue, newValue);
      setEditingCell(null);

      // Send modifications to backend immediately after a cell is saved
      // cellEditManager.sendModifications();

      if (onCellEdit) {
        const modifications = cellEditManager.getModifications();
        const currentCellModification = modifications.data.find(
          // Assuming modifications.data is an array of data objects now
          dataItem => {
            // This part needs more robust logic to identify the exact modified cell within the new payload structure
            // For now, we'll simplify and just pass the full payload to onCellEdit if it exists
            // Or, ideally, onCellEdit would expect the full payload as well.
            // Given the new payload structure, passing a single `currentCellModification` isn't straightforward.
            // I will update this to pass the entire payload, as the `onCellEdit` signature would need to change otherwise.
            return false; // Temporarily return false as we're changing the onCellEdit usage
          },
        );
        // Pass the entire modifications payload to onCellEdit
        onCellEdit(modifications);
      }
    },
    [cellEditManager, onCellEdit],
  );

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const isEditingCell = useCallback(
    (rowKey, colKey) => {
      return (
        editingCell &&
        flatKey(editingCell.rowKey) === flatKey(rowKey) &&
        flatKey(editingCell.colKey) === flatKey(colKey)
      );
    },
    [editingCell],
  );

  const collapseAttr = useCallback(
    (rowOrCol, attrIdx, allKeys) => e => {
      e.stopPropagation();
      const keyLen = attrIdx + 1;
      const collapsed = allKeys.filter(k => k.length === keyLen).map(flatKey);

      const updates = {};
      collapsed.forEach(k => {
        updates[k] = true;
      });

      if (rowOrCol) {
        setCollapsedRows(state => ({ ...state, ...updates }));
      } else {
        setCollapsedCols(state => ({ ...state, ...updates }));
      }
    },
    [],
  );

  const expandAttr = useCallback(
    (rowOrCol, attrIdx, allKeys) => e => {
      e.stopPropagation();
      const updates = {};
      allKeys.forEach(k => {
        for (let i = 0; i <= attrIdx; i += 1) {
          updates[flatKey(k.slice(0, i + 1))] = false;
        }
      });

      if (rowOrCol) {
        setCollapsedRows(state => ({ ...state, ...updates }));
      } else {
        setCollapsedCols(state => ({ ...state, ...updates }));
      }
    },
    [],
  );

  const toggleRowKey = useCallback(
    flatRowKey => e => {
      e.stopPropagation();
      setCollapsedRows(state => ({
        ...state,
        [flatRowKey]: !state[flatRowKey],
      }));
    },
    [],
  );

  const toggleColKey = useCallback(
    flatColKey => e => {
      e.stopPropagation();
      setCollapsedCols(state => ({
        ...state,
        [flatColKey]: !state[flatColKey],
      }));
    },
    [],
  );

  const calcAttrSpans = useCallback((attrArr, numAttrs) => {
    const spans = [];
    const li = Array(numAttrs).fill(0);
    let lv = Array(numAttrs).fill(null);
    for (let i = 0; i < attrArr.length; i += 1) {
      const cv = attrArr[i];
      const ent = [];
      let depth = 0;
      const limit = Math.min(lv.length, cv.length);
      while (depth < limit && lv[depth] === cv[depth]) {
        ent.push(-1);
        spans[li[depth]][depth] += 1;
        depth += 1;
      }
      while (depth < cv.length) {
        li[depth] = i;
        ent.push(1);
        depth += 1;
      }
      spans.push(ent);
      lv = cv;
    }
    return spans;
  }, []);

  const cachedBasePivotSettings = useMemo(
    () => getBasePivotSettings(),
    [getBasePivotSettings],
  );

  // Lazy getter for unique values - DEPENDENT implementation
  const getUniqueValues = useCallback((key) => {
    // If we want dependent filters, we calculate unique values from DATA based on ALL filters EXCEPT 'key'.
    if (!data) return [];
    
    // Check if key is a dimension in data
    // We iterate data and check visibility
    // Check if key is a dimension in data
    // We iterate data and check visibility
    const otherFiltersEntries = Object.entries(filters).filter(([k, v]) => k !== key && v && v.length > 0);
    
    // Check if there are any "Metric" filters active (keys NOT in data)
    // If so, we MUST use Aggregated Data logic (PivotData) instead of Raw Data logic,
    // because Raw Data doesn't know about aggregated values (like '101k').
    const hasMetricFilters = otherFiltersEntries.some(([k]) => {
         // Heuristic: if k is NOT in data[0], it's likely a Metric/Column Key.
         return data && data.length > 0 && data[0][k] === undefined;
    });

    if (hasMetricFilters && cachedBasePivotSettings) {
        const { rowKeys, colKeys, pivotData, rowAttrs } = cachedBasePivotSettings;
        const targetRowAttrIdx = rowAttrs.indexOf(key);
        
        if (targetRowAttrIdx !== -1) {
             // Separate standard Dimension filters and Metric filters
             const otherDimensionFilters = otherFiltersEntries.filter(([k]) => data[0][k] !== undefined);
             const otherMetricFilters = otherFiltersEntries.filter(([k]) => data[0][k] === undefined);

             // Filter rowKeys
             const validRowKeys = rowKeys.filter(rowKey => {
                  // 1. Check Metric Filters
                  for (const [otherKey, selectedValues] of otherMetricFilters) {
                      const otherColKey = colKeys.find(k => flatKey(k) === otherKey);
                      if (otherColKey) {
                          const agg = pivotData.getAggregator(rowKey, otherColKey);
                          const val = agg.format(agg.value());
                          if (!selectedValues.includes(val)) return false;
                      }
                  }
                  
                  // 2. Check Dimension Filters (on the rowKey itself if possible, or skip if handled by global filteredData)
                  // Note: 'pivotData' is already built from 'filteredData', so standard dimension filters 
                  // are already applied to the set of rowKeys. We don't need to double-check them here 
                  // UNLESS we want to filter based on OTHER dimensions not in the rowKeys (which is rare/impossible for row headers).
                  // For the current row dimension 'key', we naturally get available values from the surviving rowKeys.
                  
                  return true;
             });
             
             const dimValues = new Set();
             validRowKeys.forEach(rowKey => {
                 const val = rowKey[targetRowAttrIdx];
                 if (val !== undefined && val !== null) dimValues.add(String(val));
             });
             return Array.from(dimValues).sort();
        }
    }

    // Default Raw Data Logic (Only Dimensions or No Metric Filters active)
    const values = new Set();
    
    // Helper to check if record matches other filters
    const matchesOtherFilters = (record) => {
        for (const [attr, selectedValues] of otherFiltersEntries) {
             // Only check dimensions here
             if (record[attr] !== undefined) {
                 if (!selectedValues.includes(String(record[attr]))) return false;
             }
        }
        return true;
    };
    
    data.forEach(record => {
        if (matchesOtherFilters(record)) {
            // If key exists in record, add it
            if (record[key] !== undefined) {
                values.add(String(record[key]));
            }
        }
    });
    
    if (values.size > 0) {
        return Array.from(values).sort();
    }
    
    // Fallback/Legacy Logic for derived attributes or PivotData-based lookup (e.g. Metric Columns)
    // If 'key' wasn't found in data (e.g. it's a metric column name or something else)
    
    if (!cachedBasePivotSettings) return [];
    const { rowKeys, colKeys, pivotData } = cachedBasePivotSettings;
    
    // Dependent Filtering for Metric/AGGREGATED columns
    // We need to filter 'rowKeys' based on OTHER active Metric filters.
    // (Dimension filters are already applied via filteredData -> pivotData)

    const targetColKey = colKeys.find(k => flatKey(k) === key);
    if (targetColKey) {
        // Identify other active filters that are NOT dimensions (not in data)
        // These are likely other Metric Columns.
        const otherMetricFilters = Object.entries(filters).filter(([k, v]) => {
             if (k === key) return false;
             if (!v || v.length === 0) return false;
             // Heuristic: if k is in data, it's a Dimension (already handled). 
             // If not in data, it's likely a Metric/Column Key.
             if (data && data.length > 0 && data[0][k] !== undefined) return false; 
             return true;
        });

        // Filter rowKeys by checking if they satisfy 'otherMetricFilters'
        const validRowKeys = rowKeys.filter(rowKey => {
             for (const [otherKey, selectedValues] of otherMetricFilters) {
                  // Find the colKey for this other filter
                  const otherColKey = colKeys.find(k => flatKey(k) === otherKey);
                  if (otherColKey) {
                      const agg = pivotData.getAggregator(rowKey, otherColKey);
                      const val = agg.format(agg.value()); // Format to match filter values
                      if (!selectedValues.includes(val)) return false;
                  }
             }
             return true;
        });

        const colValues = new Set();
        validRowKeys.forEach(rowKey => {
            const agg = pivotData.getAggregator(rowKey, targetColKey);
            const val = agg.value();
            colValues.add(agg.format(val));
        });
        return Array.from(colValues).sort();
    }
    
    return [];
  }, [data, filters, cachedBasePivotSettings]);

  // Memoize values only for the active filter menu to avoid re-calculating for every render
  const activeUniqueValues = useMemo(() => {
     if (!activeFilterMenu) return [];
     return getUniqueValues(activeFilterMenu);
  }, [activeFilterMenu, getUniqueValues]);



  const isDashboardEditMode = useCallback(() => {
    return document.contains(document.querySelector('.dashboard--editing'));
  }, []);

  const renderColHeaderRow = useCallback(
    (attrName, attrIdx, pivotSettings) => {
      const {
        rowAttrs,
        colAttrs,
        colKeys,
        visibleColKeys,
        colAttrSpans,
        rowTotals,
        arrowExpanded,
        arrowCollapsed,
        colSubtotalDisplay,
        maxColVisible,
        pivotData,
        namesMapping,
        allowRenderHtml,
      } = pivotSettings;
      const mergedTableOptions = tableOptions;
      const {
        highlightHeaderCellsOnHover,
        omittedHighlightHeaderGroups = [],
        highlightedHeaderCells,
        dateFormatters,
      } = mergedTableOptions;

      const spaceCell =
        attrIdx === 0 && rowAttrs.length !== 0 ? (
          <th
            key="padding"
            colSpan={rowAttrs.length + (hasRowActions ? 1 : 0) + (hasRedirection ? 1 : 0)}
            rowSpan={colAttrs.length}
            aria-hidden="true"
          />
        ) : null;

      const needToggle =
        colSubtotalDisplay.enabled && attrIdx !== colAttrs.length - 1;
      let arrowClickHandle = null;
      let subArrow = null;
      if (needToggle) {
        arrowClickHandle =
          attrIdx + 1 < maxColVisible
            ? collapseAttr(false, attrIdx, colKeys)
            : expandAttr(false, attrIdx, colKeys);
        subArrow = attrIdx + 1 < maxColVisible ? arrowExpanded : arrowCollapsed;
      }
      const attrNameCell = (
        <th key="label" className="pvtAxisLabel">
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {displayHeaderCell(
                needToggle,
                subArrow,
                arrowClickHandle,
                attrName,
                namesMapping,
                allowRenderHtml,
              )}
           </div>
        </th>
      );

      const attrValueCells = [];
      const rowIncrSpan = rowAttrs.length !== 0 ? 1 : 0;
      let i = 0;
      while (i < visibleColKeys.length) {
        let handleContextMenu;
        const colKey = visibleColKeys[i];
        const colSpan = attrIdx < colKey.length ? colAttrSpans[i][attrIdx] : 1;
        let colLabelClass = 'pvtColLabel';
        if (attrIdx < colKey.length) {
          if (!omittedHighlightHeaderGroups.includes(colAttrs[attrIdx])) {
            if (highlightHeaderCellsOnHover) {
              colLabelClass += ' hoverable';
            }
            handleContextMenu = e =>
              onContextMenu(e, colKey, undefined, {
                [attrName]: colKey[attrIdx],
              });
          }
          if (
            highlightedHeaderCells &&
            Array.isArray(highlightedHeaderCells[colAttrs[attrIdx]]) &&
            highlightedHeaderCells[colAttrs[attrIdx]].includes(colKey[attrIdx])
          ) {
            colLabelClass += ' active';
          }

          const rowSpan =
            1 + (attrIdx === colAttrs.length - 1 ? rowIncrSpan : 0);
          const flatColKey = flatKey(colKey.slice(0, attrIdx + 1));
          const onArrowClick = needToggle ? toggleColKey(flatColKey) : null;

          const rawValue = colKey[attrIdx];
          let headerCellFormattedValue = rawValue;

          if (dateFormatters && dateFormatters[attrName] && typeof dateFormatters[attrName] === 'function') {
             headerCellFormattedValue = dateFormatters[attrName](rawValue);
          } else if (namesMapping && namesMapping[rawValue]) {
             headerCellFormattedValue = namesMapping[rawValue];
          }
          const isEditableMetricHeader =
            Array.isArray(editableMetrics) &&
            editableMetrics.includes(colKey[attrIdx]);

          // We only add filter to the last level of column headers (the metric/value level)
          // or if user wants to filter by column dimension values?
          // The previous input row filtered rows by value in that column.
          // That corresponds to the lowest level column header.
          // Check if this is the last attribute index
          const isLastLevel = attrIdx === colAttrs.length - 1;
          const fKey = flatKey(colKey);

          // Sorting Handler
          // Only for lowest level columns (metrics or last dimension)
          // Sorting Handler
          // Only for lowest level columns (metrics or last dimension)
          // Sort Handler - Updated to support Group Headers by sorting the FIRST LEAF column (fKey)
          // This matches "last level sorting only" request.
          const handleSort = (e) => {
                 e.stopPropagation();
                 
                 const existingSortIndex = sortModel.findIndex(s => s.key === fKey);
                 let newSortModel = [...sortModel];
                 
                 if (e.shiftKey) {
                     // Multi-sort: Append or Toggle
                     if (existingSortIndex !== -1) {
                         // Toggle existing
                         const currentDir = newSortModel[existingSortIndex].direction;
                         if (currentDir === 'asc') newSortModel[existingSortIndex].direction = 'desc';
                         else newSortModel.splice(existingSortIndex, 1); // Remove
                     } else {
                         // Append new
                         newSortModel.push({ key: fKey, direction: 'asc' });
                     }
                 } else {
                     // Single Sort: Replace all
                     let nextDirection = 'asc';
                     if (existingSortIndex !== -1 && sortModel.length === 1) {
                         if (sortModel[0].direction === 'asc') nextDirection = 'desc';
                         else if (sortModel[0].direction === 'desc') nextDirection = null;
                     }
                     
                     if (nextDirection) {
                         newSortModel = [{ key: fKey, direction: nextDirection }];
                     } else {
                         newSortModel = [];
                     }
                 }
                 setSortModel(newSortModel);
          };

          // Check if THIS column (Leaf) is sorted. 
          // Note: Since we use fKey, the icon on the Group Header will light up if the First Leaf is sorted.
          // This is generally desired ("Sort icon visible...").
          const sortItem = sortModel.find(s => s.key === fKey);
          const isSorted = !!sortItem;
          // Sort Icon Logic: display only if it is the last level (Leaf) 
          const sortIcon = isLastLevel ? (
              isSorted ? (
                sortItem.direction === 'asc' ? <CaretUpOutlined style={{ marginLeft: 5 }} /> : <CaretDownOutlined style={{ marginLeft: 5 }} />
              ) : (
                // Show inactive sort icon to indicate sortability
                <span style={{ marginLeft: 5, color: '#ccc', fontSize: '10px', display: 'flex', flexDirection: 'column', lineHeight: '0.5' }}>
                    <CaretUpOutlined style={{ marginBottom: -2 }} />
                    <CaretDownOutlined />
                </span>
              )
          ) : null;

          // Show sort numbers if multi-sorting
          const sortIndex = sortModel.findIndex(s => s.key === fKey);
          const sortOrderIndicator = (sortModel.length > 1 && isSorted && isLastLevel) ? <span style={{ fontSize: '10px', marginLeft: 2 }}>{sortIndex + 1}</span> : null;


          attrValueCells.push(
            <th
              className={colLabelClass}
              key={`colKey-${flatColKey}`}
              colSpan={colSpan}
              rowSpan={rowSpan}
              role="columnheader button"
              onClick={(e) => {
                  // 1. Cross-Filtering Trigger (All Levels)
                  if (tableOptions.clickColumnHeaderCallback) {
                       const originalHandler = clickHeaderHandler(
                          pivotData,
                          colKey,
                          initialCols,
                          attrIdx,
                          mergedTableOptions.clickColumnHeaderCallback
                       );
                       if (originalHandler) {
                           originalHandler(e);
                       }
                  }

                  // 2. Sorting Trigger (Leaf Level Only)
                  // Only allow sorting on the leaf level
                  if (isLastLevel) {
                      handleSort(e);
                  }
                  
                  // If NOT last level, we might also want to trigger expand/collapse?
                  // Usually click on header sorts. Expand/collapse is on arrow.
              }}
              onContextMenu={handleContextMenu}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                      {headerCellFormattedValue}
                      {sortIcon}
                      {sortOrderIndicator}
                  </div>
                  {isLastLevel && (
                      <Popover
                        content={
                            activeFilterMenu === fKey ? (
                                <FilterPopover
                                    values={activeUniqueValues}
                                    selected={filters[fKey]}
                                    onSave={(vals) => handleFilterChange(fKey, vals)}
                                    onCancel={() => setActiveFilterMenu(null)}
                                />
                            ) : null
                        }
                        open={activeFilterMenu === fKey}
                        onOpenChange={visible => { if (!visible) setActiveFilterMenu(null); }}
                        placement="bottomLeft"
                      >
                        <FilterOutlined
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveFilterMenu(activeFilterMenu === fKey ? null : fKey);
                            }}
                            style={{ marginLeft: 5, color: filters[fKey] && filters[fKey].length > 0 ? '#1890ff' : undefined }}
                        />
                      </Popover>
                  )}
              </div>
            </th>,
          );
        } else if (attrIdx === colKey.length) {
          const rowSpan = colAttrs.length - colKey.length + rowIncrSpan;
          attrValueCells.push(
            <th
              className={`${colLabelClass} pvtSubtotalLabel`}
              key={`colKeyBuffer-${flatKey(colKey)}`}
              colSpan={colSpan}
              rowSpan={rowSpan}
              role="columnheader button"
              onClick={clickHeaderHandler(
                pivotData,
                colKey,
                initialCols,
                attrIdx,
                mergedTableOptions.clickColumnHeaderCallback,
                true,
              )}
            >
              {t('Subtotal')}
            </th>,
          );
        }
        i += colSpan;
      }

      const totalCell =
        attrIdx === 0 && rowTotals ? (
          <th
            key="total"
            className="pvtTotalLabel"
            rowSpan={colAttrs.length + Math.min(rowAttrs.length, 1)}
            role="columnheader button"
            onClick={clickHeaderHandler(
              pivotData,
              [],
              initialCols,
              attrIdx,
              mergedTableOptions.clickColumnHeaderCallback,
              false,
              true,
            )}
          >
            {t('Total (%(aggregatorName)s)', {
              aggregatorName: t(aggregatorName),
            })}
          </th>
        ) : null;

      const cells = [spaceCell, attrNameCell, ...attrValueCells, totalCell];
      return <tr key={`colAttr-${attrIdx}`}>{cells}</tr>;
    },
    [
      collapsedCols,
      collapseAttr,
      expandAttr,
      toggleColKey,
      tableOptions,
      onContextMenu,
      clickHeaderHandler,
      activeFilterMenu,
      activeUniqueValues,
      filters,
      sortModel,
      redirectionUrls,
    ],
  );

  const renderRowHeaderRow = useCallback(
    pivotSettings => {
      const {
        rowAttrs,
        colAttrs,
        rowKeys,
        arrowCollapsed,
        arrowExpanded,
        rowSubtotalDisplay,
        maxRowVisible,
        pivotData,
        namesMapping,
        allowRenderHtml,
      } = pivotSettings;
      const mergedTableOptions = tableOptions;
      return (
        <tr key="rowHdr">
          {hasRowActions && <th className="pvtAxisLabel">{t('Actions')}</th>}
          {hasRedirection && <th className="pvtAxisLabel">{t('Redirection')}</th>}
          {rowAttrs.map((r, i) => {
            const needLabelToggle =
              rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
            let arrowClickHandle = null;
            let subArrow = null;
            if (needLabelToggle) {
              arrowClickHandle =
                i + 1 < maxRowVisible
                  ? collapseAttr(true, i, rowKeys)
                  : expandAttr(true, i, rowKeys);
              subArrow = i + 1 < maxRowVisible ? arrowExpanded : arrowCollapsed;
            }

            const handleSort = (e) => {
                e.stopPropagation();
                
                const existingSortIndex = sortModel.findIndex(s => s.key === r);
                let newSortModel = [...sortModel];
                
                 if (e.shiftKey) {
                     // Multi-sort: Append or Toggle
                     if (existingSortIndex !== -1) {
                         // Toggle existing
                         const currentDir = newSortModel[existingSortIndex].direction;
                         if (currentDir === 'asc') newSortModel[existingSortIndex].direction = 'desc';
                         else newSortModel.splice(existingSortIndex, 1); // Remove
                     } else {
                         // Append new
                         newSortModel.push({ key: r, direction: 'asc' });
                     }
                 } else {
                     // Single Sort: Replace all
                     let nextDirection = 'asc';
                     if (existingSortIndex !== -1 && sortModel.length === 1) {
                         if (sortModel[0].direction === 'asc') nextDirection = 'desc';
                         else if (sortModel[0].direction === 'desc') nextDirection = null;
                     }
                     
                     if (nextDirection) {
                         newSortModel = [{ key: r, direction: nextDirection }];
                     } else {
                         newSortModel = [];
                     }
                 }
                 setSortModel(newSortModel);
            };
        
            const sortItem = sortModel.find(s => s.key === r);
            const isSorted = !!sortItem;
            const sortIcon = isSorted ? (
                sortItem.direction === 'asc' ? <CaretUpOutlined style={{ marginLeft: 5 }} /> : <CaretDownOutlined style={{ marginLeft: 5 }} />
            ) : null;
            const sortIndex = sortModel.findIndex(s => s.key === r);
            const sortOrderIndicator = (sortModel.length > 1 && isSorted) ? <span style={{ fontSize: '10px', marginLeft: 2, marginRight: 2 }}>{sortIndex + 1}</span> : null;
        
            return (
              <th className="pvtAxisLabel" key={`rowAttr-${i}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={handleSort} role="button">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {displayHeaderCell(
                          needLabelToggle,
                          subArrow,
                          arrowClickHandle,
                          r,
                          namesMapping,
                          allowRenderHtml,
                        )}
                        {sortIcon}
                        {sortOrderIndicator}
                    </div>
                    <Popover
                        content={
                            activeFilterMenu === r ? (
                                <FilterPopover
                                    values={activeUniqueValues}
                                    selected={filters[r]}
                                    onSave={(vals) => handleFilterChange(r, vals)}
                                    onCancel={() => setActiveFilterMenu(null)}
                                />
                            ) : null
                        }
                        trigger="click"
                         open={activeFilterMenu === r}
                        onOpenChange={(visible) => {
                            if (!visible) setActiveFilterMenu(null);
                        }}
                        placement="bottomLeft"
                    >
                        <FilterOutlined
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveFilterMenu(activeFilterMenu === r ? null : r);
                            }}
                            style={{ marginLeft: 5, color: filters[r] && filters[r].length > 0 ? '#1890ff' : undefined }}
                        />
                    </Popover>
                </div>
              </th>
            );
          })}
          <th
            className="pvtTotalLabel"
            key="padding"
            role="columnheader button"
            onClick={clickHeaderHandler(
              pivotData,
              [],
              initialRows,
              0,
              mergedTableOptions.clickRowHeaderCallback,
              false,
              true,
            )}
          >
            {colAttrs.length === 0
              ? t('Total (%(aggregatorName)s)', {
                  aggregatorName: t(aggregatorName),
                })
              : null}
          </th>
        </tr>
      );
    },
    [
      collapsedRows,
      collapseAttr,
      expandAttr,
      toggleRowKey,
      tableOptions,
      onContextMenu,
      clickHeaderHandler,
      activeFilterMenu,
      activeUniqueValues,
      filters,
      redirectionUrls,
    ],
  );

  const renderTableRow = useCallback(
    (rowKey, rowIdx, pivotSettings) => {
      const {
        rowAttrs,
        colAttrs,
        rowAttrSpans,
        visibleColKeys,
        pivotData,
        rowTotals,
        rowSubtotalDisplay,
        arrowExpanded,
        arrowCollapsed,
        cellCallbacks,
        rowTotalCallbacks,
        namesMapping,
        allowRenderHtml,
      } = pivotSettings;

      const mergedTableOptions = tableOptions;
      const {
        highlightHeaderCellsOnHover,
        omittedHighlightHeaderGroups = [],
        highlightedHeaderCells,
        cellColorFormatters,
        dateFormatters,
      } = mergedTableOptions;
      const flatRowKey = flatKey(rowKey);

      const colIncrSpan = colAttrs.length !== 0 ? 1 : 0;
      // Determine if this row is the START of a new Checkbox Group
      let isFirstInGroup = true;
      let actionRowSpanIndex = rowAttrs.length - 1;
      
      if (hasRowActions) {
          if (rowAttrs.length > 0 && rowAttrs[actionRowSpanIndex] === 'Metric' && rowAttrs.length > 1) {
              actionRowSpanIndex = rowAttrs.length - 2;
          }
          if (rowAttrs.length > 0) {
              const actionRowSpan = rowAttrSpans[rowIdx][actionRowSpanIndex];
              isFirstInGroup = actionRowSpan > 0;
          }
      }

      const getBorderStyle = () => {
          if (!isFirstInGroup && hasRowActions) {
              return { borderTop: 'none' };
          }
          return {};
      };

      const attrValueCells = rowKey.map((r, i) => {
        let handleContextMenu;
        let valueCellClassName = 'pvtRowLabel';
        if (!omittedHighlightHeaderGroups.includes(rowAttrs[i])) {
          if (highlightHeaderCellsOnHover) {
            valueCellClassName += ' hoverable';
          }
          handleContextMenu = e =>
            onContextMenu(e, undefined, rowKey, {
              [rowAttrs[i]]: r,
            });
        }
        if (
          highlightedHeaderCells &&
          Array.isArray(highlightedHeaderCells[rowAttrs[i]]) &&
          highlightedHeaderCells[rowAttrs[i]].includes(r)
        ) {
          valueCellClassName += ' active';
        }
        const rowSpan = rowAttrSpans[rowIdx][i];
        if (rowSpan > 0) {
          const flatRowKey = flatKey(rowKey.slice(0, i + 1));
          const colSpan = 1 + (i === rowAttrs.length - 1 ? colIncrSpan : 0);
          const needRowToggle =
            rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
          const onArrowClick = needRowToggle ? toggleRowKey(flatRowKey) : null;

          let headerCellFormattedValue = r;
          if (dateFormatters && dateFormatters[rowAttrs[i]]) {
             try {
                const formatted = dateFormatters[rowAttrs[i]](r);
                if (formatted !== '' && formatted !== null && formatted !== undefined) {
                   headerCellFormattedValue = formatted;
                }
             } catch (e) {
                // Ignore error
             }
          }
          const isEditableMetricHeader =
            Array.isArray(editableMetrics) && editableMetrics.includes(r);

          return (
            <th
              key={`rowKeyLabel-${i}`}
              className={valueCellClassName}
              rowSpan={rowSpan}
              colSpan={colSpan}
              role="columnheader button"
              onClick={clickHeaderHandler(
                pivotData,
                rowKey,
                initialRows,
                i,
                mergedTableOptions.clickRowHeaderCallback,
              )}
              onContextMenu={handleContextMenu}
              style={{
                 // Apply borderTop: none to dimension row labels that are NOT the start of a group
                 // BUT DO NOT apply this to the 'Metric' column label or anything beyond the grouping boundary.
                  ...((!isFirstInGroup && hasRowActions && tableOptions.enableRowGrouping !== false && i <= actionRowSpanIndex) ? { borderTop: 'none' } : {})
              }}
            >
              {displayHeaderCell(
                needRowToggle,
                collapsedRows[flatRowKey] ? arrowCollapsed : arrowExpanded,
                onArrowClick,
                headerCellFormattedValue,
                namesMapping,
                allowRenderHtml,
              )}
            </th>
          );
        }
        return null;
      });

      const attrValuePaddingCell =
        rowKey.length < rowAttrs.length ? (
          <th
            className="pvtRowLabel pvtSubtotalLabel"
            key="rowKeyBuffer"
            colSpan={rowAttrs.length - rowKey.length + colIncrSpan}
            rowSpan={1}
            role="columnheader button"
            onClick={clickHeaderHandler(
              pivotData,
              rowKey,
              initialRows,
              rowKey.length,
              mergedTableOptions.clickRowHeaderCallback,
              true,
            )}
          >
            {t('Subtotal')}
          </th>
        ) : null;

      const rowClickHandlers = cellCallbacks[flatRowKey] || {};
      const valueCells = visibleColKeys.map(colKey => {
        const flatColKey = flatKey(colKey);
        const agg = pivotData.getAggregator(rowKey, colKey);
        const originalValue = agg.value();

        const displayValue = cellEditManager.getValue(
          rowKey,
          colKey,
          originalValue,
        );
        const isModified = cellEditManager.isModified(rowKey, colKey);
        const isEditing = isEditingCell(rowKey, colKey);

        // Determine the actual metric name for this cell for comparison with editableMetrics
        let metricForEditCheck = aggregatorName; // Default to aggregator name

        const metricInRowAttrs = initialRows.includes('Metric');
        const metricInColAttrs = initialCols.includes('Metric');

        if (metricInRowAttrs) {
          const metricIndex = initialRows.indexOf('Metric');
          metricForEditCheck = rowKey[metricIndex]; // This is already the display label
        } else if (metricInColAttrs) {
          const metricIndex = initialCols.indexOf('Metric');
          metricForEditCheck = colKey[metricIndex]; // This is already the display label
        } else if (metricsLayout === null && metrics && metrics.length > 0) {
          // Single metric mode, and 'Metric' is not a dimension
          const firstMetric = metrics[0];
          metricForEditCheck =
            typeof firstMetric === 'string' ? firstMetric : firstMetric.label; // Use display label
        }

        const isEditableMetric =
          Array.isArray(editableMetrics) &&
          editableMetrics.includes(metricForEditCheck);

        const keys = [...rowKey, ...colKey];
        let backgroundColor;
        if (cellColorFormatters) {
          Object.values(cellColorFormatters).forEach(cellColorFormatter => {
            if (Array.isArray(cellColorFormatter)) {
              keys.forEach(key => {
                if (backgroundColor) {
                  return;
                }
                cellColorFormatter
                  .filter(formatter => formatter.column === key)
                  .forEach(formatter => {
                    const formatterResult =
                      formatter.getColorFromValue(originalValue);
                    if (formatterResult) {
                      backgroundColor = formatterResult;
                    }
                  });
              });
            }
          });
        }

        const isDarkMode = theme.colorBgBase ? isColorDark(theme.colorBgBase) : false;
        
        const cellStyle = {
          ...(agg.isSubtotal ? { fontWeight: 'bold' } : { backgroundColor }),
          ...(isEditableMetric && !agg.isSubtotal && !agg.isGrandTotal
            ? {
                backgroundColor: isDarkMode ? '#2d2d14' : '#FFFBE6', // Dark olive for dark mode
                position: 'relative',
              }
            : {}),
          ...(isModified
            ? {
                backgroundColor: isDarkMode ? '#cfaf2fff' : '#ffd149ff', // Darker yellow/brown for modified in dark mode
                borderLeft: `3px solid ${isDarkMode ? '#d48806' : '#d48806'}`,
                color: isDarkMode ? '#ffffff' : undefined,
                position: 'relative',
              }
            : {}),
        };

        const cellClassName = `pvtVal ${isModified ? 'modified-cell' : ''}`;

        return (
          <td
            role="gridcell"
            className={cellClassName}
            key={`pvtVal-${flatColKey}`}
            onClick={
              isEditableMetric && !agg.isSubtotal && !agg.isGrandTotal
                ? handleCellClick(rowKey, colKey, originalValue)
                : rowClickHandlers[flatColKey]
            }
            onContextMenu={e => onContextMenu(e, colKey, rowKey)}
            style={cellStyle}
          >
            {isEditing &&
            isEditableMetric &&
            !agg.isSubtotal &&
            !agg.isGrandTotal ? (
              <EditableCell
                value={displayValue}
                onSave={newValue =>
                  handleCellSave(rowKey, colKey, originalValue, newValue)
                }
                onCancel={handleCellCancel}
                theme={theme}
              />
            ) : (
              <span
                title={
                  isModified
                    ? `Modified from ${originalValue} to ${displayValue}`
                    : ''
                }
              >
                {displayCell(agg.format(displayValue), allowRenderHtml)}
              </span>
            )}
          </td>
        );
      });

      let totalCell = null;
      if (rowTotals) {
        const agg = pivotData.getAggregator(rowKey, []);
        const originalValue = agg.value();
        const displayValue = cellEditManager.getValue(
          rowKey,
          [],
          originalValue,
        );
        const isModified = cellEditManager.isModified(rowKey, []);
        const isEditing = isEditingCell(rowKey, []);

        // Determine the metric for total cells (if applicable).
        // For total cells, the metric might not be directly in colKey/rowKey.
        // If 'Metric' is in initialRows/initialCols, the total cell represents the aggregation of all metrics.
        // In such cases, we assume total cells are not individually editable,
        // or we would need a more complex logic to identify which specific metric
        // within the total is being edited, which is beyond current scope.
        const isTotalEditableMetric = false; // Total cells are not considered individually editable for now.

        const cellStyle = {
          padding: `${theme.sizeUnit}px`,
          ...(isModified
            ? {
                backgroundColor: '#ffd149ff',
                borderLeft: '3px solid #d48806',
              }
            : {}),
        };

        totalCell = (
          <td
            role="gridcell"
            key="total"
            className={`pvtTotal ${isModified ? 'modified-cell' : ''}`}
            onClick={
              isTotalEditableMetric && !agg.isSubtotal && !agg.isGrandTotal
                ? handleCellClick(rowKey, [], originalValue)
                : rowTotalCallbacks[flatRowKey]
            }
            onContextMenu={e => onContextMenu(e, undefined, rowKey)}
            style={cellStyle}
          >
            {isEditing &&
            isTotalEditableMetric &&
            !agg.isSubtotal &&
            !agg.isGrandTotal ? (
              <EditableCell
                value={displayValue}
                onSave={newValue =>
                  handleCellSave(rowKey, [], originalValue, newValue)
                }
                onCancel={handleCellCancel}
                theme={theme}
              />
            ) : (
              <span
                title={
                  isModified
                    ? `Modified from ${originalValue} to ${displayValue}`
                    : ''
                }
              >
                {displayCell(agg.format(displayValue), allowRenderHtml)}
              </span>
            )}
          </td>
        );
      }

      const rowCells = [
        ...attrValueCells,
        attrValuePaddingCell,
        ...valueCells,
        totalCell,
      ];

      if (hasRedirection) {
          let actionRowSpanIndex = rowAttrs.length - 1;
          if (rowAttrs.length > 0 && rowAttrs[actionRowSpanIndex] === 'Metric' && rowAttrs.length > 1) {
              actionRowSpanIndex = rowAttrs.length - 2;
          }
          let actionRowSpan = 1;
          let shouldRenderAction = true;
          let isSubtotalRow = false;
          
          if (tableOptions.enableRowGrouping !== false && rowAttrs.length > 0) {
              if (rowKey.length <= actionRowSpanIndex) {
                  isSubtotalRow = true;
                  actionRowSpan = 1;
                  shouldRenderAction = true;
              } else {
                  actionRowSpan = rowAttrSpans[rowIdx][actionRowSpanIndex];
                  shouldRenderAction = actionRowSpan > 0;
              }
          }

          if (shouldRenderAction) {
              const matchingRecord = filteredData.find(rec => {
                  for (let idx = 0; idx < rowAttrs.length; idx++) {
                      const attr = rowAttrs[idx];
                      if (rec[attr] !== undefined && String(rec[attr]) !== String(rowKey[idx])) {
                          return false;
                      }
                  }
                  if (visibleColKeys && visibleColKeys.length > 0) {
                      const colKey = visibleColKeys[0];
                      for (let idx = 0; idx < colAttrs.length; idx++) {
                          const attr = colAttrs[idx];
                          if (rec[attr] !== undefined && String(rec[attr]) !== String(colKey[idx])) {
                              return false;
                          }
                      }
                  }
                  return true;
              });

              const rowData = matchingRecord ? { ...matchingRecord } : {};
              rowAttrs.forEach((attr, idx) => {
                  rowData[attr] = rowKey[idx];
              });
              if (visibleColKeys && visibleColKeys.length > 0) {
                  colAttrs.forEach((attr, colIdx) => {
                      const firstVal = visibleColKeys[0][colIdx];
                      rowData[attr] = firstVal;
                  });
              }

              const redirectionCell = (
                  <td
                      key="redirection-cell"
                      className="pvtVal"
                      rowSpan={actionRowSpan}
                      style={{
                          width: '50px',
                          minWidth: '50px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                      }}
                  >
                      {!isSubtotalRow && (
                          <RedirectionMenu
                              rowData={rowData}
                              redirectionUrls={redirectionUrls}
                              dimensionKeys={new Set([...rowAttrs, ...colAttrs])}
                              rawFormData={rawFormData}
                              dashboardFilters={dashboardFilters}
                          />
                      )}
                  </td>
              );
              rowCells.unshift(redirectionCell);
          }
      }

      if (hasRowActions) {
          let actionRowSpanIndex = rowAttrs.length - 1;
          if (rowAttrs.length > 0 && rowAttrs[actionRowSpanIndex] === 'Metric' && rowAttrs.length > 1) {
              actionRowSpanIndex = rowAttrs.length - 2;
          }
          let actionRowSpan = 1;
          let shouldRenderAction = true;
          let isSubtotalRow = false;
          
          if (tableOptions.enableRowGrouping !== false && rowAttrs.length > 0) {
              // Properly identify Subtotal rows that summarize above the Action Span boundary
              if (rowKey.length <= actionRowSpanIndex) {
                  isSubtotalRow = true;
                  actionRowSpan = 1; // It spans exactly itself since it is a unique aggregation layer
                  shouldRenderAction = true; // We unconditionally append it to prevent the UI from shifting
              } else {
                  actionRowSpan = rowAttrSpans[rowIdx][actionRowSpanIndex];
                  shouldRenderAction = actionRowSpan > 0;
              }
          }

          if (shouldRenderAction) {
              const groupRowKey = rowKey.slice(0, actionRowSpanIndex + 1);
              const groupFlatKey = flatKey(groupRowKey);

              const actionCell = (
                  <td key="action-cell" className="pvtVal" rowSpan={actionRowSpan} style={{ verticalAlign: 'top', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {!isSubtotalRow && (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '6px' }}>
                              <Checkbox
                                  checked={selectedRowKeys.has(groupFlatKey)}
                                  onChange={(e) => {
                                       e.stopPropagation();
                                       if (onRowSelectionChange) {
                                            const matchingRecord = filteredData.find(rec => {
                                                for (let idx = 0; idx < rowAttrs.length; idx++) {
                                                    const attr = rowAttrs[idx];
                                                    if (rec[attr] !== undefined && String(rec[attr]) !== String(rowKey[idx])) {
                                                        return false;
                                                    }
                                                }
                                                if (visibleColKeys && visibleColKeys.length > 0) {
                                                    const colKey = visibleColKeys[0];
                                                    for (let idx = 0; idx < colAttrs.length; idx++) {
                                                        const attr = colAttrs[idx];
                                                        if (rec[attr] !== undefined && String(rec[attr]) !== String(colKey[idx])) {
                                                            return false;
                                                        }
                                                    }
                                                }
                                                return true;
                                            });

                                            const rowData = matchingRecord ? { ...matchingRecord } : {};
                                            rowAttrs.forEach((attr, idx) => {
                                                rowData[attr] = rowKey[idx];
                                            });
                                            
                                            if (visibleColKeys && visibleColKeys.length > 0) {
                                               colAttrs.forEach((attr, colIdx) => {
                                                   const firstVal = visibleColKeys[0][colIdx];
                                                   rowData[attr] = firstVal;
                                               });
                                            }
                                           
                                           onRowSelectionChange(groupFlatKey, rowData, e.target.checked);
                                       }
                                  }}
                                  style={{ margin: 0 }}
                              />
                          </div>
                      )}
                  </td>
              );
              rowCells.unshift(actionCell);
          }
      }

      return <tr key={`keyRow-${flatRowKey}`}>{rowCells}</tr>;
    },
    [
      cellEditManager,
      editingCell,
      handleCellClick,
      handleCellSave,
      handleCellCancel,
      isEditingCell,
      tableOptions,
      onContextMenu,
      initialCols,
      initialRows,
      theme,
      aggregatorName,
      editableMetrics,
      metrics,
      metricsLayout,
      selectedRowKeys,
      onRowSelectionChange,
      redirectionUrls,
      rawFormData,
      dashboardFilters,
    ],
  );

  const renderTotalsRow = useCallback(
    pivotSettings => {
      const {
        rowAttrs,
        colAttrs,
        visibleColKeys,
        rowTotals,
        pivotData,
        colTotalCallbacks,
        grandTotalCallback,
      } = pivotSettings;

      const totalLabelCell = (
        <th
          key="label"
          className="pvtTotalLabel pvtRowTotalLabel"
          colSpan={rowAttrs.length + Math.min(colAttrs.length, 1) + (hasRowActions ? 1 : 0) + (hasRedirection ? 1 : 0)}
          role="columnheader button"
          onClick={clickHeaderHandler(
            pivotData,
            [],
            initialRows,
            0,
            tableOptions.clickRowHeaderCallback,
            false,
            true,
          )}
        >
          {t('Total (%(aggregatorName)s)', {
            aggregatorName: t(aggregatorName),
          })}
        </th>
      );

      const totalValueCells = visibleColKeys.map(colKey => {
        const flatColKey = flatKey(colKey);
        const agg = pivotData.getAggregator([], colKey);
        const originalValue = agg.value();
        const displayValue = cellEditManager.getValue(
          [],
          colKey,
          originalValue,
        );
        const isModified = cellEditManager.isModified([], colKey);
        const isEditing = isEditingCell([], colKey);

        // Determine the metric for total cells (if applicable).
        let metricForEditCheck = aggregatorName;
        const metricInColAttrs = initialCols.includes('Metric');

        if (metricInColAttrs) {
          const metricIndex = initialCols.indexOf('Metric');
          metricForEditCheck = colKey[metricIndex];
        } else if (metricsLayout === null && metrics && metrics.length > 0) {
          // Single metric mode, and 'Metric' is not a dimension
          const firstMetric = metrics[0];
          metricForEditCheck =
            typeof firstMetric === 'string' ? firstMetric : firstMetric.label;
        }

        const isEditableMetric =
          Array.isArray(editableMetrics) &&
          editableMetrics.includes(metricForEditCheck);

        const cellStyle = {
          padding: `${theme.sizeUnit}px`,
          ...(isModified
            ? {
                backgroundColor: '#ffd149ff',
                borderLeft: '3px solid #d48806',
              }
            : {}),
        };

        return (
          <td
            role="gridcell"
            className={`pvtTotal pvtRowTotal ${isModified ? 'modified-cell' : ''}`}
            key={`total-${flatColKey}`}
            onClick={
              isEditableMetric && !agg.isSubtotal && !agg.isGrandTotal
                ? handleCellClick([], colKey, originalValue)
                : colTotalCallbacks[flatColKey]
            }
            onContextMenu={e => onContextMenu(e, colKey, undefined)}
            style={cellStyle}
          >
            {isEditing &&
            isEditableMetric &&
            !agg.isSubtotal &&
            !agg.isGrandTotal ? (
              <EditableCell
                value={displayValue}
                onSave={newValue =>
                  handleCellSave([], colKey, originalValue, newValue)
                }
                onCancel={handleCellCancel}
                theme={theme}
              />
            ) : (
              <span
                title={
                  isModified
                    ? `Modified from ${originalValue} to ${displayValue}`
                    : ''
                }
              >
                {displayCell(agg.format(displayValue), allowRenderHtml)}
              </span>
            )}
          </td>
        );
      });

      let grandTotalCell = null;
      if (rowTotals) {
        const agg = pivotData.getAggregator([], []);
        const originalValue = agg.value();
        const displayValue = cellEditManager.getValue([], [], originalValue);
        const isModified = cellEditManager.isModified([], []);
        const isEditing = isEditingCell([], []);
        const isGrandTotalEditableMetric = false;

        const cellStyle = {
          padding: `${theme.sizeUnit}px`,
          ...(isModified
            ? {
                backgroundColor: '#ffd149ff',
                borderLeft: '3px solid #d48806',
              }
            : {}),
        };

        grandTotalCell = (
          <td
            role="gridcell"
            key="total"
            className={`pvtGrandTotal pvtRowTotal ${isModified ? 'modified-cell' : ''}`}
            onClick={
              isGrandTotalEditableMetric && !agg.isSubtotal && !agg.isGrandTotal
                ? handleCellClick([], [], originalValue)
                : grandTotalCallback
            }
            onContextMenu={e => onContextMenu(e, undefined, undefined)}
            style={cellStyle}
          >
            {isEditing &&
            isGrandTotalEditableMetric &&
            !agg.isSubtotal &&
            !agg.isGrandTotal ? (
              <EditableCell
                value={displayValue}
                onSave={newValue =>
                  handleCellSave([], [], originalValue, newValue)
                }
                onCancel={handleCellCancel}
                theme={theme}
              />
            ) : (
              <span
                title={
                  isModified
                    ? `Modified from ${originalValue} to ${displayValue}`
                    : ''
                }
              >
                {displayCell(agg.format(displayValue), allowRenderHtml)}
              </span>
            )}
          </td>
        );
      }

      const totalCells = [totalLabelCell, ...totalValueCells, grandTotalCell];

      return (
        <tr key="total" className="pvtRowTotals">
          {totalCells}
        </tr>
      );
    },
    [
      cellEditManager,
      editingCell,
      handleCellClick,
      handleCellSave,
      handleCellCancel,
      isEditingCell,
      tableOptions,
      onContextMenu,
      initialCols,
      initialRows,
      theme,
      aggregatorName,
      editableMetrics,
      metrics,
      metricsLayout,
      redirectionUrls,
    ],
  );

  const visibleKeys = useCallback(
    (keys, collapsed, numAttrs, subtotalDisplay) => {
      return keys.filter(
        key =>
          !key.some((k, j) => collapsed[flatKey(key.slice(0, j))]) &&
          (key.length === numAttrs ||
            flatKey(key) in collapsed ||
            !subtotalDisplay.hideOnExpand),
      );
    },
    [],
  );

  const {
    colAttrs,
    rowAttrs,
    rowKeys,
    colKeys,
    colTotals,
    rowSubtotalDisplay,
    colSubtotalDisplay,
  } = cachedBasePivotSettings;





  const visibleRowKeysRaw = visibleKeys(
    rowKeys,
    collapsedRows,
    rowAttrs.length,
    rowSubtotalDisplay,
  );
  
  const visibleColKeys = visibleKeys(
    colKeys,
    collapsedCols,
    colAttrs.length,
    colSubtotalDisplay,
  );

  const visibleRowKeys = useMemo(() => {
    if (Object.keys(filters).length === 0) return visibleRowKeysRaw;

    return visibleRowKeysRaw.filter(rowKey => {
       // Filter by Row Attributes
       const rowAttrMatch = rowAttrs.every((attr, i) => {
         const selectedValues = filters[attr];
         if (!selectedValues || selectedValues.length === 0) return true;
         // selectedValues is array, rowKey[i] is value
         return selectedValues.includes(String(rowKey[i] || ''));
       });
       if (!rowAttrMatch) return false;

       // Filter by Metric Columns
       return visibleColKeys.every(colKey => {
           const fKey = flatKey(colKey);
           const selectedValues = filters[fKey];
           if (!selectedValues || selectedValues.length === 0) return true;

           const agg = cachedBasePivotSettings.pivotData.getAggregator(rowKey, colKey);
           const val = agg.value();
           const formattedVal = agg.format(val);
           return selectedValues.includes(formattedVal);
       });
    });
  }, [visibleRowKeysRaw, filters, rowAttrs, visibleColKeys, cachedBasePivotSettings.pivotData]);

  const pivotSettings = {
    visibleRowKeys,
    maxRowVisible: Math.max(...visibleRowKeys.map(k => k.length)),
    visibleColKeys,
    maxColVisible: Math.max(...visibleColKeys.map(k => k.length)),
    // For row actions, we use a modified spanning logic to visually separate the table into distinct groups based on checkboxes.
    rowAttrSpans: (() => {
        if (
          hasRowActions ||
          (redirectionUrls && redirectionUrls.length > 0)
        ) {
            // Modified Spanning:
            // When grouping is enabled, we only want to span up to the action boundary.
            // This means checking `calcAttrSpans`, but forcing spans to reset when the unique combination (checkbox group) changes.
            let actionRowSpanIndex = rowAttrs.length - 1;
            if (rowAttrs.length > 0 && rowAttrs[actionRowSpanIndex] === 'Metric' && rowAttrs.length > 1) {
                actionRowSpanIndex = rowAttrs.length - 2;
            }
            
            const spans = calcAttrSpans(visibleRowKeys, rowAttrs.length);
            // We need to iterate through the calculated spans and adjust them so they don't cross checkbox boundaries.
            // A simpler approach is to treat the `actionRowSpanIndex` as the max depth for spanning continuity across groups.
            // Actually, if we just want horizontal lines separating the groups, the easiest way is to NOT allow ANY parent span
            // to be greater than the span at `actionRowSpanIndex`.
            
            for (let i = 0; i < spans.length; i++) {
                 const currentActionSpan = spans[i][actionRowSpanIndex];
                 if (currentActionSpan > 0) {
                      // This is the start of a new action group block.
                      // Its parent dimensions should span AT MOST `currentActionSpan`.
                      for (let j = 0; j <= actionRowSpanIndex; j++) {
                           if (spans[i][j] > currentActionSpan) {
                               spans[i][j] = currentActionSpan;
                           } else if (spans[i][j] === -1 && i > 0) {
                               // If it was supposed to be hidden (-1), we might need to reveal it if the previous block forced a break.
                               // We can check if the PREVIOUS row was the END of an action block.
                           }
                      }
                 }
            }
                
                const newSpans = [];
                let currentGroupKeys = [];
                
                for (let i = 0; i < visibleRowKeys.length; i++) {
                     // Check if this row is the start of a NEW action group
                     let isNewGroup = false;
                     if (currentGroupKeys.length > 0) {
                          const prevKey = currentGroupKeys[currentGroupKeys.length - 1];
                          const currKey = visibleRowKeys[i];
                          for (let j = 0; j <= actionRowSpanIndex; j++) {
                               if (currKey[j] !== prevKey[j]) {
                                    isNewGroup = true;
                                    break;
                               }
                          }
                     }
                     
                     if (isNewGroup) {
                          // Calculate spans for the current accumulated group
                          const groupSpans = calcAttrSpans(currentGroupKeys, rowAttrs.length);
                          newSpans.push(...groupSpans);
                          // Start a new group
                          currentGroupKeys = [visibleRowKeys[i]];
                     } else {
                          currentGroupKeys.push(visibleRowKeys[i]);
                     }
                     
                     // If it's the very last row, we need to process the remaining group
                     if (i === visibleRowKeys.length - 1 && currentGroupKeys.length > 0) {
                          const groupSpans = calcAttrSpans(currentGroupKeys, rowAttrs.length);
                          newSpans.push(...groupSpans);
                     }
                }
                
                return newSpans.length > 0 ? newSpans : calcAttrSpans(visibleRowKeys, rowAttrs.length);
        }
        return calcAttrSpans(visibleRowKeys, rowAttrs.length);
    })(),
    colAttrSpans: calcAttrSpans(visibleColKeys, colAttrs.length),
    allowRenderHtml,
    ...cachedBasePivotSettings,
  };

  const modifiedCellsStyle = css`
    .modified-cell {
      position: relative;
    }
    .modified-cell::after {
      content: '●';
      position: absolute;
      top: 2px;
      right: 4px;
      color: #ffc107;
      font-size: 8px;
    }
  `;




  useEffect(() => {
    if (onRegisterReset) {
      onRegisterReset(() => setFilters({}));
    }
  }, [onRegisterReset]);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters, onFilterChange]);
  

  return (
    <Styles isDashboardEditMode={isDashboardEditMode()}>
      <div css={modifiedCellsStyle}>
        <table className="pvtTable" role="grid">
          <thead>
            {colAttrs.map((c, j) => renderColHeaderRow(c, j, pivotSettings))}
            {rowAttrs.length !== 0 && renderRowHeaderRow(pivotSettings)}
          </thead>
          <tbody>
            {visibleRowKeys.map((r, i) => renderTableRow(r, i, pivotSettings))}
            {colTotals && renderTotalsRow(pivotSettings)}
          </tbody>
        </table>
      </div>
    </Styles>
  );
});

TableRenderer.propTypes = {
  ...PivotData.propTypes,
  tableOptions: PropTypes.object,
  onContextMenu: PropTypes.func,
  onCellEdit: PropTypes.func,
};

TableRenderer.defaultProps = {
  ...PivotData.defaultProps,
  tableOptions: {},
  onCellEdit: null,
};
