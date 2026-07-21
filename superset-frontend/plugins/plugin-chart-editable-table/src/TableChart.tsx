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
import {
  CSSProperties,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
} from 'react';

import { ColumnInstance, ColumnWithLooseAccessor, Row } from 'react-table';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import { FaSort } from '@react-icons/all-files/fa/FaSort';
import { FaSortDown as FaSortDesc } from '@react-icons/all-files/fa/FaSortDown';
import { FaSortUp as FaSortAsc } from '@react-icons/all-files/fa/FaSortUp';
import cx from 'classnames';
import {
  DataRecord,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  getSelectedText,
  getTimeFormatterForGranularity,
  BinaryQueryObjectFilterClause,
  SupersetClient,
} from '@superset-ui/core';
import {
  styled,
  css,
  useTheme,
  SupersetTheme,
} from '@apache-superset/core/theme';
import { t, tn } from '@apache-superset/core/translation';
import {
  Input,
  Space,
  RawAntdSelect as Select,
  Tooltip,
} from '@superset-ui/core/components';
import { Alert, Popover, notification, Dropdown, List, Spin } from 'antd';
import {
  CheckOutlined,
  InfoCircleOutlined,
  DownOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  TableOutlined,
  FilterOutlined,
  MenuOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { FilterPopover } from './FilterPopover';
import { isEmpty, debounce, isEqual } from 'lodash';
import buildQuery from './buildQuery';
import {
  ColorSchemeEnum,
  DataColumnMeta,
  SearchOption,
  SortByItem,
  TableChartTransformedProps,
  DatasourceColumn,
  DatasourceMetric,
  RedirectConfig,
} from './types';
import DataTable, {
  DataTableProps,
  SearchInputProps,
  SelectPageSizeRendererProps,
  SizeOption,
} from './DataTable';
import { Button } from 'antd'; // Add Button
import LayoutEditor from './LayoutEditor';
import { CellEditManager } from './CellEditManager';
import { transformPayload } from './utils/payloadTransform';
import { Modal } from 'antd';
import * as AntdIcons from '@ant-design/icons';
import SupersetDataForm from './components/SupersetDataForm';
import { getCustomSortKey, naturalSort } from './utils/sorting';
import {
  ChartLevelActionConfig,
  RowLevelActionConfig,
  HTMLViewerActionConfig,
} from './types/hierarchy';
import Handlebars from 'handlebars';

const renderIcon = (iconName: string) => {
  const Icon = (AntdIcons as any)[iconName];
  return Icon ? <Icon /> : null;
};

const RedirectionMenu = ({
  rowData,
  redirectionUrls,
  dimensionKeys,
  rawFormData,
  dashboardFilters,
}: {
  rowData: Record<string, any>;
  redirectionUrls: RedirectConfig[];
  dimensionKeys: Set<string>;
  rawFormData?: any;
  dashboardFilters?: Record<string, any>;
}) => {
  const handleRedirect = (config: RedirectConfig) => {
    let targetUrl = config.url?.trim() || '';
    const { addDimensionsAsParams, openInNewTab } = config;

    const safeBtoa = (str: string) => {
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
      targetUrl = targetUrl.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        encodeURIComponent(strVal),
      );
      targetUrl = targetUrl.replace(
        new RegExp(`\\{${key}\\}`, 'g'),
        encodeURIComponent(strVal),
      );
    });

    if (config.uniqueField) {
      const uniqueValue = rowData[config.uniqueField];
      if (uniqueValue !== undefined && uniqueValue !== null) {
        const separator = targetUrl.endsWith('/') ? '' : '/';
        targetUrl = `${targetUrl}${separator}${encodeURIComponent(String(uniqueValue))}`;
      }
    }

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
        if (
          dimensionKeys.has(key) &&
          val !== null &&
          val !== undefined &&
          typeof val !== 'object'
        ) {
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

  const menuContent = (
    <List
      size="small"
      dataSource={redirectionUrls}
      renderItem={(item: RedirectConfig) => (
        <List.Item
          style={{ cursor: 'pointer', padding: '2px 10px' }}
          onClick={() => handleRedirect(item)}
          className="redirection-menu-item"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1890ff',
            }}
          >
            <LinkOutlined style={{ color: '#1890ff' }} />
            <span style={{ color: '#1890ff', fontWeight: 500 }}>
              {item.label}
            </span>
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
        },
      }}
    >
      <Button size="small" type="text" icon={<MenuOutlined />} />
    </Popover>
  );
};

import Styles from './Styles';
import { formatColumnValue } from './utils/formatValue';
import { PAGE_SIZE_OPTIONS, SERVER_PAGE_SIZE_OPTIONS } from './consts';
import { updateTableOwnState } from './DataTable/utils/externalAPIs';
import getScrollBarSize from './DataTable/utils/getScrollBarSize';
import DateWithFormatter from './utils/DateWithFormatter';
import {
  getSortTypeByDataType,
  cellWidth,
  isColorDark,
  cellOffset,
  cellBackground,
  ValueRange,
} from './utils/helperUtils';

interface TableSize {
  width: number;
  height: number;
}

const ACTION_KEYS = {
  enter: 'Enter',
  spacebar: 'Spacebar',
  space: ' ',
};

/**
 * Cell background width calculation for horizontal bar chart
 */

const EditorContainer = styled.div`
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: auto;
  min-height: calc(100% + 10px);
  z-index: 100;
  background: ${({ theme }: { theme: SupersetTheme }) =>
    theme.colorBgContainer};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid
    ${({ theme }: { theme: SupersetTheme }) => theme.colorPrimary};
  border-radius: ${({ theme }: { theme: SupersetTheme }) =>
    theme.borderRadius}px;
  padding: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
`;

const StyledInput = styled(Input)`
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  margin: 0;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  box-shadow: none;
  &:focus {
    box-shadow: none;
    border: none;
    outline: none;
  }
`;

// EditableCell Component
const EditableCell = ({
  value: initialValue,
  row: { index, original },
  columnId, // passed explicitly
  column, // DataColumnMeta
  updateMyData,
  textAlign,
}: any) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onChange = (e: any) => {
    setValue(e.target.value);
  };

  const onBlur = () => {
    updateMyData(index, columnId, value, original);
    setIsEditing(false);
  };

  const onKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      onBlur();
    }
  };

  const isModified = String(value) !== String(original[columnId]);
  const isDarkMode = theme.colorBgBase ? isColorDark(theme.colorBgBase) : false;

  // Dark mode colors matching Pivot Table implementation
  const modBg = isDarkMode ? '#cfaf2fff' : '#ffd149ff';
  const defaultBg = isDarkMode ? '#2d2d14' : '#FFFBE6';

  const backgroundColor = isModified ? modBg : defaultBg;
  const borderLeft = isModified ? '3px solid #d48806' : undefined;
  // Format value for display
  let displayValue = value;
  if (column && formatColumnValue) {
    const [_, text] = formatColumnValue(column, value);
    displayValue = text;
  }

  return (
    <td
      onClick={() => setIsEditing(true)}
      className="editable-cell"
      style={{
        cursor: 'pointer',
        backgroundColor: isEditing ? undefined : backgroundColor,
        borderLeft: isEditing ? undefined : borderLeft,
        position: 'relative',
        textAlign: textAlign as any,
        color:
          isDarkMode && (isModified || column?.isMetric)
            ? '#FFFBE6'
            : column?.isMetric
              ? theme.colorPrimary
              : undefined,
      }}
    >
      {isEditing ? (
        <EditorContainer>
          <StyledInput
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            autoFocus
            className="editable-cell-input"
            style={{ textAlign: textAlign as any }}
          />
        </EditorContainer>
      ) : (
        displayValue
      )}
    </td>
  );
};

/**
 * Cell left margin (offset) calculation for horizontal bar chart elements
 * when alignPositiveNegative is not set
 */

/**
 * Cell background color calculation for horizontal bar chart
 */

function SortIcon<D extends object>({ column }: { column: ColumnInstance<D> }) {
  const { isSorted, isSortedDesc } = column;
  let sortIcon = <FaSort />;
  if (isSorted) {
    sortIcon = isSortedDesc ? <FaSortDesc /> : <FaSortAsc />;
  }
  return sortIcon;
}

function SearchInput({
  count,
  value,
  onChange,
  onBlur,
  inputRef,
}: SearchInputProps) {
  return (
    <Space direction="horizontal" size={4} className="dt-global-filter">
      {t('Search')}
      <Input
        aria-label={t('Search %s records', count)}
        placeholder={tn('%s record', '%s records...', count, count)}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        ref={inputRef}
      />
    </Space>
  );
}

const VisuallyHidden = styled.label`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

function SelectPageSize({
  options,
  current,
  onChange,
}: SelectPageSizeRendererProps) {
  const { Option } = Select;

  return (
    <>
      <VisuallyHidden htmlFor="pageSizeSelect">
        {t('Select page size')}
      </VisuallyHidden>
      {t('Show')}{' '}
      <Select<number>
        id="pageSizeSelect"
        value={current}
        onChange={value => onChange(value)}
        size="small"
        css={(theme: SupersetTheme) => css`
          width: ${theme.sizeUnit * 18}px;
        `}
        aria-label={t('Show entries')}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option)
            ? option
            : [option, option];
          return (
            <Option key={size} value={Number(size)}>
              {text}
            </Option>
          );
        })}
      </Select>{' '}
      {t('entries')}
    </>
  );
}

const getNoResultsMessage = (filter: string) =>
  filter ? t('No matching records found') : t('No records found');

export default function TableEditableChart<D extends DataRecord = DataRecord>(
  props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
  },
) {
  const {
    timeGrain,
    height,
    width,
    data,
    totals,
    isRawRecords,
    rowCount = 0,
    columns: rawColumnsMeta,
    alignPositiveNegative: defaultAlignPN = false,
    colorPositiveNegative: defaultColorPN = false,
    includeSearch = false,
    pageSize = 0,
    serverPagination = false,
    serverPaginationData,
    setDataMask,
    showCellBars = true,
    sortDesc = false,
    filters: dashboardFilters,
    sticky = true, // whether to use sticky header
    columnColorFormatters,
    allowRearrangeColumns = false,
    allowRenderHtml = true,
    onContextMenu,
    emitCrossFilters,
    isUsingTimeComparison,
    basicColorFormatters,
    basicColorColumnFormatters,
    hasServerPageLengthChanged,
    serverPageLength,
    slice_id,
    datasourceId,
    datasourceType,
    allColumns,
    backendApiUrl,
    editableMetrics,
    datasource,
    groupbyRows,
    isRefreshing,
    hierarchyFields = [],
    chartLevelActions = [],
    rowLevelActions = [],
    excludeOptionFilter = false,
    cellEditPayloadMapping,
    redirectionUrls = [],
    globalRedirectionUrls = [],
    rawFormData,
    enableLayout,
    metrics = [],
    htmlViewerActions = [],
    validationError,
  } = props;
  // Layout Editor State
  const [layoutItems, setLayoutItems] = useState<string[]>(
    // Initialize based on mode: Raw -> 'columns' (if available, mostly just allColumns), Agg -> 'groupbyRows'
    props.isRawRecords
      ? props.columns?.map(c => c.key) || []
      : props.groupbyRows?.map(c => c.label || c) || [],
  );

  const [fetchedColumns, setFetchedColumns] = useState<DatasourceColumn[]>([]);
  const [fetchedMetrics, setFetchedMetrics] = useState<DatasourceMetric[]>([]);

  useEffect(() => {
    if (validationError) {
      notification.error({
        message: t('Validation Error'),
        description: validationError,
        duration: 10,
      });
    }
  }, [validationError]);

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

  // Fix: Patch column labels using fetched metrics logic
  const columnsMeta = useMemo(() => {
    if (!fetchedMetrics || fetchedMetrics.length === 0) return rawColumnsMeta;

    const metricMap = new Map<string, string>();
    fetchedMetrics.forEach(m =>
      metricMap.set(m.metric_name, m.verbose_name || m.metric_name),
    );

    return rawColumnsMeta.map(col => {
      if (col.isMetric || col.isPercentMetric) {
        let lookupKey = col.key;
        if (col.isPercentMetric && col.key.startsWith('%')) {
          lookupKey = col.key.substring(1);
        }

        if (metricMap.has(lookupKey)) {
          const verbose = metricMap.get(lookupKey);
          if (verbose) {
            if (col.isPercentMetric) {
              // Preserve existing config but update label
              return { ...col, label: `%${verbose}` };
            }
            return { ...col, label: verbose };
          }
        }
      }
      return col;
    });
  }, [rawColumnsMeta, fetchedMetrics]);

  const dimensionKeys = useMemo(() => {
    return new Set(
      columnsMeta
        .filter(col => !col.isMetric && !col.isPercentMetric)
        .map(col => col.key),
    );
  }, [columnsMeta]);

  // Dependent Filtering State
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);

  // Map columns for easy lookup to access formatters
  const columnMap = useMemo(() => {
    return columnsMeta.reduce(
      (acc, col) => {
        acc[col.key] = col;
        return acc;
      },
      {} as Record<string, DataColumnMeta>,
    );
  }, [columnsMeta]);

  // -- Cell Edit Manager Setup --
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const isDarkMode = theme.colorBgBase ? isColorDark(theme.colorBgBase) : false;
  const [notificationApi, contextHolder] = notification.useNotification();

  const cellEditManager = useMemo(() => {
    const groupby = groupbyRows || [];
    return new CellEditManager(
      data,
      backendApiUrl,
      editableMetrics,
      notificationApi,
      datasource,
      groupby as string[],
      cellEditPayloadMapping,
    );
  }, [
    backendApiUrl,
    editableMetrics,
    data,
    notificationApi,
    datasource,
    groupbyRows,
    cellEditPayloadMapping,
  ]);

  // Update data ref when data changes (e.g. valid re-query)
  useEffect(() => {
    cellEditManager.data = data;
  }, [data, cellEditManager]);

  useEffect(() => {
    const listener = () => setForceUpdate(prev => prev + 1);
    cellEditManager.addChangeListener(listener);
    return () => cellEditManager.removeChangeListener(listener);
  }, [cellEditManager]);

  // Action Modal State
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<
    ChartLevelActionConfig | RowLevelActionConfig | null
  >(null);
  const [currentRow, setCurrentRow] = useState<Record<string, any> | undefined>(
    undefined,
  );
  const [selectedRowData, setSelectedRowData] = useState<
    Map<string, Record<string, any>>
  >(new Map());

  // HTML Template Viewer Action State
  const [htmlModalVisible, setHtmlModalVisible] = useState(false);
  const [currentHtmlAction, setCurrentHtmlAction] =
    useState<HTMLViewerActionConfig | null>(null);

  const hasUniqueField = useMemo(
    () =>
      rowLevelActions?.some(action => action.uniqueField) ||
      htmlViewerActions?.some(
        action => action.onlySelectedRow && action.uniqueField,
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

    if ('prefillFromRow' in action && action.prefillFromRow) {
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
    }

    setCurrentAction(action);
    setCurrentRow(actionRowData);
    setActionModalVisible(true);
  };

  const handleCloseModal = () => {
    setActionModalVisible(false);
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

  const handleFormSubmit = async (formVals: Record<string, any>) => {
    if (!currentAction) return;
    setIsSaving(true);
    try {
      let endpoint = currentAction.apiEndpoint?.trim() || '';
      if ('uniqueField' in currentAction && currentAction.uniqueField) {
        let uniqueValue = currentRow?.[currentAction.uniqueField];
        if (uniqueValue === undefined && selectedRowData.size > 0) {
          const firstRow = Array.from(selectedRowData.values())[0];
          uniqueValue = firstRow?.[currentAction.uniqueField];
        }
        if (uniqueValue !== undefined && uniqueValue !== null) {
          const separator = endpoint.endsWith('/') ? '' : '/';
          endpoint = `${endpoint}${separator}${uniqueValue}`;
        }
      }
      const isAbsoluteUrl =
        endpoint.startsWith('http://') || endpoint.startsWith('https://');

      let payload: any = {
        ...formVals,
      };

      if (currentAction.payloadMapping) {
        try {
          const mapping = JSON.parse(currentAction.payloadMapping);
          payload = transformPayload(payload, mapping);
        } catch (e) {
          console.error('Error parsing action payloadMapping:', e);
        }
      }

      const containsFile = Object.values(formVals).some(
        val =>
          val instanceof File ||
          (Array.isArray(val) && val.some(v => v instanceof File)),
      );

      let requestBody: any = JSON.stringify(payload);
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (containsFile) {
        const formData = new FormData();

        // 1. Append files directly to the root of the FormData
        Object.entries(formVals).forEach(([key, val]) => {
          if (val instanceof File) {
            formData.append(key, val, val.name);
          } else if (Array.isArray(val)) {
            val.forEach(item => {
              if (item instanceof File) {
                formData.append(key, item, item.name);
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
            formData.append(key, JSON.stringify(val));
          } else if (val !== undefined && val !== null) {
            formData.append(key, String(val));
          }
        });

        requestBody = formData;
        headers = {}; // Let browser define Content-Type with boundary automatically
      }

      const hasUniqueFieldOnAction = !!(
        'uniqueField' in currentAction && currentAction.uniqueField
      );
      const method = hasUniqueFieldOnAction ? 'PUT' : 'POST';

      if (isAbsoluteUrl) {
        const response = await fetch(endpoint, {
          method: method,
          headers: headers,
          body: requestBody,
        });

        if (!response.ok) {
          throw new Error(`API Request failed with status ${response.status}`);
        }
      } else {
        if (containsFile) {
          if (hasUniqueFieldOnAction) {
            await SupersetClient.put({
              endpoint: endpoint,
              body: requestBody,
              headers: { Accept: 'application/json' },
            });
          } else {
            await SupersetClient.post({
              endpoint: endpoint,
              body: requestBody,
              headers: { Accept: 'application/json' },
            });
          }
        } else {
          if (hasUniqueFieldOnAction) {
            await SupersetClient.put({
              endpoint: endpoint,
              jsonPayload: payload,
            });
          } else {
            await SupersetClient.post({
              endpoint: endpoint,
              jsonPayload: payload,
            });
          }
        }
      }

      notificationApi.success({
        message: 'Success',
        description: 'Action submitted successfully.',
      });

      setActionModalVisible(false);
      setSelectedRowData(new Map());

      // Trigger refresh
      setTimeout(async () => {
        try {
          const baseQueryContext = buildQuery(props.rawFormData as any);
          const queryContext = { ...baseQueryContext, force: true };

          await SupersetClient.post({
            endpoint: '/api/v1/chart/data',
            jsonPayload: {
              datasource: { id: datasourceId, type: datasourceType },
              queries: queryContext.queries,
              force: true,
              form_data: props.rawFormData,
              result_format: 'json',
              result_type: 'full',
            },
          });
        } catch (e) {
          console.error('Force refresh failed', e);
        }

        setDataMask({
          ownState: {
            forceRefresh: Date.now(),
          },
        });
      }, 2000);
    } catch (err: any) {
      console.error('Action submission failed', err);
      notificationApi.error({
        message: 'Error',
        description: err.message || 'Submission failed',
      });
    } finally {
      setIsSaving(false);
    }
  };
  const updateMyData = useCallback(
    (rowIndex: number, columnId: string, value: any, record: any) => {
      const originalValue = record[columnId];
      let newValue = value;
      const col = columnMap[columnId];
      if (col && (col.isNumeric || col.isMetric || col.isPercentMetric)) {
        const numVal = Number(value);
        if (!isNaN(numVal) && value !== '') {
          newValue = numVal;
        }
      }
      cellEditManager.setValue(
        rowIndex,
        columnId,
        originalValue,
        newValue,
        record,
      );
    },
    [cellEditManager, columnMap],
  );
  // -- End Cell Edit Manager Setup --

  const handleGlobalRedirect = (config: RedirectConfig) => {
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

    // 4. Process dashboardFilters (filterState/cross-filters)
    if (dashboardFilters && Object.keys(dashboardFilters).length > 0) {
      Object.entries(dashboardFilters).forEach(([key, val]) => {
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

  const comparisonColumns = [
    { key: 'all', label: t('Display all') },
    { key: '#', label: '#' },
    { key: '△', label: '△' },
    { key: '%', label: '%' },
  ];
  const timestampFormatter = useCallback(
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
  );

  const handleFilterChange = useCallback(
    (key: string, selections: string[]) => {
      setColumnFilters(prev => ({
        ...prev,
        [key]: selections,
      }));
      setActiveFilterMenu(null);
    },
    [],
  );

  const filteredData = useMemo(() => {
    if (!columnFilters || Object.keys(columnFilters).length === 0) return data;
    return data.filter(record => {
      for (const [key, selectedValues] of Object.entries(columnFilters)) {
        if (selectedValues && selectedValues.length > 0) {
          let val = String(record[key as keyof D]);
          const col = columnMap[key];
          if (col) {
            val = formatColumnValue(col, record[key as keyof D])[1];
          }
          if (!selectedValues.includes(val)) return false;
        }
      }
      return true;
    });
  }, [data, columnFilters, columnMap]);

  const getUniqueValues = useCallback(
    (key: string) => {
      const uniqueValues = new Set<string>();

      const matchesOtherFilters = (record: D) => {
        for (const [filterKey, selectedValues] of Object.entries(
          columnFilters,
        )) {
          if (filterKey === key) continue; // Skip current filter
          if (selectedValues && selectedValues.length > 0) {
            let val = String(record[filterKey as keyof D]);
            const col = columnMap[filterKey];
            if (col) {
              val = formatColumnValue(col, record[filterKey as keyof D])[1];
            }
            if (!selectedValues.includes(val)) return false;
          }
        }
        return true;
      };

      data.forEach(record => {
        if (matchesOtherFilters(record)) {
          const rawVal = record[key as keyof D];
          if (rawVal !== undefined && rawVal !== null) {
            const col = columnMap[key];
            const formattedVal = col
              ? formatColumnValue(col, rawVal)[1]
              : String(rawVal);
            uniqueValues.add(formattedVal);
          }
        }
      });

      return Array.from(uniqueValues).sort();
    },
    [data, columnFilters, columnMap],
  );

  const activeUniqueValues = useMemo(() => {
    if (!activeFilterMenu) return [];
    return getUniqueValues(activeFilterMenu);
  }, [activeFilterMenu, getUniqueValues]);

  useEffect(() => {
    if (datasourceId && datasourceType) {
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${datasourceId}`,
      })
        .then(({ json }: { json: any }) => {
          const columns =
            json.result?.columns?.map((col: any) => ({
              column_name: col.column_name,
              groupby: col.groupby,
              verbose_name: col.verbose_name,
              expression: col.expression,
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
        .catch((err: any) => {
          console.error('Failed to fetch datasource metadata', err);
        });
    }
  }, [datasourceId, datasourceType]);

  const layoutAvailableColumns =
    fetchedColumns.length > 0 ? fetchedColumns : allColumns || [];

  const [isLayoutEditorVisible, setIsLayoutEditorVisible] = useState(false);

  useEffect(() => {
    if (props.isRawRecords) {
      if (props.columns) setLayoutItems(props.columns.map(c => c.key));
    } else {
      if (props.groupbyRows) {
        setLayoutItems(props.groupbyRows.map(c => c.label || c));
      }
    }
  }, [props.groupbyRows, props.columns, props.isRawRecords]);

  // handleSaveLayout
  const handleSaveLayout = (
    newItems: string[],
    _newCols: string[],
    newMetrics?: string[],
  ) => {
    setLayoutItems(newItems);
    setIsLayoutEditorVisible(false);

    const newDataMask: any = {
      ownState: {
        _trigger: Date.now(),
      },
    };

    if (props.isRawRecords) {
      // In Raw Records, we update 'columns' (or 'all_columns') to reflect visibility/order
      newDataMask.ownState.columns = newItems;
      if (props.setControlValue) {
        props.setControlValue('all_columns', newItems);
      }
    } else {
      // In Aggregation, we update 'groupbyRows' with the single list, and clear 'groupbyColumns'
      newDataMask.ownState.groupbyRows = newItems;
      newDataMask.ownState.groupbyColumns = []; // Force empty cols as requested
      if (props.setControlValue) {
        props.setControlValue('groupby', newItems);
      }
    }

    if (newMetrics) {
      newDataMask.ownState.metrics = newMetrics;
      if (props.setControlValue) {
        props.setControlValue('metrics', newMetrics);
      }
    }

    setDataMask(newDataMask);

    // Auto-Save to Backend
    if (props.slice_id && props.rawFormData) {
      const updatedFormData = { ...props.rawFormData };

      if (props.isRawRecords) {
        updatedFormData.all_columns = newItems;
        updatedFormData.columns = newItems; // ensure legacy field is also updated if needed
      } else {
        updatedFormData.groupby = newItems;
        updatedFormData.metrics =
          newMetrics || props.ownState?.metrics || props.rawFormData.metrics;
        // Clean up potentially conflicting fields if switching configs?
        // For now assume we just update what we touch.
      }

      const queryContext = buildQuery(updatedFormData as any);

      SupersetClient.put({
        endpoint: `/api/v1/chart/${props.slice_id}`,
        jsonPayload: {
          params: JSON.stringify(updatedFormData),
          query_context: JSON.stringify(queryContext),
        },
      })
        .then(() => {
          console.log('Chart layout saved successfully.');
          notificationApi.success({
            message: 'Success',
            description: 'Chart layout saved successfully.',
          });
        })
        .catch((err: any) => {
          console.error('Failed to save chart layout:', err);
          notificationApi.error({
            message: 'Error',
            description: 'Unable to save layout changes. Please try again.',
          });
        });
    }
  };

  const [tableSize, setTableSize] = useState<TableSize>({
    width: 0,
    height: 0,
  });
  // keep track of whether column order changed, so that column widths can too

  const [columnOrderToggle, setColumnOrderToggle] = useState(false);
  const [showComparisonDropdown, setShowComparisonDropdown] = useState(false);
  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns[0].key,
  ]);
  const [hideComparisonKeys, setHideComparisonKeys] = useState<string[]>([]);

  // only take relevant page size options
  const pageSizeOptions = useMemo(() => {
    const getServerPagination = (n: number) => n <= rowCount;
    return (
      serverPagination ? SERVER_PAGE_SIZE_OPTIONS : PAGE_SIZE_OPTIONS
    ).filter(([n]: [number, any]) =>
      serverPagination ? getServerPagination(n) : n <= 2 * (data?.length || 0),
    ) as SizeOption[];
  }, [data?.length, rowCount, serverPagination]);

  const getValueRange = useCallback(
    function getValueRange(key: string, alignPositiveNegative: boolean) {
      const nums = data
        ?.map(row => row?.[key])
        .filter((value: any) => typeof value === 'number') as number[];
      if (data && nums.length === data.length) {
        return (
          alignPositiveNegative
            ? [0, d3Max(nums.map(Math.abs))]
            : d3Extent(nums)
        ) as ValueRange;
      }
      return null;
    },
    [data],
  );

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!dashboardFilters && dashboardFilters[key]?.includes(val);
    },
    [dashboardFilters],
  );

  const getCrossFilterDataMask = (key: string, value: DataRecordValue) => {
    let updatedFilters = { ...(dashboardFilters || {}) };
    if (dashboardFilters && isActiveFilterValue(key, value)) {
      updatedFilters = {};
    } else {
      updatedFilters = {
        [key]: [value],
      };
    }
    if (
      Array.isArray(updatedFilters[key]) &&
      updatedFilters[key].length === 0
    ) {
      delete updatedFilters[key];
    }

    const groupBy = Object.keys(updatedFilters);
    const groupByValues = Object.values(updatedFilters);
    const labelElements: string[] = [];
    groupBy.forEach(col => {
      const isTimestamp = col === DTTM_ALIAS;
      const filterValues = ensureIsArray(updatedFilters?.[col]);
      if (filterValues.length) {
        const valueLabels = filterValues.map(value =>
          isTimestamp ? timestampFormatter(value) : value,
        );
        labelElements.push(`${valueLabels.join(', ')}`);
      }
    });

    return {
      dataMask: {
        extraFormData: {
          filters:
            groupBy.length === 0
              ? []
              : groupBy.map(col => {
                  const val = ensureIsArray(updatedFilters?.[col]);
                  if (!val.length)
                    return {
                      col,
                      op: 'IS NULL' as const,
                    };
                  return {
                    col,
                    op: 'IN' as const,
                    val: val.map(el =>
                      el instanceof Date ? el.getTime() : el!,
                    ),
                    grain: col === DTTM_ALIAS ? timeGrain : undefined,
                  };
                }),
        },
        filterState: {
          label: labelElements.join(', '),
          value: groupByValues.length ? groupByValues : null,
          filters:
            updatedFilters && Object.keys(updatedFilters).length
              ? updatedFilters
              : null,
        },
      },
      isCurrentValueSelected: isActiveFilterValue(key, value),
    };
  };

  const toggleFilter = useCallback(
    function toggleFilter(key: string, val: DataRecordValue) {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(key, val).dataMask);
    },
    [emitCrossFilters, getCrossFilterDataMask, setDataMask],
  );

  const getSharedStyle = (column: DataColumnMeta): CSSProperties => {
    const { isNumeric, config = {} } = column;
    const textAlign =
      config.horizontalAlign ||
      (isNumeric && !isUsingTimeComparison ? 'right' : 'left');
    return {
      textAlign,
    };
  };

  const comparisonLabels = [t('Main'), '#', '△', '%'];
  const filteredColumnsMeta = useMemo(() => {
    if (!isUsingTimeComparison) {
      return columnsMeta;
    }
    const allColumns = comparisonColumns[0].key;
    const main = comparisonLabels[0];
    const showAllColumns = selectedComparisonColumns.includes(allColumns);

    return columnsMeta.filter(({ label, key }) => {
      // Extract the key portion after the space, assuming the format is always "label key"
      const keyPortion = key.substring(label.length);
      const isKeyHidded = hideComparisonKeys.includes(keyPortion);
      const isLableMain = label === main;

      return (
        isLableMain ||
        (!isKeyHidded &&
          (!comparisonLabels.includes(label) ||
            showAllColumns ||
            selectedComparisonColumns.includes(label)))
      );
    });
  }, [
    columnsMeta,
    comparisonColumns,
    comparisonLabels,
    isUsingTimeComparison,
    hideComparisonKeys,
    selectedComparisonColumns,
  ]);

  const handleContextMenu =
    onContextMenu && !isRawRecords
      ? (
          value: D,
          cellPoint: {
            key: string;
            value: DataRecordValue;
            isMetric?: boolean;
          },
          clientX: number,
          clientY: number,
        ) => {
          const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
          filteredColumnsMeta.forEach(col => {
            if (!col.isMetric) {
              const dataRecordValue = value[col.key];
              drillToDetailFilters.push({
                col: col.key,
                op: '==',
                val: dataRecordValue as string | number | boolean,
                formattedVal: formatColumnValue(col, dataRecordValue)[1],
              });
            }
          });
          onContextMenu(clientX, clientY, {
            drillToDetail: drillToDetailFilters,
            crossFilter: cellPoint.isMetric
              ? undefined
              : getCrossFilterDataMask(cellPoint.key, cellPoint.value),
            drillBy: cellPoint.isMetric
              ? undefined
              : {
                  filters: [
                    {
                      col: cellPoint.key,
                      op: '==',
                      val: cellPoint.value as string | number | boolean,
                    },
                  ],
                  groupbyFieldName: 'groupby',
                },
          });
        }
      : undefined;

  const getHeaderColumns = (
    columnsMeta: DataColumnMeta[],
    enableTimeComparison?: boolean,
  ) => {
    const resultMap: Record<string, number[]> = {};

    if (!enableTimeComparison) {
      return resultMap;
    }

    columnsMeta.forEach((element, index) => {
      // Check if element's label is one of the comparison labels
      if (comparisonLabels.includes(element.label)) {
        // Extract the key portion after the space, assuming the format is always "label key"
        const keyPortion = element.key.substring(element.label.length);

        // If the key portion is not in the map, initialize it with the current index
        if (!resultMap[keyPortion]) {
          resultMap[keyPortion] = [index];
        } else {
          // Add the index to the existing array
          resultMap[keyPortion].push(index);
        }
      }
    });

    return resultMap;
  };

  const renderTimeComparisonDropdown = (): JSX.Element => {
    const allKey = comparisonColumns[0].key;
    const handleOnClick = (data: any) => {
      const { key } = data;
      // Toggle 'All' key selection
      if (key === allKey) {
        setSelectedComparisonColumns([allKey]);
      } else if (selectedComparisonColumns.includes(allKey)) {
        setSelectedComparisonColumns([key]);
      } else {
        // Toggle selection for other keys
        setSelectedComparisonColumns(
          selectedComparisonColumns.includes(key)
            ? selectedComparisonColumns.filter(k => k !== key) // Deselect if already selected
            : [...selectedComparisonColumns, key],
        ); // Select if not already selected
      }
    };

    const handleOnBlur = () => {
      if (selectedComparisonColumns.length === 3) {
        setSelectedComparisonColumns([comparisonColumns[0].key]);
      }
    };

    return (
      <Dropdown
        placement="bottomRight"
        open={showComparisonDropdown}
        onOpenChange={(flag: boolean) => {
          setShowComparisonDropdown(flag);
        }}
        menu={{
          multiple: true,
          onClick: handleOnClick,
          onBlur: handleOnBlur,
          selectedKeys: selectedComparisonColumns,
          items: [
            {
              key: 'comparison_group',
              label: (
                <div
                  css={css`
                    max-width: 242px;
                    padding: 0 ${theme.sizeUnit * 2}px;
                    color: ${theme.colorText};
                    font-size: ${theme.fontSizeSM}px;
                  `}
                >
                  {t(
                    'Select columns that will be displayed in the table. You can multiselect columns.',
                  )}
                </div>
              ),
              type: 'group',
              children: comparisonColumns.map(
                (column: { key: string; label: string }) => ({
                  key: column.key,
                  label: (
                    <>
                      <span
                        css={css`
                          color: ${theme.colorText};
                        `}
                      >
                        {column.label}
                      </span>
                      <span
                        css={css`
                          float: right;
                          font-size: ${theme.fontSizeSM}px;
                        `}
                      >
                        {selectedComparisonColumns.includes(column.key) && (
                          <CheckOutlined />
                        )}
                      </span>
                    </>
                  ),
                }),
              ),
            },
          ],
        }}
        trigger={['click']}
      >
        <span>
          <TableOutlined /> <DownOutlined />
        </span>
      </Dropdown>
    );
  };

  const renderGroupingHeaders = (): JSX.Element => {
    // TODO: Make use of ColumnGroup to render the aditional headers
    const headers: any = [];
    let currentColumnIndex = 0;

    Object.entries(groupHeaderColumns || {}).forEach(([key, value]) => {
      // Calculate the number of placeholder columns needed before the current header
      const startPosition = value[0];
      const colSpan = value.length;
      // Retrieve the originalLabel from the first column in this group
      const firstColumnInGroup = filteredColumnsMeta[startPosition];
      const originalLabel = firstColumnInGroup
        ? columnsMeta.find(col => col.key === firstColumnInGroup.key)
            ?.originalLabel || key
        : key;

      // Add placeholder <th> for columns before this header
      for (let i = currentColumnIndex; i < startPosition; i += 1) {
        headers.push(
          <th
            key={`placeholder-${i}`}
            style={{ borderBottom: 0 }}
            aria-label={`Header-${i}`}
          />,
        );
      }

      // Add the current header <th>
      headers.push(
        <th key={`header-${key}`} colSpan={colSpan} style={{ borderBottom: 0 }}>
          {originalLabel}
          <span
            css={css`
              float: right;
              & svg {
                color: ${theme.colorIcon} !important;
              }
            `}
          >
            {hideComparisonKeys.includes(key) ? (
              <PlusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys(
                    hideComparisonKeys.filter(k => k !== key),
                  )
                }
              />
            ) : (
              <MinusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys([...hideComparisonKeys, key])
                }
              />
            )}
          </span>
        </th>,
      );

      // Update the current column index
      currentColumnIndex = startPosition + colSpan;
    });

    return (
      <tr
        css={css`
          th {
            border-right: 1px solid ${theme.colorSplit};
          }
          th:first-of-type {
            border-left: none;
          }
          th:last-child {
            border-right: none;
          }
        `}
      >
        {headers}
      </tr>
    );
  };

  const groupHeaderColumns = useMemo(
    () => getHeaderColumns(filteredColumnsMeta, isUsingTimeComparison),
    [filteredColumnsMeta, isUsingTimeComparison],
  );

  const getColumnConfigs = useCallback(
    (
      column: DataColumnMeta,
      i: number,
    ): ColumnWithLooseAccessor<D> & {
      columnKey: string;
    } => {
      const {
        key,
        label: originalLabel,
        isNumeric,
        dataType,
        isMetric,
        isPercentMetric,
        config = {},
      } = column;
      const label = config.customColumnName || originalLabel;
      let displayLabel = label;

      const isComparisonColumn = ['#', '△', '%', t('Main')].includes(
        column.label,
      );

      if (isComparisonColumn) {
        if (column.label === t('Main')) {
          displayLabel = config.customColumnName || column.originalLabel || '';
        } else if (config.customColumnName) {
          displayLabel =
            config.displayTypeIcon !== false
              ? `${column.label} ${config.customColumnName}`
              : config.customColumnName;
        } else if (config.displayTypeIcon === false) {
          displayLabel = '';
        }
      }

      const columnWidth = Number.isNaN(Number(config.columnWidth))
        ? config.columnWidth
        : Number(config.columnWidth);

      // inline style for both th and td cell
      const sharedStyle: CSSProperties = getSharedStyle(column);

      const alignPositiveNegative =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;
      const colorPositiveNegative =
        config.colorPositiveNegative === undefined
          ? defaultColorPN
          : config.colorPositiveNegative;

      const { truncateLongCells } = config;

      const hasColumnColorFormatters =
        isNumeric &&
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;

      const hasBasicColorFormatters =
        isUsingTimeComparison &&
        Array.isArray(basicColorFormatters) &&
        basicColorFormatters.length > 0;
      const valueRange =
        !hasBasicColorFormatters &&
        !hasColumnColorFormatters &&
        (config.showCellBars === undefined
          ? showCellBars
          : config.showCellBars) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRange(key, alignPositiveNegative);

      let className = '';
      if (emitCrossFilters && !isMetric) {
        className += ' dt-is-filter';
      }

      if (!isMetric && !isPercentMetric) {
        className += ' right-border-only';
      } else if (comparisonLabels.includes(label)) {
        const groupinHeader = key.substring(label.length);
        const columnsUnderHeader = groupHeaderColumns[groupinHeader] || [];
        if (i === columnsUnderHeader[columnsUnderHeader.length - 1]) {
          className += ' right-border-only';
        }
      }

      return {
        id: String(i), // to allow duplicate column keys
        // must use custom accessor to allow `.` in column names
        // typing is incorrect in current version of `@types/react-table`
        // so we ask TS not to check.
        columnKey: key,
        accessor: ((datum: D) => datum[key]) as never,
        Cell: ({
          value,
          row,
          column: cellColumn,
        }: {
          value: DataRecordValue;
          row: Row<D>;
          column: any;
        }) => {
          // Check if editable
          const isEditableMetric =
            editableMetrics?.includes(key) || editableMetrics?.includes(label);

          // Format value for all cells first (needed for EditableCell non-edit view too)
          const [isHtml, text] = formatColumnValue(column, value);
          const formattedValue = text; // Just text for now, assuming no HTML in editable numbers

          if (
            isEditableMetric &&
            !isUsingTimeComparison &&
            !isComparisonColumn
          ) {
            const textAlign = sharedStyle.textAlign || 'left';
            return (
              <EditableCell
                value={cellEditManager.getValue(row.index, key, value)}
                formattedValue={
                  cellEditManager.isModified(row.index, key)
                    ? undefined
                    : formattedValue
                } // Use formatted only if not modified (modified shows raw input for now, or we could format it too but input needs raw)
                // Actually, for display:
                // If not editing, show formattedValue.
                // But if modified, the value in manager is the NEW value. We might want to format that too?
                // formatColumnValue uses 'column' meta which might rely on d3 formatter.
                // Let's pass the raw value to formattedValue if it matches original, otherwise we might need to format the new value.
                // Simplification: Pass formatColumnValue function or just let EditableCell handle it?
                // Better: The 'value' passed to EditableCell is the *current* value (from manager).
                // We should format *that* value for display.
                column={column} // Pass full column definition for formatting inside if needed
                row={row}
                columnId={key} // separate from implicit column prop
                updateMyData={updateMyData}
                isEditable={true}
                textAlign={textAlign}
              />
            );
          }

          const html = isHtml && allowRenderHtml ? { __html: text } : undefined;

          let backgroundColor;
          let arrow = '';
          const originKey = column.key.substring(column.label.length).trim();
          if (!hasColumnColorFormatters && hasBasicColorFormatters) {
            backgroundColor =
              basicColorFormatters[row.index][originKey]?.backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorFormatters[row.index][originKey]?.mainArrow
                : '';
          }

          if (hasColumnColorFormatters) {
            columnColorFormatters!
              .filter(formatter => formatter.column === column.key)
              .forEach(formatter => {
                const formatterResult =
                  value || value === 0
                    ? formatter.getColorFromValue(value as number)
                    : false;
                if (formatterResult) {
                  backgroundColor = formatterResult;
                }
              });
          }

          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            backgroundColor =
              basicColorColumnFormatters[row.index][column.key]
                ?.backgroundColor || backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorColumnFormatters[row.index][column.key]?.mainArrow
                : '';
          }
          const isDarkMode = theme.colorBgBase
            ? isColorDark(theme.colorBgBase)
            : false;
          const metricTextColor = isDarkMode ? '#FFFBE6' : theme.colorPrimary;
          const StyledCell = styled.td`
            color: ${isMetric ? metricTextColor : theme.colorText};
            text-align: ${sharedStyle.textAlign};
            white-space: ${value instanceof Date ? 'nowrap' : undefined};
            position: relative;
            background: ${backgroundColor || undefined};
            padding-left: ${column.isChildColumn
              ? `${theme.sizeUnit * 5}px`
              : `${theme.sizeUnit}px`};
          `;

          const cellBarStyles = css`
            position: absolute;
            height: 100%;
            display: block;
            top: 0;
            ${valueRange &&
            `
                width: ${`${cellWidth({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                left: ${`${cellOffset({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                background-color: ${cellBackground({
                  value: value as number,
                  colorPositiveNegative,
                })};
              `}
          `;

          let arrowStyles = css`
            color: ${basicColorFormatters &&
            basicColorFormatters[row.index][originKey]?.arrowColor ===
              ColorSchemeEnum.Green
              ? theme.colorSuccess
              : theme.colorError};
            margin-right: ${theme.sizeUnit}px;
          `;

          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            arrowStyles = css`
              color: ${basicColorColumnFormatters[row.index][column.key]
                ?.arrowColor === ColorSchemeEnum.Green
                ? theme.colorSuccess
                : theme.colorError};
              margin-right: ${theme.sizeUnit}px;
            `;
          }

          const cellProps = {
            'aria-labelledby': `header-${column.key}`,
            role: 'cell',
            // show raw number in title in case of numeric values
            title: typeof value === 'number' ? String(value) : undefined,
            onClick:
              emitCrossFilters && !valueRange && !isMetric
                ? () => {
                    // allow selecting text in a cell
                    if (!getSelectedText()) {
                      toggleFilter(key, value);
                    }
                  }
                : undefined,
            onContextMenu: (e: MouseEvent) => {
              if (handleContextMenu) {
                e.preventDefault();
                e.stopPropagation();
                handleContextMenu(
                  row.original,
                  { key, value, isMetric },
                  e.nativeEvent.clientX,
                  e.nativeEvent.clientY,
                );
              }
            },
            className: [
              className,
              value == null ||
              (value instanceof DateWithFormatter && value.input == null)
                ? 'dt-is-null'
                : '',
              isActiveFilterValue(key, value) ? ' dt-is-active-filter' : '',
            ].join(' '),
            tabIndex: 0,
          };
          if (html) {
            if (truncateLongCells) {
              // eslint-disable-next-line react/no-danger
              return (
                <StyledCell {...cellProps}>
                  <div
                    className="dt-truncate-cell"
                    style={columnWidth ? { width: columnWidth } : undefined}
                    dangerouslySetInnerHTML={html}
                  />
                </StyledCell>
              );
            }
            // eslint-disable-next-line react/no-danger
            return <StyledCell {...cellProps} dangerouslySetInnerHTML={html} />;
          }
          // If cellProps renders textContent already, then we don't have to
          // render `Cell`. This saves some time for large tables.
          return (
            <StyledCell {...cellProps}>
              {valueRange && (
                <div
                  /* The following classes are added to support custom CSS styling */
                  className={cx(
                    'cell-bar',
                    typeof value === 'number' && value < 0
                      ? 'negative'
                      : 'positive',
                  )}
                  css={cellBarStyles}
                  role="presentation"
                />
              )}
              {truncateLongCells ? (
                <div
                  className="dt-truncate-cell"
                  style={columnWidth ? { width: columnWidth } : undefined}
                >
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </div>
              ) : (
                <>
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </>
              )}
            </StyledCell>
          );
        },
        Header: ({ column: col, onClick, style, onDragStart, onDrop }) => (
          <th
            id={`header-${column.originalLabel}`}
            title={t('Shift + Click to sort by multiple columns')}
            className={[className, col.isSorted ? 'is-sorted' : ''].join(' ')}
            style={{
              ...sharedStyle,
              ...style,
            }}
            onKeyDown={(e: ReactKeyboardEvent<HTMLElement>) => {
              // programatically sort column on keypress
              if (Object.values(ACTION_KEYS).includes(e.key)) {
                col.toggleSortBy();
              }
            }}
            role="columnheader button"
            onClick={onClick}
            data-column-name={col.id}
            {...(allowRearrangeColumns && {
              draggable: 'true',
              onDragStart,
              onDragOver: e => e.preventDefault(),
              onDragEnter: e => e.preventDefault(),
              onDrop,
            })}
            tabIndex={0}
          >
            {/* can't use `columnWidth &&` because it may also be zero */}
            {config.columnWidth ? (
              // column width hint
              <div
                style={{
                  width: columnWidth,
                  height: 0.01,
                }}
              />
            ) : null}
            <div
              data-column-name={col.id}
              css={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <span
                data-column-name={col.id}
                css={{
                  marginRight: 8,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayLabel}
              </span>
              <div css={{ display: 'flex', alignItems: 'center' }}>
                <SortIcon column={col} />
                <Popover
                  content={
                    activeFilterMenu === key ? (
                      <FilterPopover
                        values={activeUniqueValues}
                        selected={columnFilters[key]}
                        onSave={vals => handleFilterChange(key, vals)}
                        onCancel={() => setActiveFilterMenu(null)}
                      />
                    ) : null
                  }
                  open={activeFilterMenu === key}
                  onOpenChange={visible => {
                    if (!visible) setActiveFilterMenu(null);
                  }}
                  placement="bottomLeft"
                  trigger="click"
                >
                  <span
                    role="button"
                    css={css`
                      margin-left: 5px;
                      cursor: pointer;
                      & svg {
                        fill-opacity: 1 !important;
                        opacity: 1 !important;
                      }
                    `}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setActiveFilterMenu(
                        activeFilterMenu === key ? null : key,
                      );
                    }}
                  >
                    <FilterOutlined
                      style={{
                        color:
                          columnFilters[key] && columnFilters[key].length > 0
                            ? theme.colorPrimary
                            : theme.colorText,
                      }}
                    />
                  </span>
                </Popover>
              </div>
            </div>
          </th>
        ),

        Footer: totals ? (
          i === 0 ? (
            <th key={`footer-summary-${i}`}>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  & svg {
                    margin-left: ${theme.sizeUnit}px;
                    color: ${theme.colorBorder} !important;
                  }
                `}
              >
                {t('Summary')}
                <Tooltip
                  overlay={t(
                    'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
                  )}
                >
                  <InfoCircleOutlined />
                </Tooltip>
              </div>
            </th>
          ) : (
            <td key={`footer-total-${i}`} style={sharedStyle}>
              <strong>{formatColumnValue(column, totals[key])[1]}</strong>
            </td>
          )
        ) : undefined,
        sortDescFirst: sortDesc,
        sortType: (() => {
          const hierarchyField = hierarchyFields?.find(
            (h: any) => h.columnName === key || h.fieldName === key,
          );
          const isTimeDimension =
            /year|month|quarter|half|season|week|day/i.test(
              key.toLowerCase(),
            ) ||
            (hierarchyField &&
              /year|month|quarter|half|season|week|day/i.test(
                hierarchyField.fieldLabel.toLowerCase(),
              ));
          const useChrono =
            hierarchyField?.sortMethod === 'Chronological' ||
            ((!hierarchyField?.sortMethod ||
              hierarchyField?.sortMethod === 'Default') &&
              isTimeDimension);

          if (useChrono) {
            return (rowA: any, rowB: any, columnId: string) => {
              const valA = rowA.values[columnId];
              const valB = rowB.values[columnId];
              const cleanA =
                valA instanceof DateWithFormatter ? valA.input : valA;
              const cleanB =
                valB instanceof DateWithFormatter ? valB.input : valB;
              return naturalSort(
                getCustomSortKey(cleanA, true),
                getCustomSortKey(cleanB, true),
              );
            };
          }
          return getSortTypeByDataType(dataType);
        })(),
      };
    },
    [
      defaultAlignPN,
      defaultColorPN,
      emitCrossFilters,
      getValueRange,
      isActiveFilterValue,
      isRawRecords,
      showCellBars,
      sortDesc,
      toggleFilter,
      totals,
      columnColorFormatters,
      columnColorFormatters,
      columnOrderToggle,
      editableMetrics,
      cellEditManager,
      updateMyData,
      forceUpdate,
      columnFilters,
      activeFilterMenu,
      activeUniqueValues,
      handleFilterChange,
      theme,
      isDarkMode,
      hierarchyFields,
    ],
  );

  const visibleColumnsMeta = useMemo(
    () => filteredColumnsMeta.filter(col => col.config?.visible !== false),
    [filteredColumnsMeta],
  );

  const checkboxColumn = useMemo(
    () => ({
      id: 'selection',
      Header: ({ style }: any) => (
        <th
          style={{
            width: '85px',
            minWidth: '85px',
            verticalAlign: 'bottom',
            ...style,
          }}
          className="right-border-only"
          aria-label="Selection"
        >
          {t('Actions')}
        </th>
      ),
      Cell: ({ row }: any) => {
        const groupby = [...(groupbyRows || [])];
        const htmlUniqueFields = (htmlViewerActions || [])
          .filter(action => action.onlySelectedRow)
          .map(action => action.uniqueField)
          .filter((field): field is string => !!field);

        const uniqueFields = [
          ...(rowLevelActions || [])
            .map(action => action.uniqueField)
            .filter((field): field is string => !!field),
          ...htmlUniqueFields,
        ];

        uniqueFields.forEach(field => {
          if (!groupby.includes(field)) {
            groupby.push(field);
          }
        });

        let rowKey = String(row.id ?? row.index);
        if (rowKey === 'undefined' || rowKey === 'null' || !rowKey) {
          rowKey = JSON.stringify(row.original);
        }
        if (groupby.length > 0) {
          rowKey = JSON.stringify(
            groupby.reduce((acc: any, col: any) => {
              if (row.original.hasOwnProperty(col)) {
                acc[col] = row.original[col];
              }
              return acc;
            }, {}),
          );
        }
        const isSelected = selectedRowData.has(rowKey);
        return (
          <td
            style={{
              width: '85px',
              minWidth: '85px',
              textAlign: 'center',
              verticalAlign: 'middle',
            }}
            className="right-border-only"
          >
            <input
              type={hasUniqueField ? 'radio' : 'checkbox'}
              checked={isSelected}
              onChange={e =>
                handleRowSelectionChange(rowKey, row.original, e.target.checked)
              }
            />
          </td>
        );
      },
      disableSortBy: true,
      disableFilters: true,
    }),
    [
      groupbyRows,
      selectedRowData,
      handleRowSelectionChange,
      hasUniqueField,
      rowLevelActions,
      htmlViewerActions,
    ],
  );

  const redirectionColumn = useMemo(
    () => ({
      id: 'redirection',
      Header: ({ style }: any) => (
        <th
          style={{
            width: '50px',
            minWidth: '50px',
            textAlign: 'center',
            verticalAlign: 'bottom',
            ...style,
          }}
          className="right-border-only"
          aria-label="Redirection"
        >
          {t('Redirect')}
        </th>
      ),
      Cell: ({ row }: any) => {
        return (
          <td
            style={{
              width: '50px',
              minWidth: '50px',
              textAlign: 'center',
              verticalAlign: 'middle',
            }}
            className="right-border-only"
          >
            <RedirectionMenu
              rowData={row.original}
              redirectionUrls={redirectionUrls}
              dimensionKeys={dimensionKeys}
              rawFormData={rawFormData}
              dashboardFilters={dashboardFilters}
            />
          </td>
        );
      },
      disableSortBy: true,
      disableFilters: true,
    }),
    [redirectionUrls, dimensionKeys, rawFormData, dashboardFilters],
  );

  const columns = useMemo(() => {
    const colConfigs = visibleColumnsMeta.map(getColumnConfigs);
    const colsList = [...colConfigs];
    if (redirectionUrls && redirectionUrls.length > 0) {
      colsList.unshift(redirectionColumn as any);
    }
    const hasRowLevelActions = rowLevelActions && rowLevelActions.length > 0;
    const hasHtmlViewerRowSelection =
      htmlViewerActions && htmlViewerActions.length > 0;
    if (hasRowLevelActions || hasHtmlViewerRowSelection) {
      colsList.unshift(checkboxColumn as any);
    }
    return colsList;
  }, [
    visibleColumnsMeta,
    getColumnConfigs,
    rowLevelActions,
    htmlViewerActions,
    checkboxColumn,
    redirectionUrls,
    redirectionColumn,
  ]);

  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);

  useEffect(() => {
    const options = (
      columns as unknown as ColumnWithLooseAccessor &
        {
          columnKey: string;
          sortType?: string;
        }[]
    )
      .filter(col => col?.sortType === 'alphanumeric')
      .map(column => ({
        value: column.columnKey,
        label: column.columnKey,
      }));

    if (!isEqual(options, searchOptions)) {
      setSearchOptions(options || []);
    }
  }, [columns]);

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  useEffect(() => {
    if (hasServerPageLengthChanged) {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: 0,
        pageSize: serverPageLength,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  }, []);

  const handleSizeChange = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      setTableSize({ width, height });
    },
    [],
  );

  useLayoutEffect(() => {
    // After initial load the table should resize only when the new sizes
    // Are not only scrollbar updates, otherwise, the table would twitch
    const scrollBarSize = getScrollBarSize();
    const { width: tableWidth, height: tableHeight } = tableSize;
    // Table is increasing its original size
    if (
      width - tableWidth > scrollBarSize ||
      height - tableHeight > scrollBarSize
    ) {
      handleSizeChange({
        width: width - scrollBarSize,
        height: height - scrollBarSize,
      });
    } else if (
      tableWidth - width > scrollBarSize ||
      tableHeight - height > scrollBarSize
    ) {
      // Table is decreasing its original size
      handleSizeChange({
        width,
        height,
      });
    }
  }, [width, height, handleSizeChange, tableSize]);

  const { width: widthFromState, height: heightFromState } = tableSize;

  const handleSortByChange = useCallback(
    (sortBy: SortByItem[]) => {
      if (!serverPagination) return;
      const modifiedOwnState = {
        ...serverPaginationData,
        sortBy,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, serverPagination],
  );

  const handleSearch = (searchText: string) => {
    const modifiedOwnState = {
      ...(serverPaginationData || {}),
      searchColumn:
        serverPaginationData?.searchColumn || searchOptions[0]?.value,
      searchText,
      currentPage: 0, // Reset to first page when searching
    };
    updateTableOwnState(setDataMask, modifiedOwnState);
  };

  const debouncedSearch = debounce(handleSearch, 800);

  const handleChangeSearchCol = (searchCol: string) => {
    if (!isEqual(searchCol, serverPaginationData?.searchColumn)) {
      const modifiedOwnState = {
        ...(serverPaginationData || {}),
        searchColumn: searchCol,
        searchText: '',
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  };

  const actionHeader = useMemo(
    () => (
      <>
        {Object.keys(columnFilters).length > 0 && (
          <Button
            size="small"
            className="editable-table-clear-filters-btn"
            onClick={() => setColumnFilters({})}
          >
            {t('Clear Filters')}
          </Button>
        )}
        {rowLevelActions.map((action: RowLevelActionConfig, index: number) => (
          <Button
            key={`row-action-${index}`}
            size="small"
            icon={renderIcon(action.buttonIcon)}
            onClick={() => handleActionClick(action)}
            disabled={selectedRowData.size === 0}
          >
            {action.buttonLabel}
          </Button>
        ))}
        {chartLevelActions.map(
          (action: ChartLevelActionConfig, index: number) => (
            <Button
              key={`chart-action-${index}`}
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
        {globalRedirectionUrls.map((config: RedirectConfig, index: number) => (
          <Button
            key={`global-redirect-${index}`}
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleGlobalRedirect(config)}
          >
            {config.label}
          </Button>
        ))}
        {cellEditManager.getModificationCount() > 0 && (
          <Button
            size="small"
            className="editable-table-save-btn"
            type="primary"
            loading={isSaving || isRefreshing}
            onClick={async () => {
              setIsSaving(true);
              try {
                const success = await cellEditManager.sendModifications();
                if (success) {
                  // Slight delay to ensure notification is visible
                  setTimeout(async () => {
                    try {
                      // Manual Force Refresh: Manually call the API with force: true to prime the cache with fresh data.
                      try {
                        const baseQueryContext = buildQuery(
                          props.rawFormData as any,
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
                            form_data: props.rawFormData,
                            result_format: 'json',
                            result_type: 'full',
                          },
                        });
                      } catch (e) {
                        console.error('Force refresh failed', e);
                      }

                      setDataMask({
                        ownState: {
                          forceRefresh: Date.now(),
                        },
                        // Propagate refresh to dashboard
                        extraFormData: emitCrossFilters
                          ? {
                              custom_form_data: {
                                force_refresh: Date.now(),
                              },
                            }
                          : undefined,
                      });
                    } finally {
                      setIsSaving(false);
                    }
                  }, 500);
                } else {
                  setIsSaving(false);
                }
              } catch (e) {
                console.error('Failed to save changes', e);
                setIsSaving(false);
              }
            }}
            disabled={isSaving || cellEditManager.getModificationCount() === 0}
          >
            {t('Save')}
          </Button>
        )}
        {enableLayout && (
          <Button
            size="small"
            className="editable-table-layout-btn"
            icon={<TableOutlined />}
            onClick={() => setIsLayoutEditorVisible(true)}
          >
            {t('Layout')}
          </Button>
        )}
      </>
    ),
    [
      columnFilters,
      rowLevelActions,
      chartLevelActions,
      cellEditManager,
      forceUpdate,
      isRefreshing,
      isSaving,
      datasourceId,
      datasourceType,
      emitCrossFilters,
      props.rawFormData,
      setDataMask,
      handleActionClick,
      selectedRowData,
      redirectionUrls,
      globalRedirectionUrls,
      dashboardFilters,
      enableLayout,
    ],
  );

  if (validationError) {
    return (
      <Styles>
        <div style={{ padding: 16 }}>
          <Alert
            type="error"
            message={t('Validation Error')}
            description={validationError}
            showIcon
          />
        </div>
      </Styles>
    );
  }

  return (
    <Styles>
      <Spin
        spinning={isSaving || isRefreshing}
        tip={isSaving ? t('Saving...') : t('Loading...')}
        style={{ height: '100%', width: '100%' }}
      >
        <div
          ref={containerRef}
          style={{
            height: '100%',
            width: '100%',
            paddingTop: '3px',
            position: 'relative',
          }}
        >
          {contextHolder}
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
                  ...(currentAction.formFields || []),
                  ...(currentAction.additionalFields || []).flatMap(
                    f => f.name,
                  ),
                ].filter((v, i, a) => a.indexOf(v) === i)} // Unique
                additionalFields={currentAction.additionalFields}
                onSubmit={handleFormSubmit}
                onCancel={handleCloseModal}
                datasourceId={datasourceId ? Number(datasourceId) : 0}
                rowData={currentRow}
                initialValues={currentRow}
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
          <LayoutEditor
            visible={isLayoutEditorVisible}
            onCancel={() => setIsLayoutEditorVisible(false)}
            onSave={handleSaveLayout}
            initialRows={layoutItems}
            initialCols={[]}
            allColumns={layoutAvailableColumns}
            initialMetrics={(props.metrics as string[]) || []}
            allMetrics={allAvailableMetrics}
            mountNode={undefined}
          />
          <DataTable<D>
            columns={columns}
            data={filteredData}
            rowCount={rowCount}
            tableClassName="table table-striped table-condensed"
            pageSize={pageSize}
            serverPaginationData={serverPaginationData}
            pageSizeOptions={pageSizeOptions}
            width={widthFromState}
            height={heightFromState - 44}
            actionHeader={actionHeader}
            serverPagination={serverPagination}
            onServerPaginationChange={handleServerPaginationChange}
            onColumnOrderChange={() => setColumnOrderToggle(!columnOrderToggle)}
            initialSearchText={serverPaginationData?.searchText || ''}
            sortByFromParent={serverPaginationData?.sortBy || []}
            searchInputId={`${slice_id}-search`}
            // 9 page items in > 340px works well even for 100+ pages
            maxPageItemCount={width > 340 ? 9 : 7}
            noResults={getNoResultsMessage}
            searchInput={includeSearch && SearchInput}
            selectPageSize={pageSize !== null && SelectPageSize}
            // not in use in Superset, but needed for unit tests
            sticky={sticky}
            renderGroupingHeaders={
              !isEmpty(groupHeaderColumns) ? renderGroupingHeaders : undefined
            }
            renderTimeComparisonDropdown={
              isUsingTimeComparison ? renderTimeComparisonDropdown : undefined
            }
            handleSortByChange={handleSortByChange}
            onSearchColChange={handleChangeSearchCol}
            manualSearch={serverPagination}
            onSearchChange={debouncedSearch}
            searchOptions={searchOptions}
          />
        </div>
      </Spin>
    </Styles>
  );
}
