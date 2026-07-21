export interface HierarchyFieldConfig {
  level: number;
  fieldName: string;
  fieldLabel: string;
  columnName: string;
  parentField: string | string[] | null;
  filterColumn: string;
  hierarchyGroup: string;
  excludeFilter?: boolean;
  isMulti?: boolean;
  sortMethod?: 'Default' | 'Chronological';
}

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'textarea'
  | 'dropdown'
  | 'file'
  | 'hierarchy';

export interface AdditionalFieldConfig {
  name: string | string[];
  label?: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  multiple?: boolean;
  mappedColumn?: string;
}

export interface ChartLevelActionConfig {
  buttonLabel: string;
  buttonIcon: string;
  modalTitle: string;
  formFields: string[]; // Deprecated? Or keep for backward compat? Let's use flexible type or new prop.
  // Ideally we replace formFields (string[]) with additionalFields (AdditionalFieldConfig[])?
  // But hierarchy fields are strings.
  // Let's keep formFields for *Hierarchy* fields (if applicable) and add additionalFields for *New* fields.
  // Wait, the requirement says "Add additional form fields... with deep config".
  // Currently formFields is mixed.
  // Best approach:
  // - hierarchyFields: string[] (Select from existing hierarchy)
  // - additionalFields: AdditionalFieldConfig[] (Typed custom fields)
  // - `formFields` (legacy string[] support)

  // Let's go with:
  additionalFields?: AdditionalFieldConfig[];

  // Existing props
  apiEndpoint: string;
  hierarchyFields?: string[];
  payloadMapping?: string;
}

export interface RowLevelActionConfig {
  buttonLabel?: string;
  buttonIcon: string;
  modalTitle: string;
  apiEndpoint: string;
  visibilityCondition?: string;
  prefillFromRow?: boolean;
  renderMode?: 'inline' | 'toolbar';

  // Hierarchy fields (strings) - matches ChartLevelActionConfig
  hierarchyFields?: string[];

  // Custom/Additional fields with type
  additionalFields?: AdditionalFieldConfig[];

  // Legacy
  formFields?: string[];
  payloadMapping?: string;
}

export interface HTMLViewerActionConfig {
  buttonLabel?: string;
  buttonIcon: string;
  modalTitle: string;
  handlebarsTemplate: string;
  styleTemplate?: string;
  onlySelectedRow?: boolean;
  uniqueField?: string;
}

export interface SupersetDataFormProps {
  hierarchyConfig: HierarchyFieldConfig[];
  formFields: string[];
  onSubmit: (formData: Record<string, any>) => void;
  onCancel?: () => void;
  initialValues?: Record<string, any>;
  datasourceId: number;
  chartId?: number;
  rowData?: Record<string, any>; // For row-level actions
  data?: Record<string, any>[]; // Current chart data for local option fetching
  excludeOptionFilter?: boolean;
  additionalFields?: AdditionalFieldConfig[];
}

export interface DropdownOption {
  value: string | number;
  label: string;
}

export interface FormState {
  values: Record<string, any>;
  options: Record<string, DropdownOption[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
}
