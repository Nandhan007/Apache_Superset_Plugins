# Hierarchical Pivot Table - End-to-End Test Cases

This document outlines the test cases for verifying the functionality of the Hierarchical Pivot Table plugin, focusing on configuration, rendering, and action execution.

## 1. Hierarchy Configuration

### 1.1 Add Hierarchy Level
- **Goal**: Verify a new hierarchy level can be added.
- **Steps**:
    1. Open the **Hierarchy** tab in the control panel.
    2. Click **Add Hierarchy Level**.
    3. Enter **Level**: `1`.
    4. Select **Field Name (Internal ID)**: `country_code` (or any available column).
    5. Enter **Display Label**: `Country`.
    6. Select **Database Column**: `country_name`.
    7. Enter **Hierarchy Group**: `Geography`.
    8. Click **OK**.
- **Expected Result**:
    - The new level appears in the list under the "Geography" group header.
    - The list item shows "Country" with description "Level 1 • country_code".

### 1.2 Grouping and Sorting
- **Goal**: Verify levels are grouped by `hierarchyGroup` and groups are sorted alphabetically.
- **Steps**:
    1. Add another level with **Hierarchy Group**: `Product`.
    2. Add a third level with **Hierarchy Group**: `Geography`.
- **Expected Result**:
    - The list shows two headers: "Geography" and "Product".
    - "Geography" group contains two items.
    - "Product" group contains one item.
    - Groups are sorted alphabetically (G before P).

### 1.3 Parent-Child Relationship
- **Goal**: Verify parent field selection is filtered correctly.
- **Steps**:
    1. Edit the `Product` level (Level 1).
    2. Add a new level "Product Detail" (Level 2) in group `Product`.
    3. In **Parent Field(s)** dropdown, type or select.
- **Expected Result**:
    - Only fields from the SAME group (`Product`) and LOWER level (Level 1) should be selectable.
    - Fields from "Geography" should NOT be visible.

### 1.4 Sorting Configuration
- **Goal**: Verify `sortMethod` configuration.
- **Steps**:
    1. Add/Edit a level mapped to a Time column (e.g., `month`).
    2. Set **Sort Method** to `Chronological`.
    3. Save.
- **Expected Result**:
    - In the pivot table interactions or dropdowns, this field should be sorted by time (Jan, Feb...) instead of alphabetically.

## 2. Action Configuration

### 2.1 Chart Level Action - Hierarchy Fields
- **Goal**: Verify selecting specific hierarchy fields for an action.
- **Steps**:
    1. Open **Actions** tab -> **Chart Level Actions**.
    2. Click **Add Action**.
    3. Enter Label: `Add Region Data`.
    4. In **Hierarchy Fields**, select specific hierarchy IDs (e.g., `region`).
    5. Click **OK**.
- **Expected Result**:
    - When triggering this action, the form should ONLY show the dropdown for `region`, not other hierarchy levels.

### 2.2 Additional Fields - Configuration
- **Goal**: Verify adding custom fields including Dropdowns.
- **Steps**:
    1. Edit an Action.
    2. Scroll to **Additional Fields**.
    3. Click **Add Custom Field**.
    4. Set **Name**: `Status`.
    5. Set **Type**: `Dropdown`.
    6. Enter **Options**: `Active, Inactive, Pending`.
    7. Check **Required**.
    8. Click **Add Custom Field** again.
    9. Set **Name**: `Comment`.
    10. Set **Type**: `TextArea`.
- **Expected Result**:
    - Two fields are added to the list.
    - The `Status` field shows the tags input with "Active", "Inactive", "Pending".

### 2.3 Field Reordering
- **Goal**: Verify custom fields can be reordered.
- **Steps**:
    1. In the Additional Fields list, click the **Up Arrow** on the `Comment` field.
- **Expected Result**:
    - `Comment` moves above `Status`.
    - In the rendered Action Form (step 4), `Comment` should appear before `Status`.

### 2.4 Row Level Actions
- **Goal**: Verify configuring row-level actions.
- **Steps**:
    1. Open **Row Level Actions**.
    2. Add Action: `Approve Row`.
    3. Select **Icon**: `CheckOutlined` (or similar).
    4. Select **Dataset Fields**: `revenue`, `profit`.
    5. Save.
- **Expected Result**:
    - An icon appears in the action column of the pivot table rows.
    - Clicking the icon opens a modal pre-filled with `revenue` and `profit` values for that row.

### 2.5 Icon Rendering
- **Goal**: Verify selected icons appear correctly.
- **Steps**:
    1. For a Chart Level Action, select `PlusOutlined`.
    2. For a Row Level Action, select `EditOutlined`.
    3. Save and Run.
- **Expected Result**:
    - The Chart Level Action button shows a "+" icon.
    - The Row Level Action column shows a pencil/edit icon for each row.

## 3. Pivot Table Rendering & Interaction

### 3.1 Initial Render
- **Goal**: Verify the table renders correctly with configured hierarchy.
- **Steps**:
    1. Configure a valid hierarchy with Data.
    2. Run the chart.
- **Expected Result**:
    - Columns correspond to hierarchy levels.
    - Metric columns are displayed on the right.
    - Styling (borders, padding) is correct.

### 3.2 Action Execution
- **Goal**: Verify submitting a form action.
- **Steps**:
    1. Click a Chart Level Action button.
    2. Fill in the form (select Hierarchy value, select Status from dropdown, type Comment).
    3. Click **Submit**.
- **Expected Result**:
    - The `onSubmit` specific payload is sent to the configured API endpoint.
    - A success message or toast appears (if configured).
    - The modal closes.

### 3.3 Form Validation
- **Goal**: Verify required fields enforce validation.
- **Steps**:
    1. Open an Action Form.
    2. Leave a **Required** field (e.g., `Status`) empty.
    3. Click **Submit**.
- **Expected Result**:
    - Submission is blocked.
    - "Please input Status" error message appears under the field.

## 4. Sorting Verification

### 4.1 Chronological Sorting
- **Goal**: Verify months/days sort correctly.
- **Steps**:
    1. Ensure a `month` column is set to `Chronological` sort.
    2. Check the Pivot Table header or Action Form dropdown for this column.
- **Expected Result**:
    - Order should be: January, February, March... (NOT April, August, December...).

## 5. Redirection Settings & Parameters

### 5.1 Same-Tab Target Default & Open in New Tab
- **Goal**: Verify redirection links respect tab settings and default to same-tab navigation.
- **Steps**:
    1. Open the control panel, locate **Redirection Settings**, and click **Configure Redirection URLs**.
    2. Click **Add Link**, enter name `Details` and URL `https://example.com/details`. Keep **Open in New Tab** unchecked.
    3. Save and click **OK**. Run the query.
    4. Click a redirection link from a pivot cell context menu.
    5. Verify the destination opens in the **same** browser tab.
    6. Re-open the configuration, check **Open in New Tab**, save, and run query.
    7. Click the redirection link again.
    8. Verify the destination opens in a **new** browser tab.

### 5.2 Parameters Base64 Package Collection
- **Goal**: Verify row/column dimensions, static adhoc filters, dynamic dashboard filters, and cross-filters are gathered and encoded.
- **Steps**:
    1. Place the pivot table chart in a dashboard.
    2. Apply a dashboard filter (e.g. `load_date = '2026-06-23'` and `supplierSource = 'MANUAL'`).
    3. Ensure row dimensions (`groupbyRows` e.g., `vendor`) and column dimensions (`groupbyColumns` e.g., `category`) are configured.
    4. Click a redirection link on a pivot table cell.
    5. Inspect the redirection URL in the browser address bar.
    6. Verify the URL ends with a single encoded parameter: `?params=<base64_string>`.
    7. Copy the `<base64_string>` and decode it via a Base64 decoder tool (or Javascript `atob()`).
    8. Verify that the decoded JSON contains all the dimension and filter key-value pairs.

### 5.3 Top-Level Redirection Link Button
- **Goal**: Verify the top-level redirection button works and excludes dimension filters.
- **Steps**:
    1. Place the chart in a dashboard with active filters (e.g., `load_date = '2026-06-23'`).
    2. Configure at least one redirection link.
    3. Run the query.
    4. Click the **Redirect** button in the top-level toolbar (next to other action buttons).
    5. Verify a Popover appears with the list of configured redirection links.
    6. Click a link from the Popover list.
    7. Verify the destination URL loads successfully.
    8. Copy and Base64-decode the `params` parameter.
    9. Verify the decoded JSON includes dashboard/inherited filters (e.g., `load_date = '2026-06-23'`) but does NOT contain any row or column dimension fields.

## 6. Performance & URL Trimming Validation

### 6.1 Control Panel Responsiveness (Lag-Free)
- **Goal**: Verify adding or editing redirection links does not trigger query execution or interface freeze.
- **Steps**:
    1. Click **Configure Redirection URLs** under Redirection Settings.
    2. Click **Add Link**, fill in details, and click **OK** to close the modal.
- **Expected Result**:
    - The modal closes immediately and form fields are reset without visual stutter.
    - The chart in the Explore pane does not show a loading/refresh spinner (no database query is executed on save).

### 6.2 URL Whitespace Trimming
- **Goal**: Verify leading/trailing whitespaces in configured URLs are trimmed prior to execution.
- **Steps**:
    1. In **Backend Settings**, enter `BackendUrl` with spaces (e.g. `   https://api.example.com/save   `).
    2. Edit a table cell and click save.
    3. Inspect the outgoing POST request in the browser developer tools.
    4. Verify the destination URL is `https://api.example.com/save` without spaces.
    5. Add a chart-level action with `API Endpoint`: `   /api/v1/custom-action/   `.
    6. Execute the action and check the outgoing POST request.
    7. Verify the destination URL is `/api/v1/custom-action/` without spaces.
    8. Configure a redirection URL: `   https://example.com/target   `.
    9. Click the redirection link.
    10. Verify that the destination address bar opens `https://example.com/target` without leading/trailing spaces.

