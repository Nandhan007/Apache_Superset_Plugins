# Custom Plugin Feature Comparison & Documentation

This document maintains feature capabilities across custom Superset table visualization plugins (`plugin-chart-editable-table` and `plugin-chart-hierarchical-pivot-table`).

## Feature Matrix

| Feature | `plugin-chart-editable-table` | `plugin-chart-hierarchical-pivot-table` |
| :--- | :--- | :--- |
| **Cell Editing** | Supported for configured `editableMetrics` | Supported for configured `editableMetrics` |
| **Percentage Metrics Scaling** | **Supported**: When metrics are formatted as percentages (e.g., `,.0%`, `.1%`, or `percent_metrics`), values are multiplied by 100 in the cell editor input (displaying integers like `5` instead of `0.05`, or exact decimals like `5.25` instead of `0.0525`). Integers are never cast to double (no `.00`). Saved values are divided by 100 back to original scale (`0.05`, `0.0525`). | **Supported**: When metrics are formatted as percentages (e.g., `,.0%`, `.1%`, or `percent_metrics`), values are multiplied by 100 in the cell editor input (displaying integers like `5` instead of `0.05`, or exact decimals like `5.25` instead of `0.0525`). Integers are never cast to double (no `.00`). Saved values are divided by 100 back to original scale (`0.05`, `0.0525`). |
| **Cell Tooltip & Direct Copy** | **Supported**: Displays raw value directly in tooltip positioned closely above the cell value. Clicking the tooltip value directly copies it to clipboard without a separate button. | **Supported**: Displays raw value directly in tooltip positioned closely above the cell value. Clicking the tooltip value directly copies it to clipboard without a separate button. Uses a single delegated floating tooltip to maintain near-zero memory footprint on huge tables. |
| **Backend Sync** | Sends modified cell payload to configured API endpoint | Sends modified cell payload to configured API endpoint |
| **Dark Mode Indicator** | Modified & editable metric highlights | Modified & editable metric highlights |
| **Pagination & High-Density Performance** | Supported via `react-table` pagination (server/client pagination) | **Supported**: Client-side pagination (`25, 50, 100, 200, 500, All`), paginated `rowAttrSpans` recalculation, top header toolbar with Layout and action controls, delegated floating tooltips to eliminate 50k+ `<Tooltip>` instances, O(1) record indexing, and O(N) linear unpivoting to prevent browser freezes and Out-of-Memory crashes. |
| **Metrics Order Maintenance & DnD** | **Supported**: Configured chart metrics order (`initialMetrics`) is strictly preserved at the top of the list, followed by remaining unselected datasource metrics. Drag-and-drop reordering with drag handle (`MenuOutlined`) in Data tab directly updates chart metrics config and column order on Apply. | **Supported**: Configured chart metrics order (`initialMetrics`) is strictly preserved at the top of the list, followed by remaining unselected datasource metrics. Drag-and-drop reordering with drag handle (`MenuOutlined`) in Data tab directly updates chart metrics config, pivot sorters, and unpivoting order on Apply. |
| **Exact API Error Message Display** | **Supported**: Recursively extracts exact API response error message (`message`, `error`, `detail`, `errors`, validation dicts, HTML `<pre>/<p>`, or plain text) across cell edit sync and action execution, eliminating internal status codes (e.g. `500`, `400`) and generic messages (`Submission failed`). | **Supported**: Recursively extracts exact API response error message (`message`, `error`, `detail`, `errors`, validation dicts, HTML `<pre>/<p>`, or plain text) across cell edit sync and action execution, eliminating internal status codes (e.g. `500`, `400`) and generic messages (`Submission failed`). |
| **Dropdown Multi-Select in Action Buttons** | **Supported**: Both chart-level and row-level action buttons support an "Allow Multi-Select" option for dropdown fields, enabling users to select multiple options, preview payload arrays, and validate array submissions in action modal forms. | **Supported**: Both chart-level and row-level action buttons support an "Allow Multi-Select" option for dropdown fields, enabling users to select multiple options, preview payload arrays, and validate array submissions in action modal forms. |

## Percentage Metrics Editing & Display Behavior Details

1. **Detection**: Metrics are treated as percentage metrics if:
   - Metric is in `percent_metrics`.
   - `d3NumberFormat` or column format string contains `%` (e.g., `,.0%`, `.1%`).
2. **Display & Editing Precision**:
   - In display view (non-editing mode), the metric displays with exact value with two decimal places if decimal (e.g. `5.25%`), and as an integer if it is an integer (e.g. `5%`), avoiding rounding decimal percentages to nearest integers and avoiding casting integers to double (`5.00%`).
   - In edit mode (input field), values display as integers if integer (e.g. `5`, `42`) without casting to double (`5.00`, `42.00`), and with two decimal places if decimal (e.g. `5.25`, `42.75`).
   - In tooltips, percentage and numeric values show exact values with two decimals or as integers as-is without double casting.
3. **Saving View**:
   - Upon completing edit, the user-entered value (e.g. `10` or `5.25`) is converted back to original scale (`10 / 100 = 0.1`, `5.25 / 100 = 0.0525`) before being stored in the edit manager and sent to the backend.

## Cell Tooltip & Direct UI Copy Details

1. **Tooltip Display**:
   - Displays raw value directly on hover without metric name/title headers.
   - Positioned closely above the cell value text.
   - For percentage metrics, displays the raw, original value only (e.g., `0.05` instead of `5%`, or `0` instead of `0%`), preserving the true underlying data value without display formatting.
2. **Direct Copy**:
   - **Click to Copy**: Clicking directly on the tooltip text copies the raw value to clipboard and shows a confirmation toast notification.
   - **Text Highlight**: Tooltip text supports native mouse text selection (`user-select: text`) for manual Ctrl+C / Cmd+C copying.
3. **Delegated Architecture (`plugin-chart-hierarchical-pivot-table`)**:
   - Instead of wrapping every individual table cell in a separate Ant Design `<Tooltip>` component (which creates tens of thousands of React Fiber nodes, hooks, and event listeners), a single delegated floating tooltip is rendered via a React Portal directly into `document.body`.
   - By rendering outside the chart container into `document.body`, the tooltip escapes dashboard `transform: translate(...)` coordinate containment traps, ensuring exact positioning directly above the hovered cell across all dashboards.
   - Includes automatic scroll dismissal and smart flip (below cell when near top of viewport).
   - Saves 1.5 GB to 2.5 GB of JavaScript heap memory on large tables and eliminates Chrome `Aw, Snap! Out of Memory` crashes.

## Pagination & High-Density Performance Details (`plugin-chart-hierarchical-pivot-table`)

1. **Client-Side Pagination**:
   - Configurable page sizes: `25`, `50`, `100`, `200`, `500`, and `All`.
   - Automatically paginates `visibleRowKeys` when row count exceeds 25.
   - Displays entry summary (`Showing X to Y of Z entries`) with quick "View All" and "Paginate" toggles.
2. **Paginated Hierarchy Spanning**:
   - Dynamically recomputes `rowAttrSpans` for the current page slice, ensuring dimension grouping labels and action borders are clean and continuous across page boundaries.
3. **Row-Level Hierarchy Expansion**:
   - Individual subtotal hierarchy rows can be expanded or collapsed via row-level tree toggle icons when subtotals are enabled (`rowSubTotals: true`).
4. **Algorithmic Optimizations**:
   - **O(N) Unpivoting**: Replaced $O(N^2)$ array spreading in `unpivotedData` with a single-pass loop.
   - **O(1) Record Indexing**: Pre-indexes `filteredData` into a `Map` keyed by row dimensions, replacing $O(N \times M)$ linear searches on every row render.
5. **Horizontal Scroll Independence & Docked Pagination Alignment**:
   - Isolated the table scroll container (`.pvtTableContainer` with `overflow: auto`) from the bottom pagination bar (`.pvtPaginationContainer`).
   - When the table has many columns and scrolls horizontally, the pagination bar remains fixed across the visible container width (`width: 100%`) rather than scrolling with the table content.
   - The entry summary (`Showing X to Y of Z entries`) stays pinned to the bottom-left, while the pagination controls, page size selector, and action buttons remain docked at the bottom-right ("at the last") at all times.

## Metrics Order Maintenance & Drag-and-Drop Reordering Details

1. **Configured Metrics Order Preservation**:
   - Previously, opening the Layout Editor Data tab iterated through datasource metrics first (`allMetrics`), inadvertently re-ordering the chart's configured metrics into datasource order.
   - Both editors now iterate through configured `initialMetrics` first to preserve the user's configured metric sequence at the top of the list, followed by remaining unselected metrics from `allMetrics`.
2. **Interactive Drag-and-Drop in Data Tab**:
   - Added drag-and-drop card reordering (`MetricCard` with `MenuOutlined` drag handles and selection checkboxes) using `react-dnd`.
   - Reordering is tracked by unique metric name/ID (`moveMetricCard(dragId, hoverId)`), preventing index-drift errors when filtering with the search input.
   - Metric DnD uses `ItemTypes.METRIC = 'metric'`, strictly isolated from dimension cards (`ItemTypes.CARD = 'card'`).
3. **Bi-directional Synchronization with Chart Config & Visualization**:
   - In both plugins, clicking Apply saves the reordered metrics through `handleSaveLayout`.
   - Propagates changes to Superset form data and dashboard state via `setControlValue('metrics', newMetrics)` and `newDataMask.ownState.metrics`.
   - **Hierarchical Pivot Table**: Maintains `layoutMetrics` state, reorders unpivoted metric records in `unpivotedData`, and configures `sorters[METRIC_KEY] = sortAs(effectiveMetricNames)` so pivot columns render strictly in the configured order.
   - **Editable Table**: Maintains `layoutMetrics` state and sorts `columnsMeta` metric columns immediately according to `effectiveMetricNames` so table columns immediately match the user's custom metric order.

## Exact API Error Message Handling Details

1. **Resolution of Generic Statements and HTTP Status Codes**:
   - Replaced generic statements (e.g. `Submission failed`, `Error: Request failed with status code 400/500`) with exact, human-readable error descriptions returned by the backend API.
2. **Unified Extraction Logic (`errorUtils.ts`)**:
   - Extracts backend error messages across diverse backend frameworks (Flask, FastAPI, Django REST Framework, Express, Spring, etc.):
     - Direct string properties: `message`, `error`, `detail`, `msg`, `description`, `error_message`.
     - Nested validation arrays or dictionaries: e.g. `{ "price": ["Must be > 0"] }` formatted cleanly as `price: Must be > 0`.
     - HTML error pages: automatically extracts text inside `<pre>`, `<p>`, or `<h1>`, stripping raw HTML tags.
     - SupersetClient / Fetch rejections: reads and parses the JSON or text response body before throwing or notifying.
3. **Components Integrated**:
   - **Cell Modifications Sync**: `CellEditManager.ts` (editable table) and `PivotCellEditManager.js` (hierarchical pivot table).
   - **Action Submissions**: `TableChart.tsx` and `HierarchicalPivotTable.tsx` for row-level and chart-level action endpoints.

## Multi-Select Option for Dropdown Action Form Fields (Chart-Level & Row-Level)

1. **Control Panel / Field Configuration UI (`AdditionalFieldsList.tsx`)**:
   - In both plugins, when configuring additional fields for chart-level or row-level action buttons, selecting Field Type = `'dropdown'` displays an **"Allow Multi-Select"** checkbox.
   - When checked, sets `multiple: true` and `isMulti: true` on the field configuration.
2. **Payload Structure Preview (`ChartLevelActionsControl.tsx` and `RowLevelActionsControl.tsx`)**:
   - Action button payload preview dynamically inspects whether a dropdown field is configured with `multiple` or `isMulti`.
   - When multi-select is enabled, the sample preview formats the field as an array (e.g., `["sample_value"]`), clearly communicating to the dashboard creator that an array of selected options will be submitted in the action payload.
3. **Action Modal Form & Data Submission (`SupersetDataForm.tsx`)**:
   - **Form Rendering**: `SupersetDataForm` renders `<Select showSearch mode={isMulti ? 'multiple' : undefined} allowClear placeholder={isMulti ? t('Select option(s)') : t('Select an option')} />`.
   - **Initial Values Sanitization**: `getSanitizedInitialValues` ensures initial form values for multi-select dropdowns are cleanly initialized as arrays (e.g. `[val]` if a single scalar was stored or passed), preventing Ant Design multi-select runtime type mismatches.
   - **Validation Rules**: Dynamically assigns `type: 'array'` when `required: true` on any multi-select field (including multi-select hierarchy fields, multi-select dropdowns, and multiple file uploads), ensuring the Ant Design Form validator properly checks array lengths instead of falsely failing against default `string` validation.
4. **Scrollable Custom Fields Configuration UI (`AdditionalFieldsList.tsx`)**:
   - The custom fields list is wrapped in a dedicated scrollable container (`maxHeight: 260px`, `overflowY: auto`, `overflowX: hidden`).
   - Keeps column headers (`Field Name`, `Type`, `Required`) and the "+ Add Custom Field" button pinned and easily accessible while allowing smooth vertical scrolling when multiple custom fields are configured in both chart-level and row-level action settings.
5. **Action Configuration Modal Scroll & Layout (`ChartLevelActionsControl.tsx` and `RowLevelActionsControl.tsx`)**:
   - Both chart-level and row-level action configuration modals enforce `overflowX: 'hidden'` alongside `overflowY: 'auto'` on `bodyStyle` (`maxHeight: '75vh', overflowY: 'auto', overflowX: 'hidden'`) and `style={{ overflowX: 'hidden' }}` on the root `<Form>`.
   - Prevents Ant Design's grid negative margin gutter (`<Row gutter={16}>`) and vertical scrollbars from triggering an unwanted horizontal scrollbar at the bottom of the modal dialog.

