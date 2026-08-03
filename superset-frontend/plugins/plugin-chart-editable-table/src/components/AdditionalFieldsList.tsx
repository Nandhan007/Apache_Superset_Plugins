import { Button, List, Input, Select, Checkbox } from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
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

export default function AdditionalFieldsList({
  value = [],
  onChange,
  datasourceColumns = [],
  allColumns = [],
  hierarchyFields = [],
}: AdditionalFieldsListProps) {
  const handleAdd = () => {
    const newValue = [
      ...value,
      { name: '', type: 'text', required: false } as AdditionalFieldConfig,
    ];
    if (onChange) onChange(newValue);
  };

  const handleChange = (
    index: number,
    key: keyof AdditionalFieldConfig,
    val: any,
  ) => {
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
      [newValue[index], newValue[targetIndex]] = [
        newValue[targetIndex],
        newValue[index],
      ];
      if (onChange) onChange(newValue);
    }
  };

  const columnsToDisplay =
    allColumns.length > 0 ? allColumns : datasourceColumns;

  const availableHierarchyGroups = Array.from(
    new Set(
      (hierarchyFields || [])
        .map((hf: any) => hf.hierarchyGroup || hf.hierarchy_group)
        .filter((g: any): g is string => !!g),
    ),
  );

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        padding: '12px',
        background: '#fafafa',
      }}
    >
      <div
        style={{ display: 'flex', gap: 10, marginBottom: 8, padding: '0 4px' }}
      >
        <div
          style={{ flex: 1, fontWeight: 500, fontSize: '12px', color: '#666' }}
        >
          {t('Field Name')}
        </div>
        <div
          style={{
            width: 140,
            fontWeight: 500,
            fontSize: '12px',
            color: '#666',
          }}
        >
          {t('Type')}
        </div>
        <div
          style={{
            width: 60,
            fontWeight: 500,
            fontSize: '12px',
            color: '#666',
          }}
        >
          {t('Required')}
        </div>
        <div style={{ width: 80 }}></div>
      </div>
      <List
        size="small"
        bordered={false}
        dataSource={value}
        split={false}
        renderItem={(item, index) => (
          <List.Item
            style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0' }}
          >
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {item.type === 'hierarchy' ? (
                  <Select
                    mode={
                      item.multipleFields || Array.isArray(item.name)
                        ? 'multiple'
                        : undefined
                    }
                    showSearch
                    placeholder="Select hierarchy field(s)"
                    value={
                      item.multipleFields || Array.isArray(item.name)
                        ? Array.isArray(item.name)
                          ? item.name
                          : item.name
                          ? [item.name]
                          : []
                        : typeof item.name === 'string'
                        ? item.name || undefined
                        : Array.isArray(item.name)
                        ? item.name[0] || undefined
                        : undefined
                    }
                    onChange={val => handleChange(index, 'name', val)}
                    style={{ flex: 1 }}
                    size="small"
                    optionFilterProp="children"
                  >
                    {(() => {
                      const filtered = (hierarchyFields || []).filter((hf: any) => {
                        if (!item.hierarchyGroup || item.hierarchyGroup === 'All') return true;
                        const grp = hf.hierarchyGroup || hf.hierarchy_group || '';
                        return grp.toLowerCase().trim() === item.hierarchyGroup.toLowerCase().trim();
                      });

                      const seenNames = new Set<string>();
                      const deduplicated: any[] = [];
                      filtered.forEach((hf: any) => {
                        const name = (hf.fieldName || hf.columnName || '').trim();
                        if (name && !seenNames.has(name.toLowerCase())) {
                          seenNames.add(name.toLowerCase());
                          deduplicated.push(hf);
                        }
                      });

                      return deduplicated.map((hf: any) => {
                        const fieldVal = hf.fieldName || hf.columnName;
                        const label =
                          hf.fieldLabel ||
                          hf.label ||
                          hf.verbose_name ||
                          hf.fieldName ||
                          hf.columnName;
                        return (
                          <Select.Option key={fieldVal} value={fieldVal}>
                            {label}
                          </Select.Option>
                        );
                      });
                    })()}
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
                    onChange={e =>
                      handleChange(index, 'required', e.target.checked)
                    }
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#888',
                      minWidth: '100px',
                    }}
                  >
                    {t('Map to Column')}:
                  </span>
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
                        options: val ? undefined : newValue[index].options,
                      };
                      if (onChange) onChange(newValue);
                    }}
                    style={{ flex: 1 }}
                    size="small"
                    optionFilterProp="children"
                  >
                    {columnsToDisplay.map(col => (
                      <Select.Option
                        key={col.column_name}
                        value={col.column_name}
                      >
                        {(col as any).label || col.verbose_name || col.column_name}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              )}
              {item.type === 'file' && (
                <div style={{ marginTop: 8, paddingLeft: 4 }}>
                  <Checkbox
                    checked={item.multiple}
                    onChange={e =>
                      handleChange(index, 'multiple', e.target.checked)
                    }
                  >
                    {t('Allow Multiple Files')}
                  </Checkbox>
                </div>
              )}
              {item.type === 'hierarchy' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginTop: 6,
                    paddingLeft: 4,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  {availableHierarchyGroups.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#666',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t('Group')}:
                      </span>
                      <Select
                        size="small"
                        style={{ minWidth: 100 }}
                        allowClear
                        placeholder={t('All')}
                        value={item.hierarchyGroup || undefined}
                        onChange={val => {
                          const newGroupFields = val
                            ? (hierarchyFields || [])
                                .filter(
                                  (hf: any) =>
                                    (hf.hierarchyGroup ||
                                      hf.hierarchy_group) === val,
                                )
                                .map(
                                  (hf: any) => hf.fieldName || hf.columnName,
                                )
                            : [];

                          let updatedName: string | string[] = item.name;
                          if (val && item.name) {
                            if (Array.isArray(item.name)) {
                              updatedName = item.name.filter(n =>
                                newGroupFields.includes(n),
                              );
                            } else if (!newGroupFields.includes(item.name)) {
                              updatedName = '';
                            }
                          }

                          const newValue = [...value];
                          newValue[index] = {
                            ...newValue[index],
                            hierarchyGroup: val,
                            name: updatedName,
                          };
                          if (onChange) onChange(newValue);
                        }}
                        options={[
                          { label: t('All'), value: '' },
                          ...availableHierarchyGroups.map(g => ({
                            label: g,
                            value: g,
                          })),
                        ]}
                      />
                    </div>
                  )}

                  <Checkbox
                    checked={!!(item.multipleFields || Array.isArray(item.name))}
                    onChange={e => {
                      const isChecked = e.target.checked;
                      let newName = item.name;
                      if (isChecked) {
                        newName = item.name
                          ? Array.isArray(item.name)
                            ? item.name
                            : [item.name]
                          : [];
                      } else {
                        newName = Array.isArray(item.name)
                          ? item.name[0] || ''
                          : item.name;
                      }
                      const newValue = [...value];
                      newValue[index] = {
                        ...newValue[index],
                        multipleFields: isChecked,
                        name: newName,
                      };
                      if (onChange) onChange(newValue);
                    }}
                    style={{ fontSize: '12px' }}
                  >
                    {t('Allow Multi-Fields')}
                  </Checkbox>

                  <Checkbox
                    checked={!!item.isMulti}
                    onChange={e => {
                      handleChange(index, 'isMulti', e.target.checked);
                    }}
                    style={{ fontSize: '12px' }}
                  >
                    {t('Allow Multi-Values')}
                  </Checkbox>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#666',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('Sort')}:
                    </span>
                    <Select
                      size="small"
                      style={{ width: 110 }}
                      value={item.sortMethod || 'Default'}
                      onChange={val => handleChange(index, 'sortMethod', val)}
                      options={[
                        { label: t('Default'), value: 'Default' },
                        { label: t('Ascending'), value: 'Ascending' },
                        { label: t('Descending'), value: 'Descending' },
                        { label: t('Chronological'), value: 'Chronological' },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          </List.Item>
        )}
      />
      <Button
        type="dashed"
        onClick={handleAdd}
        style={{ width: '100%', marginTop: 12 }}
        icon={<PlusOutlined />}
        size="small"
      >
        {t('Add Custom Field')}
      </Button>
    </div>
  );
}
