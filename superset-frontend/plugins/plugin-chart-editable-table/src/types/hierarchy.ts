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
  buttonLabel?: string;
  buttonIcon: string;
  modalTitle: string;
  formFields: string[];
  additionalFields?: AdditionalFieldConfig[];
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
  hierarchyFields?: string[];
  additionalFields?: AdditionalFieldConfig[];
  formFields?: string[];
  uniqueField?: string;
  payloadMapping?: string;
}
export interface HTMLViewerActionConfig {
  buttonLabel?: string;
  buttonIcon: string;
  modalTitle: string;
  handlebarsTemplate: string;
  styleTemplate?: string;
  onlySelectedRow?: boolean;
  isGlobalCustomView?: boolean;
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
  rowData?: Record<string, any>;
  data?: Record<string, any>[];
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
