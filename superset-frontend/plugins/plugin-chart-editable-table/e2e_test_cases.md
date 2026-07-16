# Editable Table - End-to-End Test Cases

This document outlines the test cases for verifying the functionality of the Editable Table plugin, focusing on the newly added redirection configurations, parameters packaging, performance responsiveness, and whitespace trimming.

## 1. Redirection Settings & Parameters

### 1.1 Same-Tab Target Default & Open in New Tab
- **Goal**: Verify redirection links respect tab settings and default to same-tab navigation.
- **Steps**:
    1. Open the control panel, locate **Redirection Settings**, and click **Configure Redirection URLs**.
    2. Click **Add Link**, enter name `Details` and URL `https://example.com/details`. Keep **Open in New Tab** unchecked.
    3. Save and click **OK**. Run the query.
    4. Click a redirection link from a table cell context menu or link column.
    5. Verify the destination opens in the **same** browser tab.
    6. Re-open the configuration, check **Open in New Tab**, save, and run query.
    7. Click the redirection link again.
    8. Verify the destination opens in a **new** browser tab.

### 1.2 Parameters Base64 Package Collection
- **Goal**: Verify row dimensions (only groupby columns), static adhoc filters, dynamic dashboard filters, and cross-filters are gathered and encoded.
- **Steps**:
    1. Place the editable table chart in a dashboard.
    2. Apply a dashboard filter (e.g. `load_date = '2026-06-23'` and `supplierSource = 'MANUAL'`).
    3. Ensure table columns configured include groupby columns (dimensions) and metrics.
    4. Click a redirection link on a table cell.
    5. Inspect the redirection URL in the browser address bar.
    6. Verify the URL ends with a single encoded parameter: `?params=<base64_string>`.
    7. Copy the `<base64_string>` and decode it via a Base64 decoder tool (or Javascript `atob()`).
    8. Verify that the decoded JSON contains:
        - Dimension values from the row.
        - Chart-level adhoc filters.
        - Inherited dashboard filters.
        - Exclusion of metric columns (non-dimensions) from the params payload.

### 1.3 Top-Level Redirection Link Button
- **Goal**: Verify the top-level redirection button works and excludes dimension filters.
- **Steps**:
    1. Place the chart in a dashboard with active filters (e.g., `load_date = '2026-06-23'`).
    2. Configure at least one redirection link.
    3. Run the query.
    4. Click the **Redirect** button in the top-level action header bar (next to other action buttons).
    5. Verify a Popover appears with the list of configured redirection links.
    6. Click a link from the Popover list.
    7. Verify the destination URL loads successfully.
    8. Copy and Base64-decode the `params` parameter.
    9. Verify the decoded JSON includes dashboard/inherited filters (e.g., `load_date = '2026-06-23'`) but does NOT contain any row dimension fields.

## 2. Performance & URL Trimming Validation

### 2.1 Control Panel Responsiveness (Lag-Free)
- **Goal**: Verify adding or editing redirection links does not trigger query execution or interface freeze.
- **Steps**:
    1. Click **Configure Redirection URLs** under Redirection Settings.
    2. Click **Add Link**, fill in details, and click **OK** to close the modal.
- **Expected Result**:
    - The modal closes immediately and form fields are reset without visual stutter.
    - The chart in the Explore pane does not show a loading/refresh spinner (no database query is executed on save).

### 2.2 URL Whitespace Trimming
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
