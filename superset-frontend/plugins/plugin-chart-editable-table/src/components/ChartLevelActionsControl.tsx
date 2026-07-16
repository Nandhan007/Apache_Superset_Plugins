import { useState } from 'react';
import { Button, List, Modal, Form, Input, Select, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import * as AntdIcons from '@ant-design/icons';
import AceEditor from 'react-ace';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-github';

import { DatasourceColumn } from '../types';
import { ChartLevelActionConfig, AdditionalFieldConfig } from '../types/hierarchy';
import AdditionalFieldsList from "./AdditionalFieldsList";

interface ChartLevelActionsControlProps {
  value?: ChartLevelActionConfig[];
  onChange: (value: ChartLevelActionConfig[]) => void;
  datasourceColumns?: DatasourceColumn[];
  allColumns?: DatasourceColumn[];
  hierarchyFields?: any[];
}

export default function ChartLevelActionsControl({ value = [], onChange, datasourceColumns = [], allColumns = [], hierarchyFields = [] }: ChartLevelActionsControlProps) {
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
           value: k
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
      
      const config: ChartLevelActionConfig = {
          ...values,
      };
      
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
      
      if (!initial.additionalFields && initial.formFields && initial.formFields.length > 0) {
          // Migrate on the fly for editing
          initial.additionalFields = initial.formFields.map(f => ({
              name: f,
              type: 'text',
              required: false
          } as AdditionalFieldConfig));
      }
      return initial;
  }

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
          const IconComponent = item.buttonIcon ? (AntdIcons as any)[item.buttonIcon] : null;
          return (
            <List.Item
              actions={[
                <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(index)} />,
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(index)} />,
              ]}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {IconComponent && <IconComponent />}
                      <span>{item.buttonLabel || `Action (${item.buttonIcon || 'unnamed'})`}</span>
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
      <Button type="dashed" onClick={handleAdd} style={{ width: '100%', marginTop: 8 }} icon={<PlusOutlined />}>
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
          <Form.Item name="buttonLabel" label={t('Button Label')}>
            <Input placeholder="e.g. Seed Data" />
          </Form.Item>
          <Form.Item name="buttonIcon" label={t('Icon Name (AntDesign)')} rules={[{ required: true }]}>
             <Select
                showSearch
                placeholder="Select an icon"
                options={iconOptions}
                filterOption={(input, option) => 
                    (option?.value as string).toLowerCase().includes(input.toLowerCase())
                }
             />
          </Form.Item>
          <Form.Item name="modalTitle" label={t('Modal Title')} rules={[{ required: true }]}>
             <Input placeholder="e.g. Create New Entry" />
          </Form.Item>
          <Form.Item name="apiEndpoint" label={t('API Endpoint')} rules={[{ required: true }]}>
             <Input placeholder="e.g. /api/v1/planning/seed OR https://api.exa.com/v1/seed" />
          </Form.Item>

          <Form.Item name="additionalFields" label={t('Form Fields')}>
             <AdditionalFieldsList datasourceColumns={datasourceColumns} allColumns={allColumns} hierarchyFields={hierarchyFields} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="payloadMapping" 
                label={t('Payload Mapping (JSON)')}
                rules={[{
                  validator: (_, val) => {
                    if (!val) return Promise.resolve();
                    try {
                      JSON.parse(val);
                      return Promise.resolve();
                    } catch (e) {
                      return Promise.reject(new Error(t('Must be valid JSON')));
                    }
                  }
                }]}
              >
                <AceEditor
                  mode="json"
                  theme="github"
                  name="chart-action-payload-mapping-editor"
                  width="100%"
                  height="126px"
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
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ fontWeight: 'normal', height: '22px', marginBottom: '8px', color: '#333' }}>
                  {t('Input Payload Structure Preview')}
                </div>
                <div style={{ fontSize: '12px', color: '#666', background: '#fafafa', padding: '12px', borderRadius: '4px', border: '1px solid #f0f0f0', height: '126px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', flex: 1 }}>
{`{
  "field_name_1": "value_1",
  "field_name_2": "value_2"
}`}
                  </pre>
                </div>
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
