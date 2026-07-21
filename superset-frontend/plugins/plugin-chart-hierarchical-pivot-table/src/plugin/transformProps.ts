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
  ChartProps,
  DataRecord,
  ensureIsArray,
  extractTimegrain,
  getTimeFormatter,
  getTimeFormatterForGranularity,
  QueryFormData,
  SMART_DATE_ID,
  TimeFormats,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { getColorFormatters } from '@superset-ui/chart-controls';
import { DateFormatter } from '../types';
import { HierarchyFieldConfig } from '../types/hierarchy';

const { DATABASE_DATETIME } = TimeFormats;

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

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(
    record =>
      record[key] === null ||
      record[key] === undefined ||
      typeof record[key] === 'number',
  );
}

export default function transformProps(chartProps: ChartProps<QueryFormData>) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your PivotTableChart.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    hooks: {
      setDataMask = () => {},
      onContextMenu,
      setControlValue,
      setForceQuery,
    },
    filterState,
    datasource: { verboseMap = {}, columnFormats = {}, currencyFormats = {} },
    emitCrossFilters,
  } = chartProps;
  // User noted isRefreshing is available in chartProps
  const isRefreshing = (chartProps as any).isRefreshing;

  const { data, colnames, coltypes } = queriesData[0];
  const {
    groupbyRows,
    groupbyColumns,
    metrics,
    tableRenderer,
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
    dateFormat,
    metricsLayout,
    conditionalFormatting,
    timeGrainSqla,
    currencyFormat,
    allowRenderHtml,
    backendApiUrl,
    editableMetrics,
    useCustomSorting,
    hierarchyColumns,
    chartLevelActions,
    rowLevelActions,
    excludeOptionFilter,
    redirectionUrls,
    globalRedirectionUrls,
    htmlViewerActions,
  } = formData;

  const { selectedFilters } = filterState;
  const granularity = extractTimegrain(rawFormData);

  const selectedHierarchyColumns = ensureIsArray(hierarchyColumns);
  const datasourceColumns = (chartProps.datasource as any)?.columns || [];
  const hierarchyFieldsList: HierarchyFieldConfig[] = [];

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

  const validationErrors: string[] = [];

  selectedHierarchyColumns.forEach((colName: any) => {
    const colNameStr =
      typeof colName === 'object' && colName !== null
        ? (colName as any).column_name || (colName as any).label
        : colName;

    if (!colNameStr) {
      validationErrors.push('Selected hierarchy column is invalid.');
      return;
    }

    const colDef = datasourceColumns.find(
      (c: any) => c.column_name === colNameStr,
    );
    if (!colDef) {
      validationErrors.push(
        `Column "${colNameStr}" selected for hierarchy config was not found in dataset columns metadata.`,
      );
      return;
    }
    if (!colDef.expression) {
      validationErrors.push(
        `Column "${colNameStr}" selected for hierarchy config is not a calculated column (has no SQL expression or JSON string).`,
      );
      return;
    }
    const parsed = parseExpressionJson(colDef.expression);
    try {
      validateHierarchyJson(parsed, colNameStr);
      if (parsed) {
        if (Array.isArray(parsed)) {
          hierarchyFieldsList.push(...parsed);
        } else {
          hierarchyFieldsList.push(parsed);
        }
      }
    } catch (e: any) {
      validationErrors.push(e.message);
    }
  });

  const seen = new Set<string>();
  const hierarchyFields = hierarchyFieldsList.filter(item => {
    const key = item.fieldName || item.columnName;
    if (key && !seen.has(key)) {
      seen.add(key);
      return true;
    }
    return false;
  });

  const dateFormatters = colnames
    .filter(
      (colname: string, index: number) =>
        coltypes[index] === GenericDataType.Temporal,
    )
    .reduce(
      (
        acc: Record<string, DateFormatter | undefined>,
        temporalColname: string,
      ) => {
        let formatter: DateFormatter | undefined;
        if (dateFormat === SMART_DATE_ID) {
          if (granularity) {
            // time column use formats based on granularity
            formatter = getTimeFormatterForGranularity(granularity);
          } else if (isNumeric(temporalColname, data)) {
            formatter = getTimeFormatter(DATABASE_DATETIME);
          } else {
            // if no column-specific format, print cell as is
            formatter = String;
          }
        } else if (dateFormat) {
          formatter = getTimeFormatter(dateFormat);
        }
        if (formatter) {
          acc[temporalColname] = formatter;
        }
        return acc;
      },
      {},
    );
  const metricColorFormatters = getColorFormatters(conditionalFormatting, data);

  return {
    width,
    height,
    data,
    groupbyRows,
    groupbyColumns,
    metrics,
    tableRenderer,
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
    setControlValue,
    setForceQuery,
    datasource:
      (chartProps.datasource as any)?.table_name ||
      (chartProps.datasource as any)?.tableName ||
      (chartProps.datasource as any)?.name,
    datasourceId: (chartProps.datasource as { id?: number })?.id,
    datasourceType: (chartProps.datasource as { type?: string })?.type,
    sliceId: (chartProps.rawFormData as { slice_id?: number })?.slice_id,
    rawFormData: chartProps.rawFormData,
    allColumns: (
      chartProps.datasource as {
        columns?: {
          column_name: string;
          groupby?: boolean;
          expression?: string;
        }[];
      }
    )?.columns?.map(col => ({
      column_name: col.column_name,
      groupby: !!col.groupby,
      expression: col.expression,
    })),
    useCustomSorting,
    isRefreshing,
    hierarchyFields,
    chartLevelActions,
    rowLevelActions,
    excludeOptionFilter,
    cellEditPayloadMapping: formData.cellEditPayloadMapping,
    redirectionUrls,
    globalRedirectionUrls,
    enableLayout: formData.enableLayout !== false,
    htmlViewerActions,
    validationError:
      validationErrors.length > 0 ? validationErrors.join(' | ') : undefined,
  };
}
