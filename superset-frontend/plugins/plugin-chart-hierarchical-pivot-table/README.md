# Hierarchical Pivot Table Plugin

This is a powerful Superset visualization plugin that combines a hierarchical pivot table with advanced workflow capabilities, including **write-back**, **row-level actions**, **custom layouts**, and **interactive forms**.

---

## 🚀 Key Features

- **Hierarchical Data**: Expandable/collapsible rows with parent-child relationships.
- **Interactive Actions**:
    - **Chart-Level Buttons**: Trigger global workflows (e.g., "Seed Data", "Export").
    - **Row-Level Buttons**: Context-aware actions for specific rows (e.g., "Approve", "Reject").
- **Dynamic Forms**: Auto-generated forms for actions with support for:
    - **Typed Fields**: Text, Number, Date, Checkbox, TextArea, Dropdown (with custom options).
    - **Validation**: Required fields.
    - **Dynamic Dropdowns**: Dependent dropdowns based on hierarchy configuration.
- **Image Export Support**: Fully compatible with Superset's "Download as image" feature with collision-free toolbars.
- **Editable Metrics**: Edit cell values directly (requires backend API support).
- **Layout Editor**: Drag-and-drop interface to rearrange Rows and Columns instantly.
- **Custom Sorting**: Sort time dimensions (Months, Days, Seasons) chronologically or define custom sort orders.
- **Icon Support**: Customize action buttons with thousands of Ant Design icons.
- **Advanced Filtering**: Filter data per column directly within the table headers.

---

## ⚙️ Configuration Guide

### 1. Hierarchy Configuration
Define the structure of your data dependencies. This powers the "drill-down" effect in action forms.

1. Go to **Hierarchical Forms Configuration** > **Hierarchy Fields**.
2. **Dual-Modes**: You can configure your hierarchy fields using the user-friendly **Manual UI** or toggle the top right switch to use the **JSON Editor** for advanced configurations, bulk imports, and code sharing.
3. Configure the following properties for each level (1 = top level):
    - **Field Name**: Unique Internal ID (e.g., `region_id`).
    - **Display Label**: User-facing label in the Form UI (e.g., "Region").
    - **Database Column**: Source column for identifying data rows.
    - **Parent Field**: The field this depends on (e.g., `country` depends on `region`). Option is restricted strictly to previously defined parent hierarchy rows.

### 3. Metric Configuration
Enable inline editing for specific metrics.

1. Go to **Customize** tab.
2. Under **Editable Metrics**, select the metrics that should be editable.
3. **Backend API URL**: Specify the endpoint where edits should be saved.

---

## 🛠 Action Buttons

**Note on Auto-Refresh:** Action Buttons automatically bust the Chart Data cache (`force: true`) upon successful endpoint delivery, forcing the table to seamlessly update with your new database state without manual refreshes!

### Chart-Level Actions
Global buttons rendered in the top-right toolbar.


- **Label**: Button text.
- **Icon**: Search and select an Ant Design icon (e.g., `CloudUploadOutlined`).
- **API Endpoint**: REST endpoint to call on submit.
- **Include Hierarchy Fields**: If enabled, the form will auto-include dropdowns for your hierarchy. 
- **Additional Form Fields**: Define custom inputs:
    - **Name/Label**: Field identifier.
    - **Type**: `Text`, `Number`, `Date`, `Checkbox`, `TextArea`, `Dropdown`.
    - **Options**: Comma-separated list for `Dropdown` choices.
    - **Required**: Enforce validation.

### Row-Level Actions
Context-aware buttons rendered within each row.

- **Render Mode**: Always renders seamlessly as a checkbox embedded directly in the first column (Action Column).
- **Intelligent Row Grouping**: When Row-Level Actions are activated, the table automatically groups parent dimensions visually ensuring checkboxes align intelligently.

- **API Endpoint**: Endpoint to receive the row context + form data.
- **Prefill from Row**: If enabled, the action form will pre-fill hierarchy fields based on the row's current data (e.g., clicking "Approve" on "North Region" pre-fills Region="North").
- **Multi-Select Payload**: You can select multiple row checkboxes. The form will dynamically bundle the rows into an array for submission. If the selected rows have *different* values for the same dependency level, they are rendered as a `Multi-Select` dropdown.
- **Additional Fields**: Add comments, approval flags, dates, etc.

---

## 🎨 Interactive Layout Editor

Stop going back to the control panel to change rows and columns!

1. Click the **Layout** button in the chart toolbar.
2. A modal opens with three panes:
    - **Available Columns**: Unused dimensions.
    - **Rows**: Dimensions currently on rows.
    - **Columns**: Dimensions currently on columns.
3. **Drag and Drop** items between lists to rearrange the pivot table instantly.

---

## 🔍 Filtering

Click the **Filter Icon** in any column header to filter the pivot table by specific values. This is client-side filtering that preserves the hierarchical context.

---

## 📝 Usage Example: Sales Approval Workflow

1. **Setup**:
    - Rows: `Region` > `Store`.
    - Metric: `Sales Target`.
2. **Action**: Create a "ROW LEVEL" action called "Approve".
    - Icon: `CheckOutlined`.
    - Additional Field: `Comment` (TextArea).
3. **Workflow**:
    - Manager views the table.
    - Sees "Store A" target is set to 50,000.
    - Clicks the **Approve** button on the "Store A" row.
    - Form opens: Region="North", Store="Store A" (Pre-filled).
    - Manager adds comment: "Looks ambitious, approved."
    - Submits -> API receives the approval.
