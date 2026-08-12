import { useState, useEffect, useCallback } from 'react';
import {
  Form,
  Select,
  Input,
  Button,
  Alert,
  InputNumber,
  Checkbox,
  Upload,
  Row,
  Col,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  SupersetDataFormProps,
  FormState,
  DropdownOption,
  HierarchyFieldConfig,
} from '../types/hierarchy';
import { getCustomSortKey, naturalSort } from '../react-pivottable/utilities';

const { Option } = Select;
const EMPTY_OBJECT = {};

export default function SupersetDataForm({
  hierarchyConfig,
  formFields,
  onSubmit,
  onCancel,
  initialValues = EMPTY_OBJECT,
  datasourceId,
  rowData,
  data = [],
  excludeOptionFilter = false,
  additionalFields = [],
}: SupersetDataFormProps) {
  const [form] = Form.useForm();

  // Helper to find additional config
  const getAdditionalConfig = useCallback(
    (fieldName: string) =>
      additionalFields.find(f => {
        if (Array.isArray(f.name)) {
          return f.name.includes(fieldName);
        }
        return f.name === fieldName;
      }),
    [additionalFields],
  );

  // Helper to find config for a field
  const getFieldConfig = useCallback(
    (fieldName: string, groupOverride?: string) => {
      const additionalConfig = additionalFields.find(f => {
        if (Array.isArray(f.name)) {
          return f.name.includes(fieldName);
        }
        return f.name === fieldName;
      });

      const rawTargetGroup = groupOverride || additionalConfig?.hierarchyGroup;

      const autoDetectedGroup = (() => {
        if (rawTargetGroup && rawTargetGroup !== 'All') return rawTargetGroup;
        const candidate = hierarchyConfig.find(c => {
          const nameMatches = c.fieldName === fieldName || c.columnName === fieldName;
          if (!nameMatches || !c.parentField) return false;
          const parent = Array.isArray(c.parentField) ? c.parentField[0] : c.parentField;
          return Array.isArray(formFields) && formFields.includes(parent);
        });
        return candidate ? (candidate.hierarchyGroup || (candidate as any).hierarchy_group) : undefined;
      })();

      const targetGroup = autoDetectedGroup || rawTargetGroup;

      const matchesGroup = (c: any) => {
        if (!targetGroup || targetGroup === 'All') return true;
        const grp = c.hierarchyGroup || c.hierarchy_group || '';
        return grp.toLowerCase().trim() === targetGroup.toLowerCase().trim();
      };

      const matchingConfigs = hierarchyConfig.filter(c => {
        const nameMatches =
          c.fieldName === fieldName || c.columnName === fieldName;
        return nameMatches && matchesGroup(c);
      });

      let globalConfig = matchingConfigs.find(c => {
        if (c.parentField && Array.isArray(formFields)) {
          const parent = Array.isArray(c.parentField) ? c.parentField[0] : c.parentField;
          return formFields.includes(parent);
        }
        return false;
      });

      if (!globalConfig) {
        globalConfig = matchingConfigs[0];
      }

      if (additionalConfig?.type === 'hierarchy') {
        return {
          ...(globalConfig || {}),
          level: globalConfig?.level ?? 99,
          fieldName: fieldName,
          fieldLabel:
            additionalConfig.label ||
            globalConfig?.fieldLabel ||
            fieldName.charAt(0).toUpperCase() +
              fieldName.slice(1).replace(/_/g, ' '),
          columnName: globalConfig?.columnName || fieldName,
          parentField: globalConfig?.parentField || null,
          filterColumn: globalConfig?.filterColumn || fieldName,
          hierarchyGroup:
            globalConfig?.hierarchyGroup ||
            (globalConfig as any)?.hierarchy_group ||
            (targetGroup !== 'All' ? targetGroup : '') ||
            '',
          isMulti: !!additionalConfig.isMulti,
          sortMethod: additionalConfig.sortMethod || 'Default',
        } as HierarchyFieldConfig;
      }

      if (
        (additionalConfig?.type === 'dropdown' ||
          additionalConfig?.type === 'text') &&
        additionalConfig.mappedColumn
      ) {
        return {
          ...(globalConfig || {}),
          level: globalConfig?.level ?? 99,
          fieldName: fieldName,
          fieldLabel:
            additionalConfig.label ||
            globalConfig?.fieldLabel ||
            fieldName.charAt(0).toUpperCase() +
              fieldName.slice(1).replace(/_/g, ' '),
          columnName: additionalConfig.mappedColumn,
          parentField: globalConfig?.parentField || null,
          filterColumn: additionalConfig.mappedColumn,
          isMulti:
            additionalConfig.type === 'dropdown'
              ? !!(additionalConfig.isMulti || additionalConfig.multiple)
              : false,
          sortMethod: additionalConfig.sortMethod || 'Default',
        } as HierarchyFieldConfig;
      }

      if (globalConfig) return globalConfig;
      return undefined;
    },
    [hierarchyConfig, additionalFields],
  );

  // Check if a hierarchy field should render as Multi Select based on its config
  const getIsMulti = (fieldName: string) => {
    const additionalConfig = additionalFields.find(f => {
      if (Array.isArray(f.name)) {
        return f.name.includes(fieldName);
      }
      return f.name === fieldName;
    });

    if (additionalConfig && additionalConfig.type === 'hierarchy') {
      return !!additionalConfig.isMulti;
    }
    const config = hierarchyConfig.find(
      c => c.fieldName === fieldName || c.columnName === fieldName,
    );
    return !!config?.isMulti;
  };

  const getSanitizedInitialValues = () => {
    const values = { ...initialValues };

    // Populate custom fields from mapped columns if configured
    additionalFields.forEach(f => {
      if (
        (f.type === 'text' || f.type === 'dropdown') &&
        f.mappedColumn &&
        !Array.isArray(f.name)
      ) {
        const rowVal = initialValues[f.mappedColumn];
        if (rowVal !== undefined && rowVal !== null) {
          if (Array.isArray(rowVal)) {
            if (f.type === 'text') {
              values[f.name] = rowVal.join(', ');
            } else {
              values[f.name] = rowVal;
            }
          } else {
            values[f.name] = rowVal;
          }
        }
      }
    });

    hierarchyConfig.forEach(c => {
      if (
        c.fieldName !== c.columnName &&
        values[c.fieldName] === undefined &&
        values[c.columnName] !== undefined
      ) {
        values[c.fieldName] = values[c.columnName];
      }

      const isMulti = getIsMulti(c.fieldName);
      const val = values[c.fieldName];

      if (isMulti) {
        // Ensure array
        if (val !== undefined && val !== null && !Array.isArray(val)) {
          values[c.fieldName] = [val];
        }
      }
    });
    return values;
  };

  const [formState, setFormState] = useState<FormState>({
    values: getSanitizedInitialValues(),
    options: {},
    loading: {},
    errors: {},
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch options for a field
  const fetchFieldOptions = useCallback(
    async (fieldName: string, parentValues: Record<string, any>) => {
      const config = getFieldConfig(fieldName);
      if (!config) return;

      const useApi = excludeOptionFilter; // If true, use API (bypass filters). If false, use local data.

      setFormState(prev => ({
        ...prev,
        loading: { ...prev.loading, [fieldName]: true },
        errors: { ...prev.errors, [fieldName]: null },
      }));

      try {
        let uniqueValues: any[] = [];

        if (useApi) {
          // --- API FETCHING (Existing Logic) ---
          const filters = [];
          // Construct filters based on parent fields
          if (config.parentField) {
            const parent = Array.isArray(config.parentField)
              ? config.parentField[0]
              : config.parentField;

            if (parent) {
              const parentVal = parentValues[parent];
              if (
                parentVal !== undefined &&
                parentVal !== null &&
                (!Array.isArray(parentVal) || parentVal.length > 0)
              ) {
                const parentConfig = getFieldConfig(parent, config.hierarchyGroup);
                const filterCol = parentConfig?.columnName || parent;

                filters.push({
                  col: filterCol,
                  op: Array.isArray(parentVal) ? 'IN' : '==',
                  val: parentVal,
                });
              }
            }
          }

          const response = await SupersetClient.post({
            endpoint: '/api/v1/chart/data',
            jsonPayload: {
              datasource: { id: datasourceId, type: 'table' },
              queries: [
                {
                  groupby: [config.columnName],
                  filters: filters,
                  orderby: [[config.columnName, true]],
                  row_limit: 100000,
                },
              ],
              result_format: 'json',
            },
          });

          const result = response.json.result[0];
          const data = result.data;
          uniqueValues = data.map((row: any) => row[config.columnName]);
        } else {
          // --- LOCAL DATA FETCHING (New Logic) ---
          // Filter props.data based on parents
          let filteredRows = data || [];

          if (config.parentField) {
            const parent = Array.isArray(config.parentField)
              ? config.parentField[0]
              : config.parentField;

            if (parent) {
              const parentVal = parentValues[parent];
              if (
                parentVal !== undefined &&
                parentVal !== null &&
                (!Array.isArray(parentVal) || parentVal.length > 0)
              ) {
                const parentConfig = getFieldConfig(parent, config.hierarchyGroup);
                const filterCol = parentConfig?.columnName || parent;

                filteredRows = filteredRows.filter(row => {
                  const rowVal =
                    row[filterCol] !== undefined ? row[filterCol] : row[parent];
                  if (rowVal === undefined || rowVal === null) return false;
                  if (Array.isArray(parentVal)) {
                    return parentVal.some(
                      val =>
                        String(val).toLowerCase().trim() ===
                        String(rowVal).toLowerCase().trim(),
                    );
                  }
                  return (
                    String(rowVal).toLowerCase().trim() ===
                    String(parentVal).toLowerCase().trim()
                  );
                });
              }
            }
          }

          uniqueValues = Array.from(
            new Set(
              filteredRows
                .map(row =>
                  row[config.columnName] !== undefined
                    ? row[config.columnName]
                    : row[config.fieldName],
                )
                .filter(val => val !== undefined && val !== null && val !== ''),
            ),
          );
        }

        // Determine sort method
        const isTimeDimension = (name: string) =>
          /year|month|quarter|half|season|week|day/i.test(name);
        const sortMethod = config.sortMethod;
        const useChrono =
          sortMethod === 'Chronological' ||
          ((!sortMethod || sortMethod === 'Default') &&
            (isTimeDimension(config.fieldLabel) ||
              isTimeDimension(config.columnName)));

        const options: DropdownOption[] = Array.from(new Set(uniqueValues))
          .filter(val => val !== null && val !== undefined)
          .map((val: any) => ({
            value: val,
            label: String(val),
          }))
          .sort((a, b) => {
            if (sortMethod === 'Ascending') {
              return a.label.localeCompare(b.label);
            }
            if (sortMethod === 'Descending') {
              return b.label.localeCompare(a.label);
            }
            if (useChrono) {
              return naturalSort(
                getCustomSortKey(a.value, true),
                getCustomSortKey(b.value, true),
              );
            }
            return a.label.localeCompare(b.label);
          });

        setFormState(prev => ({
          ...prev,
          options: { ...prev.options, [fieldName]: options },
          loading: { ...prev.loading, [fieldName]: false },
        }));
      } catch (err: any) {
        console.error(`Error fetching options for ${fieldName}:`, err);
        setFormState(prev => ({
          ...prev,
          loading: { ...prev.loading, [fieldName]: false },
          errors: {
            ...prev.errors,
            [fieldName]: err.message || 'Failed to load options',
          },
        }));
      }
    },
    [datasourceId, getFieldConfig, data, excludeOptionFilter],
  );

  // Initial load for top-level fields
  // Initial load for top-level fields
  useEffect(() => {
    // Top level fields are those with no parent or null parent or empty array
    const topLevelFields = hierarchyConfig.filter(
      c =>
        !c.parentField ||
        (Array.isArray(c.parentField) && c.parentField.length === 0),
    );

    topLevelFields.forEach(field => {
      // Only fetch if it's in the formFields list or required by hierarchy
      fetchFieldOptions(field.fieldName, {});
    });

    // Fetch dynamic options for custom dropdowns mapped to a dataset column
    additionalFields.forEach(field => {
      if (
        field.type === 'dropdown' &&
        field.mappedColumn &&
        !Array.isArray(field.name)
      ) {
        fetchFieldOptions(field.name, {});
      }
    });

    // If we have initial values
    if (initialValues && Object.keys(initialValues).length > 0) {
      const sanitizedValues = getSanitizedInitialValues();

      // Iterate through levels
      const sortedConfig = [...hierarchyConfig].sort(
        (a, b) => a.level - b.level,
      );
      sortedConfig.forEach(field => {
        if (field.parentField) {
          const parents = Array.isArray(field.parentField)
            ? field.parentField
            : [field.parentField];
          // Check against sanitized values
          const allParentsPresent = parents.every(p => {
            const val = sanitizedValues[p];
            return Array.isArray(val) ? val.length > 0 : !!val;
          });
          if (allParentsPresent) {
            fetchFieldOptions(field.fieldName, sanitizedValues);
          }
        }
      });

      form.setFieldsValue(sanitizedValues);
      setFormState(prev => ({ ...prev, values: sanitizedValues }));
    }
  }, [
    hierarchyConfig,
    fetchFieldOptions,
    initialValues,
    form,
    rowData,
    additionalFields,
  ]);

  const handleFieldChange = (fieldName: string, value: any) => {
    const newValues = { ...formState.values, [fieldName]: value };

    // Clear children
    const config = getFieldConfig(fieldName);
    if (!config) {
      // Non-hierarchy field changed
      setFormState(prev => ({ ...prev, values: newValues }));
      return;
    }

    // Identify children
    const children = hierarchyConfig.filter(c => {
      const parentMatches = Array.isArray(c.parentField)
        ? c.parentField.includes(fieldName)
        : c.parentField === fieldName;
      if (!parentMatches) return false;

      if (config?.hierarchyGroup) {
        const childGroup = c.hierarchyGroup || (c as any).hierarchy_group;
        return childGroup === config.hierarchyGroup;
      }
      return true;
    });

    const valuesToClear: Record<string, any> = {};
    const optionsToClear: Record<string, any> = {};

    const recurseClear = (configs: HierarchyFieldConfig[]) => {
      configs.forEach(c => {
        valuesToClear[c.fieldName] = undefined;
        optionsToClear[c.fieldName] = [];

        // Find grandchildren
        const grandChildren = hierarchyConfig.filter(gc => {
          const parentMatches = Array.isArray(gc.parentField)
            ? gc.parentField.includes(c.fieldName)
            : gc.parentField === c.fieldName;
          if (!parentMatches) return false;

          if (c.hierarchyGroup) {
            const gcGroup = gc.hierarchyGroup || (gc as any).hierarchy_group;
            return gcGroup === c.hierarchyGroup;
          }
          return true;
        });
        if (grandChildren.length > 0) recurseClear(grandChildren);
      });
    };

    recurseClear(children);

    // Update form
    form.setFieldsValue(valuesToClear);

    const finalValues = { ...newValues, ...valuesToClear };

    setFormState(prev => ({
      ...prev,
      values: finalValues,
      options: { ...prev.options, ...optionsToClear },
    }));

    // Trigger fetch for immediate children
    children.forEach(child => {
      fetchFieldOptions(child.fieldName, finalValues);
    });
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, any> = {};
      formFields.forEach(field => {
        const val =
          values[field] !== undefined
            ? values[field]
            : rowData && rowData[field];
        if (val !== undefined) {
          let payloadKey = field;
          const config = getFieldConfig(field);
          if (config && config.columnName) {
            payloadKey = config.columnName;
          }
          payload[payloadKey] = val;
        }
      });

      await onSubmit(payload);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (fieldName: string) => {
    const config = getFieldConfig(fieldName);
    const additionalConfig = getAdditionalConfig(fieldName);

    const isHierarchy =
      !!config && (!additionalConfig || additionalConfig.type === 'hierarchy');
    const isMulti = getIsMulti(fieldName);

    let inputNode = <Input />;
    let valuePropName = 'value'; // Default for most inputs
    if (additionalConfig?.type === 'file') {
      valuePropName = 'data-file-value';
    }

    const isLoading = formState.loading[fieldName];
    const options = formState.options[fieldName] || [];
    const isDisabled = !!(
      isHierarchy &&
      config?.parentField &&
      (() => {
        const parents = Array.isArray(config.parentField)
          ? config.parentField
          : [config.parentField];

        const activeParentsInForm = parents.filter(
          p => formFields && formFields.includes(p),
        );

        if (activeParentsInForm.length === 0) {
          return false;
        }

        return !activeParentsInForm.every(p => {
          const val = formState.values[p];
          return Array.isArray(val)
            ? val.length > 0
            : val !== undefined && val !== null && val !== '';
        });
      })()
    );

    if (isHierarchy) {
      inputNode = (
        <Select
          showSearch
          mode={isMulti ? 'multiple' : undefined}
          allowClear
          loading={isLoading}
          disabled={isDisabled}
          optionFilterProp="children"
          onChange={val => handleFieldChange(fieldName, val)}
          placeholder={`Select ${config.fieldLabel}`}
        >
          {options.map(opt => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      );
    } else if (additionalConfig) {
      switch (additionalConfig.type) {
        case 'number':
          inputNode = <InputNumber style={{ width: '100%' }} />;
          break;
        case 'textarea':
          inputNode = <Input.TextArea rows={4} />;
          break;
        case 'checkbox':
          inputNode = <Checkbox />;
          valuePropName = 'checked';
          break;
        case 'date':
          // We might need to handle DatePicker imports or just use Input type="date"
          // AntD DatePicker is better but requires moment/dayjs handling.
          // Let's stick to Input type="date" for simplicity if possible, or Basic text input with placeholder for now to avoid dependency issues unless user requested.
          // User requested "select field type", implies proper UI.
          // Let's use simple Input for now to be safe, or Input with type date.
          inputNode = <Input type="date" />;
          break;
        case 'dropdown': {
          const selectOptions = additionalConfig.mappedColumn
            ? formState.options[fieldName] || []
            : (additionalConfig.options || []).map(opt => ({
                value: opt,
                label: opt,
              }));

          inputNode = (
            <Select
              showSearch
              mode={additionalConfig.multiple ? 'multiple' : undefined}
              allowClear
              loading={
                additionalConfig.mappedColumn
                  ? formState.loading[fieldName]
                  : undefined
              }
              placeholder="Select an option"
            >
              {selectOptions.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          );
          break;
        }
        case 'file': {
          const fileVal =
            form.getFieldValue(fieldName) || formState.values[fieldName];
          let fileList: any[] = [];
          if (fileVal) {
            if (Array.isArray(fileVal)) {
              fileList = fileVal.map((file, i) => ({
                uid: file.uid || String(i),
                name: file.name,
                status: 'done' as const,
                originFileObj: file,
              }));
            } else {
              fileList = [
                {
                  uid: fileVal.uid || '-1',
                  name: fileVal.name,
                  status: 'done' as const,
                  originFileObj: fileVal,
                },
              ];
            }
          }

          const isMultiple = !!additionalConfig?.multiple;

          inputNode = (
            <Upload
              fileList={fileList}
              multiple={isMultiple}
              beforeUpload={file => {
                let newFiles: any;
                if (isMultiple) {
                  const currentVal = form.getFieldValue(fieldName);
                  const currentFiles = Array.isArray(currentVal)
                    ? currentVal
                    : currentVal
                      ? [currentVal]
                      : [];
                  newFiles = [...currentFiles, file];
                } else {
                  newFiles = file;
                }

                form.setFieldsValue({ [fieldName]: newFiles });
                form.validateFields([fieldName]);
                handleFieldChange(fieldName, newFiles);
                return false; // stop auto-upload
              }}
              onRemove={fileToRemove => {
                let newFiles: any;
                const currentVal = form.getFieldValue(fieldName);
                if (isMultiple && Array.isArray(currentVal)) {
                  newFiles = currentVal.filter(f => {
                    if (f.uid && fileToRemove.uid) {
                      return f.uid !== fileToRemove.uid;
                    }
                    return (
                      f.name !== fileToRemove.name ||
                      f.size !== fileToRemove.size
                    );
                  });
                  if (newFiles.length === 0) {
                    newFiles = undefined;
                  }
                } else {
                  newFiles = undefined;
                }

                form.setFieldsValue({ [fieldName]: newFiles });
                form.validateFields([fieldName]);
                handleFieldChange(fieldName, newFiles);
              }}
            >
              <Button icon={<UploadOutlined />}>
                {isMultiple ? t('Select Files') : t('Select File')}
              </Button>
            </Upload>
          );
          break;
        }
        case 'text':
        default:
          inputNode = <Input />;
      }
    } else {
      // Fallback for legacy fields not in additionalFields list
      if (fieldName === 'forecast_value' || fieldName === 'growth_rate') {
        inputNode = <InputNumber style={{ width: '100%' }} />;
      } else if (fieldName === 'comments') {
        inputNode = <Input.TextArea rows={4} />;
      }
    }

    const label = isHierarchy
      ? config.fieldLabel
      : additionalConfig?.label ||
        fieldName.charAt(0).toUpperCase() +
          fieldName.slice(1).replace(/_/g, ' ');

    const isRequired =
      isHierarchy || (additionalConfig ? additionalConfig.required : true);

    const rules: any[] = [
      { required: isRequired, message: `Please input ${fieldName}` },
    ];
    if (additionalConfig?.type === 'file') {
      rules.push({
        validator: (_: any, value: any) => {
          if (value) {
            const files = Array.isArray(value) ? value : [value];
            for (const file of files) {
              if (file instanceof File && file.size / 1024 / 1024 > 2) {
                return Promise.reject(
                  new Error(t('Each file size must be less than 2MB')),
                );
              }
            }
          }
          return Promise.resolve();
        },
      });
    }

    return (
      <Form.Item
        key={fieldName}
        name={fieldName}
        label={label}
        valuePropName={valuePropName}
        rules={rules}
      >
        {inputNode}
      </Form.Item>
    );
  };

  const renderFormFields = () => {
    const renderFieldGrid = (fields: string[]) => {
      const rows: Array<Array<{ fieldName: string; span: number }>> = [];
      let currentRow: Array<{ fieldName: string; span: number }> = [];

      fields.forEach(fieldName => {
        const additionalConfig = getAdditionalConfig(fieldName);
        const isFullWidth =
          additionalConfig?.type === 'textarea' ||
          additionalConfig?.type === 'file' ||
          fieldName === 'comments';

        const span = isFullWidth ? 24 : 12;

        if (span === 24) {
          if (currentRow.length > 0) {
            rows.push(currentRow);
            currentRow = [];
          }
          rows.push([{ fieldName, span: 24 }]);
        } else {
          currentRow.push({ fieldName, span: 12 });
          if (currentRow.length === 2) {
            rows.push(currentRow);
            currentRow = [];
          }
        }
      });

      if (currentRow.length > 0) {
        rows.push(currentRow);
      }

      return rows.map((rowItems, rowIndex) => (
        <Row key={`form-row-${rowIndex}`} gutter={16}>
          {rowItems.map(item => (
            <Col key={item.fieldName} span={item.span}>
              {renderField(item.fieldName)}
            </Col>
          ))}
        </Row>
      ));
    };

    const groupMap: Record<string, string[]> = {};
    const groupOrder: string[] = [];
    const ungroupedFields: string[] = [];

    formFields.forEach(fieldName => {
      const config = getFieldConfig(fieldName);
      const additionalConfig = getAdditionalConfig(fieldName);
      const isHierarchy =
        !!config || additionalConfig?.type === 'hierarchy';

      if (isHierarchy) {
        const rawGroup =
          config?.hierarchyGroup ||
          (config as any)?.hierarchy_group ||
          additionalConfig?.hierarchyGroup ||
          '';
        const groupName = rawGroup.trim() || 'Hierarchy';

        if (!groupMap[groupName]) {
          groupMap[groupName] = [];
          groupOrder.push(groupName);
        }
        groupMap[groupName].push(fieldName);
      } else {
        ungroupedFields.push(fieldName);
      }
    });

    const renderFullWidthFields = (fields: string[]) =>
      fields.map(fieldName => (
        <Row key={`fullwidth-row-${fieldName}`} gutter={16}>
          <Col span={24}>{renderField(fieldName)}</Col>
        </Row>
      ));

    return (
      <>
        {groupOrder.map(groupName => (
          <div
            key={groupName}
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              padding: '16px 16px 0px 16px',
              marginBottom: '16px',
              background: '#fafafa',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                fontSize: '13px',
                color: '#000000',
                marginBottom: '12px',
                paddingBottom: '6px',
                borderBottom: '1px solid #e8e8e8',
              }}
            >
              {groupName}
            </div>
            {renderFieldGrid(groupMap[groupName])}
          </div>
        ))}

        {ungroupedFields.length > 0 && renderFullWidthFields(ungroupedFields)}
      </>
    );
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={INITIAL_VALUES_PLACEHOLDER}
    >
      {submitError && (
        <Alert
          message={submitError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {renderFormFields()}

      <Form.Item>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel}>{t('Close')}</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t('Submit')}
          </Button>
        </div>
      </Form.Item>
    </Form>
  );
}

// Small workaround for weird TS issue with initial values being partial
const INITIAL_VALUES_PLACEHOLDER: any = {};
