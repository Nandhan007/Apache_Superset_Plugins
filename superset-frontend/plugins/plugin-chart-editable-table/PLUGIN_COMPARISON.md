# Custom Plugin Feature Comparison & Documentation

This document maintains feature capabilities across custom Superset table visualization plugins (`plugin-chart-editable-table` and `plugin-chart-hierarchical-pivot-table`).

## Feature Matrix

| Feature | `plugin-chart-editable-table` | `plugin-chart-hierarchical-pivot-table` |
| :--- | :--- | :--- |
| **Cell Editing** | Supported for configured `editableMetrics` | Supported for configured `editableMetrics` |
| **Percentage Metrics Scaling** | **Supported**: When metrics are formatted as percentages (e.g., `,.0%`, `.1%`, or `percent_metrics`), values are multiplied by 100 in the cell editor input (displaying whole numbers like `5` instead of `0.05`). Saved values are divided by 100 back to original scale (`0.05`). | **Supported**: When metrics are formatted as percentages (e.g., `,.0%`, `.1%`, or `percent_metrics`), values are multiplied by 100 in the cell editor input (displaying whole numbers like `5` instead of `0.05`). Saved values are divided by 100 back to original scale (`0.05`). |
| **Cell Tooltip & Direct Copy** | **Supported**: Displays raw value directly in tooltip positioned closely above the cell value. Clicking the tooltip value directly copies it to clipboard without a separate button. | **Supported**: Displays raw value directly in tooltip positioned closely above the cell value. Clicking the tooltip value directly copies it to clipboard without a separate button. |
| **Backend Sync** | Sends modified cell payload to configured API endpoint | Sends modified cell payload to configured API endpoint |
| **Dark Mode Indicator** | Modified & editable metric highlights | Modified & editable metric highlights |

## Percentage Metrics Editing Behavior Details

1. **Detection**: Metrics are treated as percentage metrics if:
   - Metric is in `percent_metrics`.
   - `d3NumberFormat` or column format string contains `%` (e.g., `,.0%`, `.1%`).
2. **Editing View**:
   - In display view (non-editing mode), the metric displays using D3 number formatting (e.g. `5%`).
   - In edit mode (input field), the metric displays scaled as a whole number (`5`).
3. **Saving View**:
   - Upon completing edit, the user-entered value (e.g. `10`) is converted back to original scale (`10 / 100 = 0.1`) before being stored in the edit manager and sent to the backend.

## Cell Tooltip & Direct UI Copy Details

1. **Tooltip Display**:
   - Displays raw value directly on hover without metric name/title headers.
   - Positioned closely above the cell value text.
2. **Direct Copy**:
   - **Click to Copy**: Clicking directly on the tooltip text copies the raw value to clipboard and shows a confirmation toast notification.
   - **Text Highlight**: Tooltip text supports native mouse text selection (`user-select: text`) for manual Ctrl+C / Cmd+C copying.
