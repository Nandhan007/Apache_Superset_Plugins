# Custom Plugin Feature Comparison & Documentation

This document maintains feature capabilities across custom Superset table visualization plugins (`plugin-chart-editable-table` and `plugin-chart-hierarchical-pivot-table`).

## Feature Matrix

| Feature | `plugin-chart-editable-table` | `plugin-chart-hierarchical-pivot-table` |
| :--- | :--- | :--- |
| **Cell Editing** | Supported for configured `editableMetrics` | Supported for configured `editableMetrics` |
| **Percentage Metrics Scaling** | **Supported**: When metrics are formatted as percentages (e.g., `,.0%`, `.1%`, or `percent_metrics`), values are multiplied by 100 in the cell editor input (displaying integers like `5` instead of `0.05`, or exact decimals like `5.25` instead of `0.0525`). Integers are never cast to double (no `.00`). Saved values are divided by 100 back to original scale (`0.05`, `0.0525`). | **Supported**: When metrics are formatted as percentages (e.g., `,.0%`, `.1%`, or `percent_metrics`), values are multiplied by 100 in the cell editor input (displaying integers like `5` instead of `0.05`, or exact decimals like `5.25` instead of `0.0525`). Integers are never cast to double (no `.00`). Saved values are divided by 100 back to original scale (`0.05`, `0.0525`). |
| **Cell Tooltip & Direct Copy** | **Supported**: Displays raw value directly in tooltip positioned closely above the cell value. Clicking the tooltip value directly copies it to clipboard without a separate button. | **Supported**: Displays raw value directly in tooltip positioned closely above the cell value. Clicking the tooltip value directly copies it to clipboard without a separate button. |
| **Backend Sync** | Sends modified cell payload to configured API endpoint | Sends modified cell payload to configured API endpoint |
| **Dark Mode Indicator** | Modified & editable metric highlights | Modified & editable metric highlights |

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
2. **Direct Copy**:
   - **Click to Copy**: Clicking directly on the tooltip text copies the raw value to clipboard and shows a confirmation toast notification.
   - **Text Highlight**: Tooltip text supports native mouse text selection (`user-select: text`) for manual Ctrl+C / Cmd+C copying.
