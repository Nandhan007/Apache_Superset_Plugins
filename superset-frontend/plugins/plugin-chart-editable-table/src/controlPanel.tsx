/* eslint-disable camelcase */
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
  ColumnMeta,
  ColumnOption,
  ControlConfig,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlPanelState,
  ControlState,
  ControlStateMapping,
  D3_TIME_FORMAT_OPTIONS,
  Dataset,
  DEFAULT_MAX_ROW,
  DEFAULT_MAX_ROW_TABLE_SERVER,
  defineSavedMetrics,
  formatSelectOptions,
  getStandardizedControls,
  QueryModeLabel,
  sections,
  sharedControls,
  shouldSkipMetricColumn,
  isRegularMetric,
  isPercentMetric,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  isAdhocColumn,
  isPhysicalColumn,
  legacyValidateInteger,
  QueryFormColumn,
  QueryMode,
  SMART_DATE_ID,
  validateMaxValue,
  validateServerPagination,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { t } from '@apache-superset/core/translation';

import { isEmpty, last } from 'lodash';
import { PAGE_SIZE_OPTIONS, SERVER_PAGE_SIZE_OPTIONS } from './consts';
import { ColorSchemeEnum } from './types';
function parseExpressionJson(expression: string): any {
  if (!expression) return null;
  const cleanExpr = expression.trim();

  const firstArray = cleanExpr.indexOf('[');
  const firstObject = cleanExpr.indexOf('{');
  const lastArray = cleanExpr.lastIndexOf(']');
  const lastObject = cleanExpr.lastIndexOf('}');

  let startIdx = -1;
  let endIdx = -1;

  if (firstArray !== -1 && (firstObject === -1 || firstArray < firstObject)) {
    startIdx = firstArray;
    endIdx = lastArray;
  } else if (firstObject !== -1) {
    startIdx = firstObject;
    endIdx = lastObject;
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  let jsonCandidate = cleanExpr.slice(startIdx, endIdx + 1);

  if (jsonCandidate.includes("''")) {
    jsonCandidate = jsonCandidate.replace(/''/g, "'");
  }
  if (jsonCandidate.includes('\\"')) {
    jsonCandidate = jsonCandidate.replace(/\\"/g, '"');
  }
  if (jsonCandidate.includes("\\'")) {
    jsonCandidate = jsonCandidate.replace(/\\'/g, "'");
  }

  if (jsonCandidate.startsWith('{') && jsonCandidate.endsWith('}')) {
    const inner = jsonCandidate.slice(1, -1).trim();
    if (inner.startsWith('{') && inner.endsWith('}')) {
      jsonCandidate = `[${inner}]`;
    }
  }

  try {
    return JSON.parse(jsonCandidate);
  } catch (e) {
    try {
      const doubleQuoteJson = jsonCandidate.replace(/'/g, '"');
      return JSON.parse(doubleQuoteJson);
    } catch (_e2) {
      console.error('Failed to parse expression JSON:', expression, e);
      return null;
    }
  }
}

function validateHierarchyJson(parsed: any, colName: string): void {
  if (parsed === null || parsed === undefined) {
    throw new Error(
      `Invalid hierarchy configuration on column "${colName}". Please ensure it contains a valid JSON string.`,
    );
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (items.length === 0) {
    throw new Error(
      `The hierarchy configuration on column "${colName}" is empty.`,
    );
  }
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.columnName !== 'string' ||
      !item.columnName.trim() ||
      typeof item.fieldName !== 'string' ||
      !item.fieldName.trim() ||
      typeof item.fieldLabel !== 'string' ||
      !item.fieldLabel.trim() ||
      typeof item.level !== 'number' ||
      Number.isNaN(item.level) ||
      typeof item.hierarchyGroup !== 'string' ||
      !item.hierarchyGroup.trim()
    ) {
      throw new Error(
        `Invalid hierarchy structure on column "${colName}". Please ensure the JSON configuration includes all required properties (columnName, fieldName, fieldLabel, level, and hierarchyGroup).`,
      );
    }
  }
}

import CellEditPayloadMappingControl from './components/CellEditPayloadMappingControl';
import ChartLevelActionsControl from './components/ChartLevelActionsControl';
import RowLevelActionsControl from './components/RowLevelActionsControl';
import HTMLViewerActionsControl from './components/HTMLViewerActionsControl';
import RedirectionConfigControl from './components/RedirectionConfigControl';

function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.Aggregate || mode === QueryMode.Raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.Raw : QueryMode.Aggregate;
}

/**
 * Visibility check
 */
function isQueryMode(mode: QueryMode) {
  return ({ controls }: Pick<ControlPanelsContainerProps, 'controls'>) =>
    getQueryMode(controls) === mode;
}

const isAggMode = isQueryMode(QueryMode.Aggregate);
const isRawMode = isQueryMode(QueryMode.Raw);

const validateAggControlValues = (
  controls: ControlStateMapping,
  values: any[],
) => {
  const areControlsEmpty = values.every(val => ensureIsArray(val).length === 0);
  return areControlsEmpty && isAggMode({ controls })
    ? [t('Group By, Metrics or Percentage Metrics must have a value')]
    : [];
};

const queryMode: ControlConfig<'RadioButtonControl'> = {
  type: 'RadioButtonControl',
  label: t('Query mode'),
  default: null,
  options: [
    [QueryMode.Aggregate, QueryModeLabel[QueryMode.Aggregate]],
    [QueryMode.Raw, QueryModeLabel[QueryMode.Raw]],
  ],
  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
  rerender: ['all_columns', 'groupby', 'metrics', 'percent_metrics'],
};

const allColumnsControl: typeof sharedControls.groupby = {
  ...sharedControls.groupby,
  label: t('Columns'),
  description: t('Columns to display'),
  multi: true,
  freeForm: true,
  allowAll: true,
  commaChoosesOption: false,
  optionRenderer: (c: any) => <ColumnOption showType column={c} />,
  valueRenderer: (c: any) => <ColumnOption column={c} />,
  valueKey: 'column_name',
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    options: datasource?.columns || [],
    queryMode: getQueryMode(controls),
    externalValidationErrors:
      isRawMode({ controls }) && ensureIsArray(controlState?.value).length === 0
        ? [t('must have a value')]
        : [],
  }),
  visibility: isRawMode,
  resetOnHide: false,
};

const percentMetricsControl: typeof sharedControls.metrics = {
  ...sharedControls.metrics,
  label: t('Percentage metrics'),
  description: t(
    'Select one or many metrics to display, that will be displayed in the percentages of total. ' +
      'Percentage metrics will be calculated only from data within the row limit. ' +
      'You can use an aggregation function on a column or write custom SQL to create a percentage metric.',
  ),
  visibility: isAggMode,
  resetOnHide: false,
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
    datasourceType: datasource?.type,
    queryMode: getQueryMode(controls),
    externalValidationErrors: validateAggControlValues(controls, [
      controls.groupby?.value,
      controls.metrics?.value,
      controlState?.value,
    ]),
  }),
  rerender: ['groupby', 'metrics'],
  default: [],
  validators: [],
};

/**
 * Generate comparison column names for a given column.
 */
const generateComparisonColumns = (colname: string) => [
  `${t('Main')} ${colname}`,
  `# ${colname}`,
  `△ ${colname}`,
  `% ${colname}`,
];

/**
 * Generate column types for the comparison columns.
 */
const generateComparisonColumnTypes = (count: number) =>
  Array(count).fill(GenericDataType.Numeric);

const percentMetricCalculationControl: ControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  label: t('Percentage metric calculation'),
  description: t(
    'Row Limit: percentages are calculated based on the subset of data retrieved, respecting the row limit. ' +
      'All Records: Percentages are calculated based on the total dataset, ignoring the row limit.',
  ),
  default: 'row_limit',
  clearable: false,
  choices: [
    ['row_limit', t('Row limit')],
    ['all_records', t('All records')],
  ],
  visibility: isAggMode,
  renderTrigger: false,
};

const processComparisonColumns = (columns: any[], suffix: string) =>
  columns
    .map(col => {
      if (!col.label.includes(suffix)) {
        return [
          {
            label: `${t('Main')} ${col.label}`,
            value: `${t('Main')} ${col.value}`,
          },
          {
            label: `# ${col.label}`,
            value: `# ${col.value}`,
          },
          {
            label: `△ ${col.label}`,
            value: `△ ${col.value}`,
          },
          {
            label: `% ${col.label}`,
            value: `% ${col.value}`,
          },
        ];
      }
      return [];
    })
    .flat();

/*
Options for row limit control
*/

export const ROW_LIMIT_OPTIONS_TABLE = [
  10, 50, 100, 250, 500, 1000, 5000, 10000, 50000, 100000, 150000, 200000,
  250000, 300000, 350000, 400000, 450000, 500000,
];

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'query_mode',
            config: queryMode,
          },
        ],
        [
          {
            name: 'groupby',
            override: {
              visibility: isAggMode,
              resetOnHide: false,
              mapStateToProps: (
                state: ControlPanelState,
                controlState: ControlState,
              ) => {
                const { controls } = state;
                const originalMapStateToProps =
                  sharedControls?.groupby?.mapStateToProps;
                const newState =
                  originalMapStateToProps?.(state, controlState) ?? {};
                newState.externalValidationErrors = validateAggControlValues(
                  controls,
                  [
                    controls.metrics?.value,
                    controls.percent_metrics?.value,
                    controlState.value,
                  ],
                );

                return newState;
              },
              rerender: ['metrics', 'percent_metrics'],
            },
          },
        ],
        [
          {
            name: 'time_grain_sqla',
            config: {
              ...sharedControls.time_grain_sqla,
              visibility: ({ controls }) => {
                const dttmLookup = Object.fromEntries(
                  ensureIsArray(controls?.groupby?.options).map(option => [
                    option.column_name,
                    option.is_dttm,
                  ]),
                );

                return ensureIsArray(controls?.groupby.value)
                  .map(selection => {
                    if (isAdhocColumn(selection)) {
                      return true;
                    }
                    if (isPhysicalColumn(selection)) {
                      return !!dttmLookup[selection];
                    }
                    return false;
                  })
                  .some(Boolean);
              },
            },
          },
          'temporal_columns_lookup',
        ],
        [
          {
            name: 'metrics',
            override: {
              validators: [],
              visibility: isAggMode,
              resetOnHide: false,
              mapStateToProps: (
                { controls, datasource, form_data }: ControlPanelState,
                controlState: ControlState,
              ) => ({
                columns: datasource?.columns[0]?.hasOwnProperty('filterable')
                  ? (datasource as Dataset)?.columns?.filter(
                      (c: ColumnMeta) => c.filterable,
                    )
                  : datasource?.columns,
                savedMetrics: defineSavedMetrics(datasource),
                // current active adhoc metrics
                selectedMetrics:
                  form_data.metrics ||
                  (form_data.metric ? [form_data.metric] : []),
                datasource,
                externalValidationErrors: validateAggControlValues(controls, [
                  controls.groupby?.value,
                  controls.percent_metrics?.value,
                  controlState.value,
                ]),
              }),
              rerender: ['groupby', 'percent_metrics', 'editableMetrics'],
            },
          },
          {
            name: 'all_columns',
            config: allColumnsControl,
          },
        ],
        [
          {
            name: 'percent_metrics',
            config: percentMetricsControl,
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'timeseries_limit_metric',
            override: {
              visibility: isAggMode,
              resetOnHide: false,
            },
          },
          {
            name: 'order_by_cols',
            config: {
              type: 'SelectControl',
              label: t('Ordering'),
              description: t('Order results by selected columns'),
              multi: true,
              default: [],
              mapStateToProps: ({ datasource }) => ({
                choices: datasource?.hasOwnProperty('order_by_choices')
                  ? (datasource as Dataset)?.order_by_choices
                  : datasource?.columns || [],
              }),
              visibility: isRawMode,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort descending'),
              default: true,
              description: t(
                'If enabled, this control sorts the results/values descending, otherwise it sorts the results ascending.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) => {
                const hasSortMetric = Boolean(
                  controls?.timeseries_limit_metric?.value,
                );
                return hasSortMetric && isAggMode({ controls });
              },
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'server_pagination',
            config: {
              type: 'CheckboxControl',
              label: t('Server pagination'),
              description: t(
                'Enable server side pagination of results (experimental feature)',
              ),
              default: false,
            },
          },
        ],
        [
          {
            name: 'server_page_length',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Server Page Length'),
              default: 10,
              choices: SERVER_PAGE_SIZE_OPTIONS,
              description: t('Rows per page, 0 means no pagination'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.server_pagination?.value),
            },
          },
        ],
        [
          {
            name: 'row_limit',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Row limit'),
              clearable: false,
              mapStateToProps: state => ({
                maxValue: state?.common?.conf?.TABLE_VIZ_MAX_ROW_SERVER,
                server_pagination: state?.form_data?.server_pagination,
                maxValueWithoutServerPagination:
                  state?.common?.conf?.SQL_MAX_ROW,
              }),
              validators: [
                legacyValidateInteger,
                (v, state) =>
                  validateMaxValue(
                    v,
                    state?.maxValue || DEFAULT_MAX_ROW_TABLE_SERVER,
                  ),
                (v, state) =>
                  validateServerPagination(
                    v,
                    state?.server_pagination,
                    state?.maxValueWithoutServerPagination || DEFAULT_MAX_ROW,
                    state?.maxValue || DEFAULT_MAX_ROW_TABLE_SERVER,
                  ),
              ],
              // Re run the validations when this control value
              validationDependancies: ['server_pagination'],
              default: 10000,
              choices: formatSelectOptions(ROW_LIMIT_OPTIONS_TABLE),
              description: t(
                'Limits the number of the rows that are computed in the query that is the source of the data used for this chart.',
              ),
            },
            override: {
              default: 1000,
            },
          },
        ],
        [
          {
            name: 'percent_metric_calculation',
            config: percentMetricCalculationControl,
          },
        ],

        [
          {
            name: 'show_totals',
            config: {
              type: 'CheckboxControl',
              label: t('Show summary'),
              default: false,
              description: t(
                'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
              ),
              visibility: isAggMode,
              resetOnHide: false,
            },
          },
        ],
      ],
    },
    {
      label: t('Edit Chart Options'),
      tabOverride: 'data',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'editableMetrics',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Editable Metrics'),
              description: t(
                'Select specific metrics to enforce their editability.',
              ),
              default: [],
              renderTrigger: true,
              // Simple visibility logic: show if any metrics selected or just always show
              visibility: ({ controls }) => true,
              mapStateToProps: (state: ControlPanelState) => {
                const formMetrics = ensureIsArray(
                  state?.controls?.metrics?.value || state?.form_data?.metrics,
                );
                const datasourceMetrics =
                  (state?.datasource as Dataset)?.metrics || [];
                const choices = formMetrics
                  .map((metric: any) => {
                    if (!metric) return null;
                    let metricValue = '';
                    let metricLabel = '';
                    if (typeof metric === 'string') {
                      metricValue = metric;
                      const mDef = datasourceMetrics.find(
                        (m: any) => m.metric_name === metric,
                      );
                      metricLabel =
                        mDef?.verbose_name || mDef?.metric_name || metric;
                    } else if (metric?.label) {
                      metricValue = metric.label;
                      metricLabel = metric.label;
                    }

                    if (!metricValue) return null;
                    return [metricValue, metricLabel];
                  })
                  .filter(Boolean) as [string, string][];
                return { choices };
              },
            },
          },
        ],
        [
          {
            name: 'enableLayout',
            config: {
              type: 'CheckboxControl',
              label: t('Enable Layout Editor'),
              renderTrigger: true,
              default: true,
              description: t(
                'Show the "Layout" button to allow users to customize columns/metrics layout.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Backend Settings'),
      tabOverride: 'data',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'backendApiUrl',
            config: {
              type: 'TextControl',
              label: t('BackendUrl'),
              description: t(
                'Full URL for the backend API (e.g., https://api.example.com/update/data)',
              ),
              default: '',
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'cellEditPayloadMapping',
            config: {
              type: CellEditPayloadMappingControl,
              label: t('Cell Edit Payload Mapping'),
              description: t(
                'Optional JSON template for custom cell edit payload mapping.',
              ),
              default: '',
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Hierarchy Configuration'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'hierarchyColumns',
            config: {
              ...sharedControls.groupby,
              label: t('Hierarchy Columns'),
              description: t(
                'Select column(s) containing JSON configuration for hierarchy',
              ),
              renderTrigger: true,
              rerender: ['chartLevelActions', 'rowLevelActions', 'hierarchyColumnDefs'],
              default: [],
              mapStateToProps: (state: ControlPanelState, controlState: any) => {
                const props = sharedControls.groupby.mapStateToProps
                  ? sharedControls.groupby.mapStateToProps(state, controlState)
                  : {};
                const datasource =
                  (state.datasource as Dataset) ||
                  (state as any).explore?.datasource;
                const allColumns = datasource?.columns || [];
                const value = controlState?.value || state.controls?.hierarchyColumns?.value || [];
                if (Array.isArray(value) && Array.isArray(allColumns) && allColumns.length > 0) {
                  const enrichedValue = value.map((colItem: any) => {
                    const colNameStr =
                      typeof colItem === 'object' && colItem !== null
                        ? colItem.column_name || colItem.label
                        : colItem;
                    const colDef = allColumns.find(
                      (c: any) =>
                        c.column_name === colNameStr ||
                        c.label === colNameStr ||
                        c.verbose_name === colNameStr,
                    );
                    if (colDef && colDef.expression) {
                      if (typeof colItem === 'object' && colItem !== null) {
                        return { ...colItem, expression: colDef.expression };
                      }
                      return {
                        column_name: colNameStr,
                        label: colNameStr,
                        expression: colDef.expression,
                      };
                    }
                    return colItem;
                  });
                  return {
                    ...props,
                    value: enrichedValue,
                  };
                }
                return props;
              },
            },
          },
        ],
        [
          {
            name: 'hierarchyColumnDefs',
            config: {
              type: 'HiddenControl',
              renderTrigger: true,
              default: {},
              mapStateToProps: (state: ControlPanelState) => {
                const datasource =
                  (state.datasource as Dataset) ||
                  (state as any).explore?.datasource;
                const allColumns = datasource?.columns || [];
                const hierarchyColumns =
                  state.controls?.hierarchyColumns?.value || [];
                const hierarchyColumnDefs: Record<string, string> = {};
                if (Array.isArray(allColumns) && Array.isArray(hierarchyColumns)) {
                  hierarchyColumns.forEach((colName: any) => {
                    const colNameStr =
                      typeof colName === 'object' && colName !== null
                        ? (colName as any).column_name || (colName as any).label
                        : colName;
                    const colDef = allColumns.find(
                      (c: any) =>
                        c.column_name === colNameStr ||
                        c.label === colNameStr ||
                        c.verbose_name === colNameStr,
                    );
                    if (colDef && colDef.expression) {
                      hierarchyColumnDefs[colNameStr] = colDef.expression;
                    } else if (
                      typeof colName === 'object' &&
                      colName !== null &&
                      (colName as any).expression
                    ) {
                      hierarchyColumnDefs[colNameStr] = (colName as any).expression;
                    }
                  });
                }
                return {
                  value: hierarchyColumnDefs,
                };
              },
            },
          },
        ],
        [
          {
            name: 'chartLevelActions',
            config: {
              type: ChartLevelActionsControl,
              label: t('Chart-Level Actions'),
              description: t('Buttons at the top of the chart'),
              renderTrigger: true,
              default: [],
              mapStateToProps: (
                state: ControlPanelState,
                _controlState: any,
                _chart: any,
              ) => {
                const datasource =
                  (state.datasource as Dataset) ||
                  (state as any).explore?.datasource;
                const allColumns = datasource?.columns || [];
                const validColumns = allColumns.filter((c: any) => c.groupby);
                const hierarchyColumns =
                  state.controls?.hierarchyColumns?.value || [];
                const hierarchyFieldsList: any[] = [];
                if (
                  Array.isArray(allColumns) &&
                  Array.isArray(hierarchyColumns)
                ) {
                  hierarchyColumns.forEach((colName: any) => {
                    const colNameStr =
                      typeof colName === 'object' && colName !== null
                        ? (colName as any).column_name || (colName as any).label
                        : colName;
                    const colDef = allColumns.find(
                      (c: any) =>
                        c.column_name === colNameStr ||
                        c.label === colNameStr ||
                        c.verbose_name === colNameStr,
                    );
                    let expression = colDef?.expression;
                    if (
                      !expression &&
                      (state.form_data as any)?.hierarchyColumnDefs?.[colNameStr]
                    ) {
                      expression = (state.form_data as any).hierarchyColumnDefs[
                        colNameStr
                      ];
                    }
                    if (
                      !expression &&
                      typeof colName === 'object' &&
                      colName !== null &&
                      (colName as any).expression
                    ) {
                      expression = (colName as any).expression;
                    }
                    if (expression) {
                      try {
                        const parsed = parseExpressionJson(expression);
                        if (parsed) {
                          validateHierarchyJson(parsed, colNameStr);
                          if (Array.isArray(parsed)) {
                            hierarchyFieldsList.push(...parsed);
                          } else {
                            hierarchyFieldsList.push(parsed);
                          }
                        }
                      } catch (e: any) {
                        console.warn(e.message);
                      }
                    }
                  });
                }
                const seen = new Set<string>();
                const hierarchyFields = hierarchyFieldsList.filter(item => {
                  const key = item.fieldName || item.columnName;
                  if (key && !seen.has(key)) {
                    seen.add(key);
                    return true;
                  }
                  return false;
                });
                return {
                  datasourceColumns: validColumns,
                  allColumns: allColumns,
                  hierarchyFields,
                };
              },
            },
          },
        ],
        [
          {
            name: 'rowLevelActions',
            config: {
              type: RowLevelActionsControl,
              label: t('Row-Level Actions'),
              description: t('Buttons for each row'),
              renderTrigger: true,
              default: [],
              mapStateToProps: (
                state: ControlPanelState,
                _controlState: any,
                _chart: any,
              ) => {
                const datasource =
                  (state.datasource as Dataset) ||
                  (state as any).explore?.datasource;
                const columnsList = datasource?.columns || [];
                const validColumns = columnsList.filter((c: any) => c.groupby);
                const hierarchyColumns =
                  state.controls?.hierarchyColumns?.value || [];
                const hierarchyFieldsList: any[] = [];
                if (
                  Array.isArray(columnsList) &&
                  Array.isArray(hierarchyColumns)
                ) {
                  hierarchyColumns.forEach((colName: any) => {
                    const colNameStr =
                      typeof colName === 'object' && colName !== null
                        ? (colName as any).column_name || (colName as any).label
                        : colName;
                    const colDef = columnsList.find(
                      (c: any) =>
                        c.column_name === colNameStr ||
                        c.label === colNameStr ||
                        c.verbose_name === colNameStr,
                    );
                    let expression = colDef?.expression;
                    if (
                      !expression &&
                      (state.form_data as any)?.hierarchyColumnDefs?.[colNameStr]
                    ) {
                      expression = (state.form_data as any).hierarchyColumnDefs[
                        colNameStr
                      ];
                    }
                    if (
                      !expression &&
                      typeof colName === 'object' &&
                      colName !== null &&
                      (colName as any).expression
                    ) {
                      expression = (colName as any).expression;
                    }
                    if (expression) {
                      try {
                        const parsed = parseExpressionJson(expression);
                        if (parsed) {
                          validateHierarchyJson(parsed, colNameStr);
                          if (Array.isArray(parsed)) {
                            hierarchyFieldsList.push(...parsed);
                          } else {
                            hierarchyFieldsList.push(parsed);
                          }
                        }
                      } catch (e: any) {
                        console.warn(e.message);
                      }
                    }
                  });
                }
                const seen = new Set<string>();
                const hierarchyFields = hierarchyFieldsList.filter(item => {
                  const key = item.fieldName || item.columnName;
                  if (key && !seen.has(key)) {
                    seen.add(key);
                    return true;
                  }
                  return false;
                });
                return {
                  datasourceColumns: validColumns,
                  allColumns: columnsList,
                  hierarchyFields,
                };
              },
            },
          },
        ],
        [
          {
            name: 'htmlViewerActions',
            config: {
              type: HTMLViewerActionsControl,
              label: t('HTML Viewer Actions'),
              description: t(
                'Add action buttons that open modals rendering custom HTML/Handlebars templates',
              ),
              renderTrigger: true,
              default: [],
              mapStateToProps: (state: ControlPanelState) => {
                const datasource =
                  (state.datasource as Dataset) ||
                  (state as any).explore?.datasource;
                const columnsList = datasource?.columns || [];
                return {
                  allColumns: columnsList,
                };
              },
            },
          },
        ],
        [
          {
            name: 'excludeOptionFilter',
            config: {
              type: 'CheckboxControl',
              label: t('Exclude Global Filter'),
              renderTrigger: true,
              default: false,
              description: t(
                'If checked, hierarchy dropdowns will fetch all unique values from the backend (ignoring dashboard filters). If unchecked, they show values from the current visible chart data.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Redirection Settings'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'redirectionUrls',
            config: {
              type: RedirectionConfigControl,
              label: t('Redirection URLs'),
              description: t(
                'Configure redirection links for the row hamburger menu',
              ),
              renderTrigger: true,
              dontRefreshOnChange: true,
              default: [],
              mapStateToProps: (state: ControlPanelState) => {
                const datasource =
                  (state.datasource as Dataset) ||
                  (state as any).explore?.datasource;
                const columnsList = datasource?.columns || [];
                return {
                  allColumns: columnsList,
                };
              },
            },
          },
        ],
        [
          {
            name: 'globalRedirectionUrls',
            config: {
              type: RedirectionConfigControl,
              label: t('Global Redirection URLs'),
              description: t(
                'Configure top-level redirection links (rendered as individual action buttons)',
              ),
              renderTrigger: true,
              dontRefreshOnChange: true,
              default: [],
              isGlobal: true,
              mapStateToProps: (state: ControlPanelState) => {
                const datasource =
                  (state.datasource as Dataset) ||
                  (state as any).explore?.datasource;
                const columnsList = datasource?.columns || [];
                return {
                  allColumns: columnsList,
                };
              },
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      tabOverride: 'customize',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'table_timestamp_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Timestamp format'),
              default: SMART_DATE_ID,
              renderTrigger: true,
              clearable: false,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('D3 time format for datetime columns'),
            },
          },
        ],
        [
          {
            name: 'page_length',
            config: {
              type: 'SelectControl',
              freeForm: true,
              renderTrigger: true,
              label: t('Page length'),
              default: null,
              choices: PAGE_SIZE_OPTIONS,
              description: t('Rows per page, 0 means no pagination'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                !controls?.server_pagination?.value,
            },
          },
          null,
        ],
        [
          {
            name: 'include_search',
            config: {
              type: 'CheckboxControl',
              label: t('Search box'),
              renderTrigger: true,
              default: false,
              description: t('Whether to include a client-side search box'),
            },
          },
        ],
        [
          {
            name: 'allow_rearrange_columns',
            config: {
              type: 'CheckboxControl',
              label: t('Allow columns to be rearranged'),
              renderTrigger: true,
              default: false,
              description: t(
                "Allow end user to drag-and-drop column headers to rearrange them. Note their changes won't persist for the next time they open the chart.",
              ),
              visibility: ({ controls }) =>
                isEmpty(controls?.time_compare?.value),
            },
          },
        ],
        [
          {
            name: 'allow_render_html',
            config: {
              type: 'CheckboxControl',
              label: t('Render columns in HTML format'),
              renderTrigger: true,
              default: true,
              description: t(
                'Renders table cells as HTML when applicable. For example, HTML <a> tags will be rendered as hyperlinks.',
              ),
            },
          },
        ],
        [
          {
            name: 'column_config',
            config: {
              type: 'ColumnConfigControl',
              label: t('Customize columns'),
              description: t('Further customize how to display each column'),
              width: 400,
              height: 320,
              renderTrigger: true,
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                const timeComparisonValue =
                  explore?.controls?.time_compare?.value;
                const { colnames: _colnames, coltypes: _coltypes } =
                  chart?.queriesResponse?.[0] ?? {};
                let colnames: string[] = _colnames || [];
                let coltypes: GenericDataType[] = _coltypes || [];
                const childColumnMap: Record<string, boolean> = {};
                const timeComparisonColumnMap: Record<string, boolean> = {};

                if (!isEmpty(timeComparisonValue)) {
                  /**
                   * Replace numeric columns with sets of comparison columns.
                   */
                  const updatedColnames: string[] = [];
                  const updatedColtypes: GenericDataType[] = [];

                  colnames
                    .filter(
                      colname =>
                        last(colname.split('__')) !== timeComparisonValue,
                    )
                    .forEach((colname, index) => {
                      // Skip unprefixed percent metric columns if a prefixed version exists
                      // But don't skip if it's also a regular metric
                      if (
                        shouldSkipMetricColumn({
                          colname,
                          colnames,
                          formData: explore.form_data,
                        })
                      ) {
                        return;
                      }

                      const isMetric = isRegularMetric(
                        colname,
                        explore.form_data,
                      );
                      const isPercentMetricValue = isPercentMetric(
                        colname,
                        explore.form_data,
                      );

                      // Generate comparison columns for metrics (time comparison feature)
                      if (isMetric || isPercentMetricValue) {
                        const comparisonColumns =
                          generateComparisonColumns(colname);
                        comparisonColumns.forEach((name, idx) => {
                          updatedColnames.push(name);
                          updatedColtypes.push(
                            ...generateComparisonColumnTypes(4),
                          );
                          timeComparisonColumnMap[name] = true;
                          if (idx === 0 && name.startsWith('Main ')) {
                            childColumnMap[name] = false;
                          } else {
                            childColumnMap[name] = true;
                          }
                        });
                      } else {
                        updatedColnames.push(colname);
                        updatedColtypes.push(coltypes[index]);
                        childColumnMap[colname] = false;
                        timeComparisonColumnMap[colname] = false;
                      }
                    });

                  colnames = updatedColnames;
                  coltypes = updatedColtypes;
                }
                return {
                  columnsPropsObject: {
                    colnames,
                    coltypes,
                    childColumnMap,
                    timeComparisonColumnMap,
                  },
                };
              },
            },
          },
        ],
      ],
    },
    {
      label: t('Visual formatting'),
      tabOverride: 'customize',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_cell_bars',
            config: {
              type: 'CheckboxControl',
              label: t('Show cell bars'),
              renderTrigger: true,
              default: true,
              description: t(
                'Whether to display a bar chart background in table columns',
              ),
            },
          },
        ],
        [
          {
            name: 'align_pn',
            config: {
              type: 'CheckboxControl',
              label: t('Align +/-'),
              renderTrigger: true,
              default: false,
              description: t(
                'Whether to align background charts with both positive and negative values at 0',
              ),
            },
          },
        ],
        [
          {
            name: 'color_pn',
            config: {
              type: 'CheckboxControl',
              label: t('Add colors to cell bars for +/-'),
              renderTrigger: true,
              default: true,
              description: t(
                'Whether to colorize numeric values by whether they are positive or negative',
              ),
            },
          },
        ],
        [
          {
            name: 'comparison_color_enabled',
            config: {
              type: 'CheckboxControl',
              label: t('Basic conditional formatting'),
              renderTrigger: true,
              visibility: ({ controls }) =>
                !isEmpty(controls?.time_compare?.value),
              default: false,
              description: t(
                'This will be applied to the whole table. Arrows (↑ and ↓) will be added to ' +
                  'main columns for increase and decrease. Basic conditional formatting can be ' +
                  'overwritten by conditional formatting below.',
              ),
            },
          },
        ],
        [
          {
            name: 'comparison_color_scheme',
            config: {
              type: 'SelectControl',
              label: t('color type'),
              default: ColorSchemeEnum.Green,
              renderTrigger: true,
              choices: [
                [ColorSchemeEnum.Green, 'Green for increase, red for decrease'],
                [ColorSchemeEnum.Red, 'Red for increase, green for decrease'],
              ],
              visibility: ({ controls }) =>
                !isEmpty(controls?.time_compare?.value) &&
                Boolean(controls?.comparison_color_enabled?.value),
              description: t(
                'Adds color to the chart symbols based on the positive or ' +
                  'negative change from the comparison value.',
              ),
            },
          },
        ],
        [
          {
            name: 'conditional_formatting',
            config: {
              type: 'ConditionalFormattingControl',
              renderTrigger: true,
              label: t('Custom conditional formatting'),
              extraColorChoices: [
                {
                  value: ColorSchemeEnum.Green,
                  label: t('Green for increase, red for decrease'),
                },
                {
                  value: ColorSchemeEnum.Red,
                  label: t('Red for increase, green for decrease'),
                },
              ],
              description: t(
                'Apply conditional color formatting to numeric columns',
              ),
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                const verboseMap = explore?.datasource?.hasOwnProperty(
                  'verbose_map',
                )
                  ? (explore?.datasource as Dataset)?.verbose_map
                  : (explore?.datasource?.columns ?? {});
                const chartStatus = chart?.chartStatus;
                const { colnames, coltypes } =
                  chart?.queriesResponse?.[0] ?? {};
                const numericColumns =
                  Array.isArray(colnames) && Array.isArray(coltypes)
                    ? colnames
                        .filter(
                          (colname: string, index: number) =>
                            coltypes[index] === GenericDataType.Numeric,
                        )
                        .map((colname: string) => ({
                          value: colname,
                          label: Array.isArray(verboseMap)
                            ? colname
                            : (verboseMap[colname] ?? colname),
                        }))
                    : [];
                const columnOptions = explore?.controls?.time_compare?.value
                  ? processComparisonColumns(
                      numericColumns || [],
                      ensureIsArray(
                        explore?.controls?.time_compare?.value,
                      )[0]?.toString() || '',
                    )
                  : numericColumns;

                return {
                  removeIrrelevantConditions: chartStatus === 'success',
                  columnOptions,
                  verboseMap,
                };
              },
            },
          },
        ],
      ],
    },
    {
      ...sections.timeComparisonControls({
        multi: false,
        showCalculationType: false,
        showFullChoices: false,
      }),
      visibility: isAggMode,
    },
  ],
  formDataOverrides: formData => {
    const hierarchyColumnDefs: Record<string, string> =
      formData.hierarchyColumnDefs || {};

    const hierarchyColumns = ensureIsArray(formData.hierarchyColumns).map(
      (col: any) => {
        if (typeof col === 'object' && col !== null) {
          const colNameStr = col.column_name || col.label || col.columnName;
          const expr =
            col.expression ||
            col.sqlExpression ||
            col.sql_expression ||
            col.sql ||
            hierarchyColumnDefs[colNameStr];
          if (colNameStr && expr) {
            hierarchyColumnDefs[colNameStr] = expr;
            return {
              column_name: colNameStr,
              label: colNameStr,
              expression: expr,
            };
          }
        }
        return col;
      },
    );

    return {
      ...formData,
      metrics: getStandardizedControls().popAllMetrics(),
      groupby: getStandardizedControls().popAllColumns(),
      hierarchyColumns,
      hierarchyColumnDefs,
    };
  },
};

export default config;
