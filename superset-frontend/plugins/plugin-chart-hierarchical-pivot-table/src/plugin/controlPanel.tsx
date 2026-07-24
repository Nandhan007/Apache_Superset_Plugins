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
  ControlPanelConfig,
  D3_TIME_FORMAT_OPTIONS,
  Dataset,
  getStandardizedControls,
  sharedControls,
  ControlPanelState,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  isAdhocColumn,
  isPhysicalColumn,
  QueryFormMetric,
  SMART_DATE_ID,
  validateNonEmpty,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { MetricsLayoutEnum } from '../types';
import CellEditPayloadMappingControl from '../components/CellEditPayloadMappingControl';
import ChartLevelActionsControl from '../components/ChartLevelActionsControl';
import RowLevelActionsControl from '../components/RowLevelActionsControl';
import HTMLViewerActionsControl from '../components/HTMLViewerActionsControl';
import RedirectionConfigControl from '../components/RedirectionConfigControl';

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

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupbyColumns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Columns to group by on the columns'),
            },
          },
        ],
        [
          {
            name: 'groupbyRows',
            config: {
              ...sharedControls.groupby,
              label: t('Rows'),
              description: t('Columns to group by on the rows'),
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
                  ensureIsArray(controls?.groupbyColumns?.options).map(
                    option => [option.column_name, option.is_dttm],
                  ),
                );

                return [
                  ...ensureIsArray(controls?.groupbyColumns.value),
                  ...ensureIsArray(controls?.groupbyRows.value),
                ]
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
            config: {
              ...sharedControls.metrics,
              validators: [validateNonEmpty],
              rerender: ['conditional_formatting', 'editableMetrics'],
            },
          },
        ],
        [
          {
            name: 'metricsLayout',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Apply metrics on'),
              default: MetricsLayoutEnum.COLUMNS,
              options: [
                [MetricsLayoutEnum.COLUMNS, t('Columns')],
                [MetricsLayoutEnum.ROWS, t('Rows')],
              ],
              description: t(
                'Use metrics as a top level group for columns or for rows',
              ),
            },
          },
        ],
        ['adhoc_filters'],
        ['series_limit'],
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
              label: t('Cell limit'),
              description: t('Limits the number of cells that get retrieved.'),
            },
          },
        ],
        // TODO(kgabryje): add series_columns control after control panel is redesigned to avoid clutter
        [
          {
            name: 'series_limit_metric',
            config: {
              ...sharedControls.series_limit_metric,
              description: t(
                'Metric used to define how the top series are sorted if a series or cell limit is present. ' +
                  'If undefined reverts to the first metric (where appropriate).',
              ),
            },
          },
        ],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
            },
          },
        ],
      ],
    },

    {
      label: t('Hierarchy Configuration'),
      expanded: true,
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
                const value =
                  controlState?.value ||
                  state.controls?.hierarchyColumns?.value ||
                  [];

                // Filter options to ONLY include calculated columns (columns with an expression)
                // Omit expression property from option objects so ColumnSelectPopover populates simpleColumns (Simple tab)
                const calculatedColumns = allColumns
                  .filter((c: any) => {
                    if (!c) return false;
                    const expr =
                      c.expression || c.sqlExpression || c.sql_expression || c.sql;
                    return Boolean(
                      expr && typeof expr === 'string' && expr.trim().length > 0,
                    );
                  })
                  .map((c: any) => ({
                    column_name: c.column_name,
                    verbose_name: c.verbose_name || c.label || c.column_name,
                    label: c.verbose_name || c.label || c.column_name,
                    type: c.type || 'STRING',
                    type_generic: c.type_generic,
                    groupby: true,
                  }));

                const seenNames = new Set<string>();
                const uniqueValueList = (Array.isArray(value) ? value : []).filter(
                  (colItem: any) => {
                    const colNameStr =
                      typeof colItem === 'object' && colItem !== null
                        ? colItem.column_name || colItem.label || colItem.columnName
                        : String(colItem);
                    if (!colNameStr || seenNames.has(colNameStr)) {
                      return false;
                    }
                    seenNames.add(colNameStr);
                    return true;
                  },
                );

                const enrichedValue =
                  uniqueValueList.length > 0 &&
                  Array.isArray(allColumns) &&
                  allColumns.length > 0
                    ? uniqueValueList.map((colItem: any) => {
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
                        if (colDef) {
                          const expr =
                            colDef.expression ||
                            colDef.sqlExpression ||
                            colDef.sql_expression ||
                            colDef.sql;
                          if (expr) {
                            if (typeof colItem === 'object' && colItem !== null) {
                              return {
                                ...colDef,
                                ...colItem,
                                column_name: colNameStr,
                                label: colDef.verbose_name || colDef.label || colNameStr,
                                expression: expr,
                                groupby: true,
                              };
                            }
                            return {
                              ...colDef,
                              column_name: colNameStr,
                              label: colDef.verbose_name || colDef.label || colNameStr,
                              expression: expr,
                              groupby: true,
                            };
                          }
                        }
                        if (typeof colItem === 'object' && colItem !== null) {
                          return { ...colItem, groupby: true };
                        }
                        return { column_name: colNameStr, label: colNameStr, groupby: true };
                      })
                    : uniqueValueList;

                return {
                  ...props,
                  options: calculatedColumns,
                  value: enrichedValue,
                };
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
      ],
    },
    {
      label: t('Backend Settings'),
      expanded: true,
      tabOverride: 'data',
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
              description: t('Configure redirection links for the table'),
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
      expanded: true,
      tabOverride: 'data',
      controlSetRows: [
        [
          {
            name: 'aggregateFunction',
            config: {
              type: 'SelectControl',
              label: t('Aggregation function'),
              clearable: false,
              choices: [
                ['Count', t('Count')],
                ['Count Unique Values', t('Count Unique Values')],
                ['List Unique Values', t('List Unique Values')],
                ['Sum', t('Sum')],
                ['Average', t('Average')],
                ['Median', t('Median')],
                ['Sample Variance', t('Sample Variance')],
                ['Sample Standard Deviation', t('Sample Standard Deviation')],
                ['Minimum', t('Minimum')],
                ['Maximum', t('Maximum')],
                ['First', t('First')],
                ['Last', t('Last')],
                ['Sum as Fraction of Total', t('Sum as Fraction of Total')],
                ['Sum as Fraction of Rows', t('Sum as Fraction of Rows')],
                ['Sum as Fraction of Columns', t('Sum as Fraction of Columns')],
                ['Count as Fraction of Total', t('Count as Fraction of Total')],
                ['Count as Fraction of Rows', t('Count as Fraction of Rows')],
                [
                  'Count as Fraction of Columns',
                  t('Count as Fraction of Columns'),
                ],
              ],
              default: 'Sum',
              description: t(
                'Aggregate function to apply when pivoting and computing the total rows and columns',
              ),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'rowTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show rows total'),
              default: false,
              renderTrigger: true,
              description: t('Display row level total'),
            },
          },
        ],
        [
          {
            name: 'rowSubTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show rows subtotal'),
              default: false,
              renderTrigger: true,
              description: t('Display row level subtotal'),
            },
          },
        ],
        [
          {
            name: 'colTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show columns total'),
              default: false,
              renderTrigger: true,
              description: t('Display column level total'),
            },
          },
        ],
        [
          {
            name: 'colSubTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show columns subtotal'),
              default: false,
              renderTrigger: true,
              description: t('Display column level subtotal'),
            },
          },
        ],
        [
          {
            name: 'transposePivot',
            config: {
              type: 'CheckboxControl',
              label: t('Transpose pivot'),
              default: false,
              description: t('Swap rows and columns'),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'combineMetric',
            config: {
              type: 'CheckboxControl',
              label: t('Combine metrics'),
              default: false,
              description: t(
                'Display metrics side by side within each column, as ' +
                  'opposed to each column being displayed side by side for each metric.',
              ),
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'editableMetrics',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('Editable Metrics'),
              description: t(
                'Select specific metrics to enforce their editability. Checked metrics will be editable, unchecked metrics will be read-only.',
              ),
              default: [],
              renderTrigger: true,
              visibility: ({ controls }) =>
                ensureIsArray(controls?.metrics?.value).length > 0,
              mapStateToProps: (state: ControlPanelState) => {
                const formMetrics = ensureIsArray(
                  state?.controls?.metrics?.value,
                );
                const datasourceMetrics =
                  (state?.datasource as Dataset)?.metrics || [];

                // Merge form metrics with available datasource metrics to ensure we catch everything
                // However, usually we only want to allow editing *selected* metrics?
                // The requirements say "list of all metrics defined in the Data section".
                // So we stick to `state?.controls?.metrics?.value`.

                const choices = formMetrics
                  .map((metric: any) => {
                    if (!metric) {
                      return null;
                    }
                    let metricValue: string = '';
                    let metricLabel: string = '';

                    if (typeof metric === 'string') {
                      metricValue = metric;
                      const metricDef = datasourceMetrics.find(
                        (m: any) => m.metric_name === metric,
                      );
                      metricLabel =
                        metricDef?.verbose_name ||
                        metricDef?.metric_name ||
                        metric;
                    } else if (metric.label) {
                      metricValue = metric.label;
                      metricLabel = metric.label;
                    } else if (
                      metric.expressionType === 'SIMPLE' &&
                      metric.column?.column_name
                    ) {
                      metricValue = metric.column.column_name;
                      metricLabel = metric.column.column_name;
                    } else {
                      const fallbackValue =
                        metric.column?.column_name ||
                        metric.label ||
                        JSON.stringify(metric);
                      metricValue = fallbackValue;
                      metricLabel = metric.label || metricValue;
                    }

                    if (!metricValue) {
                      return null;
                    }

                    return [metricValue, metricLabel];
                  })
                  .filter(Boolean) as [string, string][];

                return {
                  choices,
                };
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
        [
          {
            name: 'valueFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Value format'),
            },
          },
        ],
        ['currency_format'],
        [
          {
            name: 'date_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              default: SMART_DATE_ID,
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('D3 time format for datetime columns'),
            },
          },
        ],
        [
          {
            name: 'rowOrder',
            config: {
              type: 'SelectControl',
              label: t('Sort rows by'),
              default: 'key_a_to_z',
              choices: [
                // [value, label]
                ['key_a_to_z', t('key a-z')],
                ['key_z_to_a', t('key z-a')],
                ['value_a_to_z', t('value ascending')],
                ['value_z_to_a', t('value descending')],
              ],
              renderTrigger: true,
              description: (
                <>
                  <div>{t('Change order of rows.')}</div>
                  <div>{t('Available sorting modes:')}</div>
                  <ul>
                    <li>{t('By key: use row names as sorting key')}</li>
                    <li>{t('By value: use metric values as sorting key')}</li>
                  </ul>
                </>
              ),
            },
          },
        ],

        [
          {
            name: 'colOrder',
            config: {
              type: 'SelectControl',
              label: t('Sort columns by'),
              default: 'key_a_to_z',
              choices: [
                // [value, label]
                ['key_a_to_z', t('key a-z')],
                ['key_z_to_a', t('key z-a')],
                ['value_a_to_z', t('value ascending')],
                ['value_z_to_a', t('value descending')],
              ],
              renderTrigger: true,
              description: (
                <>
                  <div>{t('Change order of columns.')}</div>
                  <div>{t('Available sorting modes:')}</div>
                  <ul>
                    <li>{t('By key: use column names as sorting key')}</li>
                    <li>{t('By value: use metric values as sorting key')}</li>
                  </ul>
                </>
              ),
            },
          },
        ],
        [
          {
            name: 'rowSubtotalPosition',
            config: {
              type: 'SelectControl',
              label: t('Rows subtotal position'),
              default: false,
              choices: [
                // [value, label]
                [true, t('Top')],
                [false, t('Bottom')],
              ],
              renderTrigger: true,
              description: t('Position of row level subtotal'),
            },
          },
        ],
        [
          {
            name: 'colSubtotalPosition',
            config: {
              type: 'SelectControl',
              label: t('Columns subtotal position'),
              default: false,
              choices: [
                // [value, label]
                [true, t('Left')],
                [false, t('Right')],
              ],
              renderTrigger: true,
              description: t('Position of column level subtotal'),
            },
          },
        ],
        [
          {
            name: 'conditional_formatting',
            config: {
              type: 'ConditionalFormattingControl',
              renderTrigger: true,
              label: t('Conditional formatting'),
              description: t('Apply conditional color formatting to metrics'),
              mapStateToProps(explore, _, chart) {
                const values =
                  (explore?.controls?.metrics?.value as QueryFormMetric[]) ??
                  [];
                const verboseMap = explore?.datasource?.hasOwnProperty(
                  'verbose_map',
                )
                  ? (explore?.datasource as Dataset)?.verbose_map
                  : (explore?.datasource?.columns ?? {});
                const chartStatus = chart?.chartStatus;
                const metricColumn = values.map(value => {
                  if (typeof value === 'string') {
                    return {
                      value,
                      label: Array.isArray(verboseMap)
                        ? value
                        : verboseMap[value],
                    };
                  }
                  return { value: value.label, label: value.label };
                });
                return {
                  removeIrrelevantConditions: chartStatus === 'success',
                  columnOptions: metricColumn,
                  verboseMap,
                };
              },
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
  ],
  formDataOverrides: formData => {
    const hierarchyColumnDefs: Record<string, string> =
      formData.hierarchyColumnDefs || {};

    const seenNames = new Set<string>();
    const hierarchyColumns: any[] = [];

    ensureIsArray(formData.hierarchyColumns).forEach((col: any) => {
      const colNameStr =
        typeof col === 'object' && col !== null
          ? col.column_name || col.label || col.columnName
          : String(col);

      if (!colNameStr || seenNames.has(colNameStr)) return;
      seenNames.add(colNameStr);

      if (typeof col === 'object' && col !== null) {
        const expr =
          col.expression ||
          col.sqlExpression ||
          col.sql_expression ||
          col.sql ||
          hierarchyColumnDefs[colNameStr];
        if (expr) {
          hierarchyColumnDefs[colNameStr] = expr;
          hierarchyColumns.push({
            ...col,
            column_name: colNameStr,
            label: col.label || colNameStr,
            expression: expr,
          });
          return;
        }
      }
      hierarchyColumns.push(col);
    });

    const groupbyColumns = getStandardizedControls().controls.columns.filter(
      col => !ensureIsArray(formData.groupbyRows).includes(col),
    );
    getStandardizedControls().controls.columns =
      getStandardizedControls().controls.columns.filter(
        col => !groupbyColumns.includes(col),
      );

    return {
      ...formData,
      metrics: getStandardizedControls().popAllMetrics(),
      groupbyColumns,
      hierarchyColumns,
      hierarchyColumnDefs,
    };
  },
};

export default config;
