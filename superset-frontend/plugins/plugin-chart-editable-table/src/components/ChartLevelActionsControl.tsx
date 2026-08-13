import { useState } from 'react';
import { Button, List, Modal, Form, Input, Select, Row, Col, notification } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import * as AntdIcons from '@ant-design/icons';
import AceEditor from 'react-ace';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-github';

import { DatasourceColumn } from '../types';
import {
  ChartLevelActionConfig,
  AdditionalFieldConfig,
} from '../types/hierarchy';
import AdditionalFieldsList from './AdditionalFieldsList';
import ApiEndpointSelectControl from './ApiEndpointSelectControl';

interface ChartLevelActionsControlProps {
  value?: ChartLevelActionConfig[];
  onChange: (value: ChartLevelActionConfig[]) => void;
  datasourceColumns?: DatasourceColumn[];
  allColumns?: DatasourceColumn[];
  hierarchyFields?: any[];
}

export default function ChartLevelActionsControl({
  value = [],
  onChange,
  datasourceColumns = [],
  allColumns = [],
  hierarchyFields = [],
}: ChartLevelActionsControlProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm();

  const iconOptions = Object.keys(AntdIcons)
    .filter(k => k.endsWith('Outlined'))
    .map(k => {
      const Icon = (AntdIcons as any)[k];
      return {
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icon && <Icon />}
            <span>{k}</span>
          </div>
        ),
        value: k,
      };
    });

  const handleAdd = () => {
    setEditingIndex(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleDelete = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const handleOk = () => {
    form.validateFields().then(values => {
      const trimmedLabel = String(values.buttonLabel || '').trim();

      if (trimmedLabel.length > 12) {
        form.setFields([
          {
            name: 'buttonLabel',
            errors: [t('Action name must be 12 characters or less')],
          },
        ]);
        notification.error({
          message: t('Action Name Too Long'),
          description: t('Action button name must be 12 characters or less.'),
        });
        return;
      }

      const isDuplicateLabel = value.some(
        (item: any, idx: number) =>
          idx !== editingIndex &&
          String(item.buttonLabel || '').toLowerCase().trim() ===
            trimmedLabel.toLowerCase(),
      );

      if (isDuplicateLabel) {
        form.setFields([
          {
            name: 'buttonLabel',
            errors: [t('An action button with this label already exists')],
          },
        ]);
        notification.error({
          message: t('Duplicate Action Name'),
          description: t(
            `Action button name "${trimmedLabel}" already exists. Action names must be unique.`,
          ),
        });
        return;
      }

      const config: ChartLevelActionConfig = {
        ...values,
      };

      if (Array.isArray(config.additionalFields)) {
        const seenKeys = new Set<string>();
        for (const f of config.additionalFields) {
          if (!f) continue;

          const isMissingName = Array.isArray(f.name)
            ? f.name.length === 0 || f.name.some((n: any) => !n || !String(n).trim())
            : !f.name || !String(f.name).trim();

          if (isMissingName) {
            notification.error({
              message: t('Field Name Required'),
              description: t(
                'Field name is required for all form fields in the action configuration.',
              ),
            });
            return;
          }

          const names = Array.isArray(f.name)
            ? f.name
            : f.name
            ? [f.name]
            : [];
          const mappedCols = f.mappedColumn ? [f.mappedColumn] : [];

          for (const name of names) {
            const lower = String(name).toLowerCase().trim();
            if (lower && seenKeys.has(lower)) {
              notification.error({
                message: t('Duplicate Field Name'),
                description: t(
                  `Field name or mapped column "${name}" is already used in form configuration.`,
                ),
              });
              return;
            }
            if (lower) seenKeys.add(lower);
          }

          if (f.type !== 'hierarchy') {
            for (const col of mappedCols) {
              const lower = String(col).toLowerCase().trim();
              if (lower && seenKeys.has(lower)) {
                notification.error({
                  message: t('Duplicate Field Name'),
                  description: t(
                    `Mapped column "${col}" is already used by another field in form configuration.`,
                  ),
                });
                return;
              }
              if (lower) seenKeys.add(lower);
            }
          }
        }
      }

      if (Array.isArray(config.additionalFields) && Array.isArray(hierarchyFields)) {
        const allFormNames = config.additionalFields.flatMap((f: any) =>
          Array.isArray(f.name) ? f.name : [f.name],
        );
        config.additionalFields = config.additionalFields.map((f: any) => {
          if (f.type === 'hierarchy' && (!f.hierarchyGroup || f.hierarchyGroup === 'All')) {
            const fieldNames = Array.isArray(f.name) ? f.name : [f.name];
            const candidate = hierarchyFields.find((hf: any) => {
              const nameMatches = fieldNames.includes(hf.fieldName) || fieldNames.includes(hf.columnName);
              if (!nameMatches) return false;
              const grp = hf.hierarchyGroup || (hf as any).hierarchy_group;
              return hierarchyFields.some((other: any) => {
                const otherGrp = other.hierarchyGroup || (other as any).hierarchy_group;
                const otherName = other.fieldName || other.columnName;
                return (
                  otherGrp === grp &&
                  !fieldNames.includes(otherName) &&
                  allFormNames.includes(otherName)
                );
              });
            });
            const fallbackCandidate = candidate || hierarchyFields.find((hf: any) =>
              fieldNames.includes(hf.fieldName) || fieldNames.includes(hf.columnName),
            );
            if (fallbackCandidate) {
              const grp = fallbackCandidate.hierarchyGroup || (fallbackCandidate as any).hierarchy_group;
              if (grp) {
                return { ...f, hierarchyGroup: grp };
              }
            }
          }
          return f;
        });
      }

      const newValue = [...value];
      if (editingIndex !== null) {
        newValue[editingIndex] = config;
      } else {
        newValue.push(config);
      }
      onChange(newValue);
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  const getInitialValues = (index: number) => {
    const item = value[index];
    const initial = { ...item };

    if (
      !initial.additionalFields &&
      initial.formFields &&
      initial.formFields.length > 0
    ) {
      // Migrate on the fly for editing
      initial.additionalFields = initial.formFields.map(
        f =>
          ({
            name: f,
            type: 'text',
            required: false,
          }) as AdditionalFieldConfig,
      );
    }
    return initial;
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    form.setFieldsValue(getInitialValues(index));
    setIsModalVisible(true);
  };

  return (
    <div>
      <List
        size="small"
        bordered
        dataSource={value}
        renderItem={(item, index) => {
          const IconComponent = item.buttonIcon
            ? (AntdIcons as any)[item.buttonIcon]
            : null;
          return (
            <List.Item
              actions={[
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(index)}
                />,
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(index)}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {IconComponent && <IconComponent />}
                    <span>
                      {item.buttonLabel ||
                        `Action (${item.buttonIcon || 'unnamed'})`}
                    </span>
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
      <Button
        type="dashed"
        onClick={handleAdd}
        style={{ width: '100%', marginTop: 8 }}
        icon={<PlusOutlined />}
      >
        {t('Add Action Button')}
      </Button>

      <Modal
        title={editingIndex !== null ? t('Edit Action') : t('Add Action')}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="buttonLabel"
                label={t('Button Label')}
                rules={[
                  { max: 10, message: t('Action name must be 10 characters or less') },
                ]}
              >
                <Input placeholder="e.g. Seed Data" maxLength={10} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="buttonIcon"
                label={t('Icon Name')}
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  placeholder="Select an icon"
                  options={iconOptions}
                  filterOption={(input, option) =>
                    (option?.value as string)
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="modalTitle"
                label={t('Modal Title')}
                rules={[{ required: true }]}
              >
                <Input placeholder="e.g. Create New Entry" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="apiEndpoint"
                label={t('API Endpoint')}
                rules={[{ required: true }]}
              >
                <ApiEndpointSelectControl />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="additionalFields" label={t('Form Fields')}>
            <AdditionalFieldsList
              datasourceColumns={datasourceColumns}
              allColumns={allColumns}
              hierarchyFields={hierarchyFields}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="payloadMapping"
                label={t('Payload Mapping (JSON)')}
                rules={[
                  {
                    validator: (_, val) => {
                      if (!val) return Promise.resolve();
                      try {
                        JSON.parse(val);
                        return Promise.resolve();
                      } catch (e) {
                        return Promise.reject(
                          new Error(t('Must be valid JSON')),
                        );
                      }
                    },
                  },
                ]}
              >
                <AceEditor
                  mode="json"
                  theme="github"
                  name="chart-action-payload-mapping-editor"
                  width="100%"
                  height="128px"
                  style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
                  fontSize={14}
                  showPrintMargin={false}
                  editorProps={{ $blockScrolling: true }}
                  wrapEnabled
                  highlightActiveLine
                  tabSize={2}
                  setOptions={{
                    showLineNumbers: true,
                    showGutter: true,
                    useWorker: false,
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('Input Payload Structure Preview')}>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    background: '#fafafa',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #d9d9d9',
                    height: '128px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                  }}
                >
                  <Form.Item noStyle dependencies={['payloadMapping', 'additionalFields']}>
                    {({ getFieldValue }) => {
                      const payloadMappingStr = getFieldValue('payloadMapping');
                      const additionalFields = getFieldValue('additionalFields');

                      let previewContent = '';
                      let isValidJson = true;

                      if (payloadMappingStr && payloadMappingStr.trim()) {
                        try {
                          const parsed = JSON.parse(payloadMappingStr.trim());
                          previewContent = JSON.stringify(parsed, null, 2);
                        } catch (_e) {
                          isValidJson = false;
                          previewContent = payloadMappingStr;
                        }
                      } else {
                        const previewObj: Record<string, any> = {};

                        if (Array.isArray(additionalFields)) {
                          additionalFields.forEach(field => {
                            if (!field) return;

                            const mappedKey =
                              field.mappedColumn ||
                              field.columnName ||
                              field.column;

                            if (field.type === 'hierarchy') {
                              const isMulti =
                                field.multiple ||
                                Array.isArray(field.name) ||
                                field.isMulti;

                              if (Array.isArray(field.name)) {
                                field.name.forEach((fName: string) => {
                                  if (!fName) return;
                                  const key = mappedKey || fName;
                                  previewObj[key] = isMulti
                                    ? [`sample_${fName}_value`]
                                    : `sample_${fName}_value`;
                                });
                              } else if (field.name) {
                                const key = mappedKey || field.name;
                                previewObj[key] = isMulti
                                  ? [`sample_${field.name}_value`]
                                  : `sample_${field.name}_value`;
                              }
                              return;
                            }

                            const fName = field.name;
                            if (!fName && !mappedKey) return;
                            const key = mappedKey || fName;

                            switch (field.type) {
                              case 'number':
                                previewObj[key] = 100;
                                break;
                              case 'select':
                              case 'dropdown':
                                if (
                                  Array.isArray(field.options) &&
                                  field.options.length > 0
                                ) {
                                  previewObj[key] = field.options[0];
                                } else {
                                  previewObj[key] = 'sample_option';
                                }
                                break;
                              case 'date':
                                previewObj[key] = '2026-01-01';
                                break;
                              case 'checkbox':
                                previewObj[key] = true;
                                break;
                              case 'textarea':
                                previewObj[key] = 'sample_text_content';
                                break;
                              case 'file':
                                previewObj[key] = field.multiple
                                  ? ['base64_file_content']
                                  : 'base64_file_content';
                                break;
                              default:
                                previewObj[key] = `sample_${fName || mappedKey}_value`;
                                break;
                            }
                          });
                        }

                        previewContent =
                          Object.keys(previewObj).length > 0
                            ? JSON.stringify(previewObj, null, 2)
                            : '{\n  // Add form fields above to generate payload\n}';
                      }

                      return (
                        <pre
                          style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            flex: 1,
                            color: isValidJson ? '#333' : '#d9534f',
                          }}
                        >
                          {previewContent}
                        </pre>
                      );
                    }}
                  </Form.Item>
                </div>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
