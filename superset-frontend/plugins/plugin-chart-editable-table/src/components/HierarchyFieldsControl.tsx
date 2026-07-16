import { useState, useEffect } from 'react';
import AceEditor from 'react-ace';
import { Alert, Typography, Switch, Button, List, Modal, Form, Input, Select, InputNumber } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import { HierarchyFieldConfig } from '../types/hierarchy';

// Ace editor imports
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-github';

interface HierarchyFieldsControlProps {
  value?: HierarchyFieldConfig[];
  onChange: (value: HierarchyFieldConfig[]) => void;
  datasourceColumns?: { column_name: string; verbose_name?: string }[];
}

export default function HierarchyFieldsControl({ value = [], onChange, datasourceColumns = [] }: HierarchyFieldsControlProps) {
  const [isJsonMode, setIsJsonMode] = useState<boolean>(false);
  
  // --- JSON Editor State ---
  const [textValue, setTextValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) {
      try {
        const currentParsed = JSON.parse(textValue || '[]');
        if (JSON.stringify(currentParsed) !== JSON.stringify(value)) {
            setTextValue(JSON.stringify(value || [], null, 2));
        }
      } catch (e) {
          if (!textValue) {
             setTextValue(JSON.stringify(value || [], null, 2));
          }
      }
    }
  }, [value, textValue, error]);

  const handleChange = (newVal: string) => {
      setTextValue(newVal);
      try {
          const parsed = JSON.parse(newVal);
          if (Array.isArray(parsed)) {
             setError(null);
             onChange(parsed);
          } else {
             setError(t('Configuration must be a JSON array of objects.'));
          }
      } catch (err: any) {
          setError(err.message);
      }
  };

  // --- Manual UI State ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setEditingIndex(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const item = value[index];
    const formValues = {
        ...item,
        parentField: item.parentField 
            ? (Array.isArray(item.parentField) ? item.parentField : [item.parentField])
            : [],
        filterColumn: item.filterColumn
            ? (Array.isArray(item.filterColumn) ? item.filterColumn : [item.filterColumn])
            : [],
    };
    form.setFieldsValue(formValues);
    setIsModalVisible(true);
  };

  const handleDelete = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };
  
  const handleOk = () => {
    form.validateFields().then(values => {
      const config: HierarchyFieldConfig = {
          ...values,
          level: Number(values.level), // Ensure number
          fieldName: values.fieldName,
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

  const groupedItems = value.reduce((acc, item, index) => {
      const group = item.hierarchyGroup || 'Default';
      if (!acc[group]) {
          acc[group] = [];
      }
      acc[group].push({ item, originalIndex: index });
      return acc;
  }, {} as Record<string, { item: HierarchyFieldConfig; originalIndex: number }[]>);
  
  const sortedGroups = Object.keys(groupedItems).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
         <div>
            <span style={{ marginRight: 8, fontSize: '12px' }}>{t('JSON Editor')}</span>
            <Switch size="small" checked={isJsonMode} onChange={setIsJsonMode} />
         </div>
      </div>

      {isJsonMode ? (
        // --- JSON Editor View ---
        <div>
          <Typography.Paragraph type="secondary" style={{ fontSize: '12px', marginBottom: '8px' }}>
            {t('Define hierarchy levels via a structured JSON array. Each object requires level, fieldName, fieldLabel, columnName, and hierarchyGroup.')}
          </Typography.Paragraph>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', overflow: 'hidden' }}>
            <AceEditor
              mode="json"
              theme="github"
              name="hierarchy-fields-editor"
              width="100%"
              height="350px"
              fontSize={14}
              showPrintMargin={false}
              focus={false}
              editorProps={{ $blockScrolling: true }}
              wrapEnabled
              highlightActiveLine
              value={textValue}
              onChange={handleChange}
              tabSize={2}
              setOptions={{
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,
                showLineNumbers: true,
                showGutter: true,
                useWorker: false, 
              }}
            />
          </div>
          {error && (
             <Alert 
               type="error" 
               message={t('Invalid JSON format')} 
               description={error} 
               showIcon 
               style={{ marginTop: 8 }} 
             />
          )}
        </div>
      ) : (
        // --- Manual UI View ---
        <div>
          {sortedGroups.map(group => (
              <div key={group} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 8, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
                      {group}
                  </div>
                  <List
                    size="small"
                    bordered
                    dataSource={groupedItems[group]}
                    renderItem={({ item, originalIndex }) => (
                      <List.Item
                        actions={[
                          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(originalIndex)} />,
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(originalIndex)} />,
                        ]}
                      >
                        <List.Item.Meta
                          title={item.fieldLabel}
                        />
                      </List.Item>
                    )}
                  />
              </div>
          ))}
          <Button type="dashed" onClick={handleAdd} style={{ width: '100%', marginTop: 8 }} icon={<PlusOutlined />}>
            {t('Add Hierarchy Level')}
          </Button>

          <Modal
            title={editingIndex !== null ? t('Edit Hierarchy Level') : t('Add Hierarchy Level')}
            open={isModalVisible}
            onOk={handleOk}
            onCancel={() => setIsModalVisible(false)}
            width={600}
          >
            <Form form={form} layout="vertical">
              <Form.Item name="hierarchyGroup" label={t('Hierarchy Group')}>
                 <Input placeholder="e.g. Geography, Time" />
              </Form.Item>
              <Form.Item name="level" label={t('Level')} rules={[{ required: true, message: t('Level is required') }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="fieldName" label={t('Field Name (Internal ID)')} rules={[{ required: true }]}>
                 <Select
                    showSearch
                    placeholder="Select column"
                >
                    {datasourceColumns.map(col => (
                        <Select.Option key={col.column_name} value={col.column_name}>
                            {col.verbose_name || col.column_name}
                        </Select.Option>
                    ))}
                </Select>
              </Form.Item>
              <Form.Item name="fieldLabel" label={t('Display Label')} rules={[{ required: true }]}>
                 <Input placeholder="e.g. Business Unit" />
              </Form.Item>
              <Form.Item name="columnName" label={t('Database Column')} rules={[{ required: true }]}>
                 <Select
                    showSearch
                    placeholder="Select database column"
                    filterOption={(input, option) => 
                        (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                    }
                 >
                    {datasourceColumns.map(col => (
                        <Select.Option key={col.column_name} value={col.column_name}>
                            {col.verbose_name ? `${col.verbose_name} (${col.column_name})` : col.column_name}
                        </Select.Option>
                    ))}
                 </Select>
              </Form.Item>
              <Form.Item
                 noStyle
                 shouldUpdate={(prevValues, currentValues) => prevValues.level !== currentValues.level || prevValues.hierarchyGroup !== currentValues.hierarchyGroup}
              >
                 {({ getFieldValue }) => {
                     const currentLevel = Number(getFieldValue('level')) || 0;
                     const currentGroup = getFieldValue('hierarchyGroup') || 'Default';

                     return (
                      <Form.Item name="parentField" label={t('Parent Field(s)')} tooltip={t('ID of parent field(s). Only fields from the SAME group with a LOWER level can be selected.')}>
                          <Select 
                             mode="tags" 
                             placeholder="Select or type parent field IDs"
                             filterOption={(input, option) => 
                                 (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                             }
                          >
                              {value
                                 .map((v, i) => {
                                     const rawName = v.fieldName;
                                     const name = Array.isArray(rawName) ? rawName[0] : rawName;
                                     return { ...v, fieldName: name, originalIndex: i };
                                 })
                                 .filter(v => v.originalIndex !== editingIndex)
                                 // Strict filtering: Same group AND strictly lower level
                                 .filter(v => {
                                     const vGroup = v.hierarchyGroup || 'Default';
                                     const sameGroup = vGroup === currentGroup;
                                     const lowerLevel = v.level < currentLevel;
                                     return sameGroup && lowerLevel; 
                                 })
                                 .filter(v => v.fieldName && typeof v.fieldName === 'string' && v.fieldName.trim() !== '')
                                 .map(v => (
                                  <Select.Option key={v.fieldName} value={v.fieldName}>{v.fieldLabel} ({v.fieldName})</Select.Option>
                               ))}
                          </Select>
                      </Form.Item>
                     );
                 }}
              </Form.Item>
              <Form.Item name="filterColumn" label={t('Filter Column(s)')} tooltip={t('Column in THIS table to filter by parent value. Comma separated if multiple parents.')}>
                <Select
                    showSearch
                    mode="tags"
                    placeholder="Select filter column(s)"
                    filterOption={(input, option) => 
                        (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                    }
                 >
                    {datasourceColumns.map(col => (
                        <Select.Option key={col.column_name} value={col.column_name}>
                            {col.verbose_name || col.column_name}
                        </Select.Option>
                    ))}
                 </Select>
              </Form.Item>
              <Form.Item name="sortMethod" label={t('Sort Method')} initialValue="Default" tooltip={t('How to sort values in this level. Use Chronological for Months, Days, Quarters, etc.')}>
                 <Select>
                     <Select.Option value="Default">{t('Default (Alphabetical/Numeric)')}</Select.Option>
                     <Select.Option value="Chronological">{t('Chronological (Time-based)')}</Select.Option>
                 </Select>
              </Form.Item>
              <Form.Item name="isMulti" label={t('Allow Multiple Selections')}>
                 <Select placeholder="default: false">
                     <Select.Option value={true}>Yes</Select.Option>
                     <Select.Option value={false}>No</Select.Option>
                 </Select>
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )}
    </div>
  );
}
