import { Button, List, Input, Select, Checkbox } from 'antd';
import { DeleteOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import { AdditionalFieldConfig } from '../types/hierarchy';
import { DatasourceColumn } from '../types';

interface AdditionalFieldsListProps {
  value?: AdditionalFieldConfig[];
  onChange?: (value: AdditionalFieldConfig[]) => void;
  datasourceColumns?: DatasourceColumn[];
  allColumns?: DatasourceColumn[];
  hierarchyFields?: any[];
}

export default function AdditionalFieldsList({ value = [], onChange, datasourceColumns = [], allColumns = [], hierarchyFields = [] }: AdditionalFieldsListProps) {
  const handleAdd = () => {
    const newValue = [
      ...value,
      { name: '', type: 'text', required: false } as AdditionalFieldConfig,
    ];
    if (onChange) onChange(newValue);
  };

  const handleChange = (index: number, key: keyof AdditionalFieldConfig, val: any) => {
    const newValue = [...value];
    newValue[index] = { ...newValue[index], [key]: val };
    if (onChange) onChange(newValue);
  };

  const handleDelete = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    if (onChange) onChange(newValue);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
      const newValue = [...value];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (targetIndex >= 0 && targetIndex < newValue.length) {
          [newValue[index], newValue[targetIndex]] = [newValue[targetIndex], newValue[index]];
          if (onChange) onChange(newValue);
      }
  };

  const columnsToDisplay = allColumns.length > 0 ? allColumns : datasourceColumns;

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '12px', background: '#fafafa' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, padding: '0 4px' }}>
          <div style={{ flex: 1, fontWeight: 500, fontSize: '12px', color: '#666' }}>{t('Field Name')}</div>
          <div style={{ width: 140, fontWeight: 500, fontSize: '12px', color: '#666' }}>{t('Type')}</div>
          <div style={{ width: 60, fontWeight: 500, fontSize: '12px', color: '#666' }}>{t('Required')}</div>
          <div style={{ width: 80 }}></div>
      </div>
      <List
        size="small"
        bordered={false}
        dataSource={value}
        split={false}
        renderItem={(item, index) => (
          <List.Item style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
             <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {item.type === 'hierarchy' ? (
                          <Select
                             mode={item.multiple ? "multiple" : undefined}
                             showSearch
                             placeholder="Select hierarchy field(s)"
                             value={item.name || (item.multiple ? [] : undefined)}
                             onChange={val => handleChange(index, 'name', val)}
                             style={{ flex: 1 }}
                             size="small"
                             optionFilterProp="children"
                          >
                              {hierarchyFields && hierarchyFields.map((hf: any) => (
                                  <Select.Option key={hf.fieldName || hf.columnName} value={hf.fieldName || hf.columnName}>
                                      {hf.fieldLabel || hf.fieldName || hf.columnName}
                                  </Select.Option>
                              ))}
                          </Select>
                      ) : (
                          <Input 
                             placeholder="Field Name" 
                             value={item.name} 
                             onChange={e => handleChange(index, 'name', e.target.value)} 
                             style={{ flex: 1 }}
                             size="small"
                          />
                      )}
                      <Select
                         value={item.type}
                         onChange={val => handleChange(index, 'type', val)}
                         style={{ width: 140 }}
                         size="small"
                         options={[
                             { label: 'Text', value: 'text' },
                             { label: 'Number', value: 'number' },
                             { label: 'Date', value: 'date' },
                             { label: 'Checkbox', value: 'checkbox' },
                             { label: 'TextArea', value: 'textarea' },
                             { label: 'Dropdown', value: 'dropdown' },
                             { label: 'File Upload', value: 'file' },
                             { label: 'Hierarchy Field', value: 'hierarchy' },
                         ]}
                      />
                     <div style={{ width: 60, textAlign: 'center' }}>
                         <Checkbox 
                            checked={item.required}
                            onChange={e => handleChange(index, 'required', e.target.checked)}
                         />
                     </div>
                     <div style={{ display: 'flex', gap: 4 }}>
                         <Button
                            type="text"
                            size="small"
                            icon={<ArrowUpOutlined />}
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                         />
                         <Button
                            type="text"
                            size="small"
                            icon={<ArrowDownOutlined />}
                            disabled={index === value.length - 1}
                            onClick={() => handleMove(index, 'down')}
                         />
                         <Button 
                            type="text" 
                            danger 
                            size="small"
                            icon={<DeleteOutlined />} 
                            onClick={() => handleDelete(index)} 
                         />
                     </div>
                 </div>
                 
                 {item.type === 'dropdown' && !item.mappedColumn && (
                     <Select
                        mode="tags"
                        style={{ width: '100%', marginTop: 8 }}
                        placeholder="Type options and press Enter (e.g. Approved, Rejected)"
                        value={item.options}
                        onChange={val => handleChange(index, 'options', val)}
                        size="small"
                        open={false} 
                     />
                 )}
                 {(item.type === 'text' || item.type === 'dropdown') && (
                     <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                         <span style={{ fontSize: '11px', color: '#888', minWidth: '100px' }}>{t('Map to Column')}:</span>
                         <Select
                            allowClear
                            showSearch
                            placeholder="Select column to populate value"
                            value={item.mappedColumn}
                            onChange={val => {
                                const newValue = [...value];
                                newValue[index] = { 
                                    ...newValue[index], 
                                    mappedColumn: val || undefined,
                                    options: val ? undefined : newValue[index].options 
                                };
                                if (onChange) onChange(newValue);
                            }}
                            style={{ flex: 1 }}
                            size="small"
                            optionFilterProp="children"
                         >
                             {columnsToDisplay.map(col => (
                                 <Select.Option key={col.column_name} value={col.column_name}>
                                     {col.verbose_name || col.column_name}
                                 </Select.Option>
                             ))}
                         </Select>
                     </div>
                 )}
                  {item.type === 'file' && (
                      <div style={{ marginTop: 8, paddingLeft: 4 }}>
                          <Checkbox 
                             checked={item.multiple}
                             onChange={e => handleChange(index, 'multiple', e.target.checked)}
                          >
                             {t('Allow Multiple Files')}
                          </Checkbox>
                      </div>
                  )}
                  {item.type === 'hierarchy' && (
                      <div style={{ marginTop: 8, paddingLeft: 4 }}>
                          <Checkbox 
                             checked={item.multiple}
                             onChange={e => {
                                 const isChecked = e.target.checked;
                                 let newName = item.name;
                                 if (isChecked) {
                                     newName = item.name ? (Array.isArray(item.name) ? item.name : [item.name]) : [];
                                 } else {
                                     newName = Array.isArray(item.name) ? (item.name[0] || '') : item.name;
                                 }
                                 const newValue = [...value];
                                 newValue[index] = { ...newValue[index], multiple: isChecked, name: newName };
                                 if (onChange) onChange(newValue);
                             }}
                          >
                             {t('Allow Multiple Selections')}
                          </Checkbox>
                      </div>
                  )}
             </div>
          </List.Item>
        )}
      />
      <Button type="dashed" onClick={handleAdd} style={{ width: '100%', marginTop: 12 }} icon={<PlusOutlined />} size="small">
        {t('Add Custom Field')}
      </Button>
    </div>
  );
}
