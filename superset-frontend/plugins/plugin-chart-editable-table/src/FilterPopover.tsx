import { useState, useEffect } from 'react';
import { Button, Input, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

export const FilterPopover = ({ values, selected, onSave, onCancel }: {
    values: any[];
    selected?: any[];
    onSave: (vals: any[]) => void;
    onCancel: () => void;
}) => {
  const [internalSelected, setInternalSelected] = useState(selected || []);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    setInternalSelected(selected || []);
  }, [selected]);

  const filteredValues = values.filter(v => 
    String(v).toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelectAll = (e: any) => {
    if (e.target.checked) {
      setInternalSelected(values);
    } else {
      setInternalSelected([]);
    }
  };

  const handleCheckboxChange = (val: any, checked: boolean) => {
    setInternalSelected(prev => {
      if (checked) return [...prev, val];
      return prev.filter(v => v !== val);
    });
  };

  const isAllSelected = values.length > 0 && internalSelected.length === values.length;
  const isIndeterminate = internalSelected.length > 0 && internalSelected.length < values.length;

  return (
    <div style={{ padding: 8, width: 250 }} onClick={(e) => e.stopPropagation()}>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Search"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ marginBottom: 8, width: '100%', height: 32 }}
      />
      <div style={{ marginBottom: 8 }}>
         <Checkbox
            indeterminate={isIndeterminate}
            onChange={handleSelectAll}
            checked={isAllSelected}
         >
            Select All
         </Checkbox>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8, border: '1px solid #f0f0f0', padding: '4px' }}>
        {filteredValues.map(val => (
          <div key={String(val)} style={{ marginBottom: 4 }}>
            <Checkbox
              checked={internalSelected.includes(val)}
              onChange={e => handleCheckboxChange(val, e.target.checked)}
            >
              {String(val)}
            </Checkbox>
          </div>
        ))}
        {filteredValues.length === 0 && <div style={{ color: '#999', textAlign: 'center' }}>No matches</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button size="small" onClick={() => setInternalSelected([])}>Reset</Button>
        <Button size="small" onClick={onCancel}>Cancel</Button>
        <Button type="primary" size="small" onClick={() => onSave(internalSelected)}>Apply</Button>
      </div>
    </div>
  );
};
