/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDrag, useDrop, DndProvider, DndContext } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Modal, Tabs, Input, Checkbox, List } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme, SupersetTheme } from '@apache-superset/core/theme';
import { DatasourceColumn, DatasourceMetric } from './types';

const ItemTypes = {
  CARD: 'card',
};

// Safe DnD Provider Wrapper using Single Manager on Window
const SingletonDndProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = React.useContext(DndContext);
  
  // 1. If we are already inside a DndProvider (e.g. from Superset App), use it.
  if (context && context.dragDropManager) {
     return <>{children}</>;
  }

  // 2. Otherwise, check or create a global manager on window to share across plugins
  //    This avoids "Cannot have two HTML5 backends" since we reuse the same backend.
  const globalManager = (window as any).__SUPERSET_DND_MANAGER__;
  
  if (globalManager) {
      // Reuse existing backend manager
      return <DndProvider manager={globalManager}>{children}</DndProvider>;
  }

  // 3. Fallback: Initialize a new standard backend, and register it globally
  //    BUT we can't easily extract the manager from <DndProvider backend={...}> 
  //    without creating it manually first.
  
  return (
      <DndProvider backend={HTML5Backend} options={{ rootElement: window }}>
          <ManagerRegistrar>
            {children}
          </ManagerRegistrar>
      </DndProvider>
  );
};

// Helper to capture the manager ref and put it on window
const ManagerRegistrar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { dragDropManager } = React.useContext(DndContext);
    useEffect(() => {
        if (dragDropManager && !(window as any).__SUPERSET_DND_MANAGER__) {
            (window as any).__SUPERSET_DND_MANAGER__ = dragDropManager;
        }
    }, [dragDropManager]);
    return <>{children}</>;
};

const Container = styled.div`
  display: flex;
  height: 500px;
`;

const Section = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border: 1px solid ${({ theme }) => theme.colorSplit}; 
  overflow-y: auto;
  margin: ${({ theme }) => theme.sizeUnit}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  background-color: ${({ theme }) => theme.colorBgBase};
`;

const SectionTitle = styled.h4`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  text-align: center;
  font-weight: bold;
`;

interface DraggableItemProps {
    $isDragging: boolean;
    $isSelected: boolean;
    theme: SupersetTheme;
}

const DraggableItem = styled.div<DraggableItemProps>`
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  background-color: ${({ theme, $isSelected }) => 
    $isSelected 
       ? (theme.colorPrimaryBg || '#e6f7ff') 
       : theme.colorBgBase};
  border: 1px solid ${({ theme, $isSelected }) => 
    $isSelected 
       ? theme.colorPrimary 
       : theme.colorSplit};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  cursor: pointer;
  opacity: ${({ $isDragging }) => ($isDragging ? 0.5 : 1)};
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
  color: ${({ theme, $isSelected }) => 
      $isSelected ? theme.colorPrimary : theme.colorText};

  &:hover {
    border-color: ${({ theme }) => theme.colorPrimary};
    background-color: ${({ theme, $isSelected }) => 
        !$isSelected ? (theme.colorBgBase || '#f5f5f5') : undefined};
  }
`;

const StyledIcon = styled.span`
  margin-left: 8px;
  color: ${({ theme }) => theme.colorPrimary};
`;

interface CardProps {
  id: string;
  text: string;
  index: number;
  listType: 'rows' | 'cols';
  isSelected: boolean;
  moveCard: (dragIndex: number, hoverIndex: number, sourceList: 'rows' | 'cols', targetList: 'rows' | 'cols') => void;
  toggleSelection: (id: string, listType: 'rows' | 'cols') => void;
}

const Card: React.FC<CardProps> = ({ id, text, index, moveCard, listType, isSelected, toggleSelection }) => {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const [{ isDragging }, drag] = useDrag<
    { type: string; id: string; index: number; listType: 'rows' | 'cols' },
    unknown,
    { isDragging: boolean }
  >({
    item: { type: ItemTypes.CARD, id, index, listType },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.CARD,
    hover(item: any, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      const sourceList = item.listType;
      const targetList = listType;

      if (dragIndex === hoverIndex && sourceList === targetList) {
        return;
      }

      moveCard(dragIndex, hoverIndex, sourceList, targetList);

      item.index = hoverIndex;
      item.listType = targetList;
    },
  });

  drag(drop(ref));

  return (
    <DraggableItem 
        ref={ref} 
        $isDragging={isDragging} 
        $isSelected={isSelected}
        theme={theme}
        onClick={() => toggleSelection(id, listType)}
    >
      {text}
      {isSelected && (
          <StyledIcon>
            <CheckOutlined />
          </StyledIcon>
      )}
    </DraggableItem>
  );
};

interface SectionDropZoneProps {
    listType: 'rows' | 'cols';
    moveCard: (dragIndex: number, hoverIndex: number, sourceList: 'rows' | 'cols', targetList: 'rows' | 'cols') => void;
    children: React.ReactNode;
}



const SectionDropZone: React.FC<SectionDropZoneProps> = ({ listType, moveCard, children }) => {
    const [, drop] = useDrop({
        accept: ItemTypes.CARD,
        drop: (item: any, monitor) => {
             if (monitor.didDrop()) return;
             if (item.listType !== listType) {
                 moveCard(item.index, 0, item.listType, listType);
                 item.listType = listType;
                 item.index = 0;
             }
        }
    });

    const theme = useTheme();

    return (
        <Section ref={drop} theme={theme}>
            <SectionTitle>{listType === 'rows' ? t('Rows') : t('Columns')}</SectionTitle>
            {children}
        </Section>
    )
}

interface LayoutEditorProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (newRows: string[], newCols: string[]) => void;
  initialRows: string[];
  initialCols: string[];
  allColumns: DatasourceColumn[];
  initialMetrics: string[];
  allMetrics: DatasourceMetric[];
  onSaveMetrics: (newMetrics: string[]) => void;
  mountNode?: HTMLElement | null;
}

export default function LayoutEditor({ 
    visible, 
    onCancel, 
    onSave, 
    initialRows, 
    initialCols, 
    allColumns,
    initialMetrics = [],
    allMetrics = [],
    onSaveMetrics,
    mountNode,
}: LayoutEditorProps) {
  const [rowItems, setRowItems] = useState<string[]>([]);
  const [colItems, setColItems] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [selectedColKeys, setSelectedColKeys] = useState<Set<string>>(new Set());
  
  // Metrics State
  const [metricItems, setMetricItems] = useState<DatasourceMetric[]>([]);
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');

  // Optimize initialization
  useEffect(() => {
     if (visible) {
        // Layout Initialization
        setColItems(initialCols);
        setSelectedColKeys(new Set(initialCols));
        setSelectedRowKeys(new Set(initialRows));
        
        const colSet = new Set(initialCols);
        const rowConfigSet = new Set(initialRows);
        
        const unusedItems = allColumns
            .filter(c => c.groupby)
            .map(c => c.column_name)
            .filter(c => !colSet.has(c) && !rowConfigSet.has(c));
            
        const initialRowItems = [...initialRows, ...unusedItems];
        setRowItems(initialRowItems);

        // Metrics Initialization
        // Merge available metrics from datasource with any currently selected (adhoc) metrics to ensure nothing is lost
        // Map to unique list
        const initialMetricSet = new Set(initialMetrics);
        setSelectedMetricKeys(initialMetricSet);

        // Combine all known metrics
        const allKnownMetricsMap = new Map<string, DatasourceMetric>();
        
        // Add all from datasource
        allMetrics.forEach(m => {
             // Handle potential duplicate names if API returns them? Assuming unique metric_name
             allKnownMetricsMap.set(m.metric_name, m);
        });

        // Add currently selected if missing (adhoc metrics might just be strings)
        initialMetrics.forEach(mName => {
            if (!allKnownMetricsMap.has(mName)) {
                allKnownMetricsMap.set(mName, { metric_name: mName, verbose_name: mName });
            }
        });

        setMetricItems(Array.from(allKnownMetricsMap.values()));
     }
  }, [visible, initialRows, initialCols, allColumns, initialMetrics, allMetrics]);

  const moveCard = useCallback(
    (dragIndex: number, hoverIndex: number, sourceList: 'rows' | 'cols', targetList: 'rows' | 'cols') => {
        const sourceData = sourceList === 'rows' ? [...rowItems] : [...colItems];
        const targetData = targetList === 'rows' ? [...rowItems] : [...colItems];
        
        if (sourceList === targetList) {
            const [removed] = sourceData.splice(dragIndex, 1);
            sourceData.splice(hoverIndex, 0, removed);
            if (sourceList === 'rows') setRowItems(sourceData);
            else setColItems(sourceData);
        } else {
            const [removed] = sourceData.splice(dragIndex, 1);
            targetData.splice(hoverIndex, 0, removed);
            
            if (sourceList === 'rows') {
                // Moving Row -> Col
                setRowItems(sourceData);
                setColItems(targetData);
                
                // Persistence Logic:
                // If row was selected -> Add to Col Selected
                // If row was plain -> Stay plain (do NOT add to Col Selected)
                if (selectedRowKeys.has(removed)) {
                    setSelectedColKeys(prev => {
                        const next = new Set(prev);
                        next.add(removed);
                        return next;
                    });
                     // Remove from row selected keys
                    setSelectedRowKeys(prev => {
                        const next = new Set(prev);
                        next.delete(removed);
                        return next;
                    });
                } else {
                    // It was plain, so it stays plain (not in selectedColKeys)
                }
            } else {
                // Moving Col -> Row
                setColItems(sourceData);
                setRowItems(targetData);
                
                // Persistence Logic:
                // If col was selected -> Add to Row Selected
                if (selectedColKeys.has(removed)) {
                     setSelectedRowKeys(prev => {
                        const next = new Set(prev);
                        next.add(removed);
                        return next;
                    });
                    setSelectedColKeys(prev => {
                        const next = new Set(prev);
                        next.delete(removed);
                        return next;
                    });
                } else {
                    // Stays plain
                }
            }
        }
    },
    [rowItems, colItems, selectedRowKeys, selectedColKeys],
  );
  
  const toggleSelection = useCallback(
      (id: string, listType: 'rows' | 'cols') => {
        const targetSet = listType === 'rows' ? selectedRowKeys : selectedColKeys;
        const setFunction = listType === 'rows' ? setSelectedRowKeys : setSelectedColKeys;
        
        const newSet = new Set(targetSet);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setFunction(newSet);
      },
      [selectedRowKeys, selectedColKeys]
  );
  
  const toggleMetricSelection = useCallback((id: string) => {
      setSelectedMetricKeys(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  }, []);

  const handleOk = () => {
      // 1. Layout Save
      const finalRows = rowItems.filter(id => selectedRowKeys.has(id));
      const finalCols = colItems.filter(id => selectedColKeys.has(id));
      onSave(finalRows, finalCols);

      // 2. Metrics Save
      // Return order is not strictly draggable here, so we might want to respect some order?
      // For now, let's keep the order of 'metricItems' but filtered by selection? 
      // Or better: Preserve the order of initialMetrics for those that remain, and append new ones at the end?
      // Simplified: Just filter metricItems by selection
      const finalMetrics = metricItems
          .filter(m => selectedMetricKeys.has(m.metric_name))
          .map(m => m.metric_name);
      
      if (onSaveMetrics) {
          onSaveMetrics(finalMetrics);
      }
  };

  return (
    <Modal
      title={t('Edit Layout')}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={600}
      okText={t('Apply')}
      className='hierarchical-pivot-table-layout-editor'
      destroyOnHidden
      getContainer={mountNode ? () => mountNode : undefined}
      styles={mountNode ? { mask: { position: 'absolute' } } : undefined}
      centered
    >
      <Tabs 
        defaultActiveKey="layout"
        items={[
          {
            key: 'layout',
            label: t('Layout'),
            children: (
              <SingletonDndProvider>
                  <Container>
                  <SectionDropZone listType="rows" moveCard={moveCard}>
                      {rowItems.map((row, index) => (
                          <Card
                              key={row}
                              index={index}
                              id={row}
                              text={row}
                              listType="rows"
                              isSelected={selectedRowKeys.has(row)}
                              moveCard={moveCard}
                              toggleSelection={toggleSelection}
                          />
                      ))}
                  </SectionDropZone>
                  
                  <SectionDropZone listType="cols" moveCard={moveCard}>
                      {colItems.map((col, index) => (
                          <Card
                              key={col}
                              index={index}
                              id={col}
                              text={col}
                              listType="cols"
                              isSelected={selectedColKeys.has(col)}
                              moveCard={moveCard}
                              toggleSelection={toggleSelection}
                          />
                      ))}
                  </SectionDropZone>
                  </Container>
              </SingletonDndProvider>
            ),
          },
          {
            key: 'data',
            label: t('Data'),
            children: (
              <Container style={{ flexDirection: 'column', height: '500px' }}>
                  <div style={{ padding: '8px 16px' }}>
                      <Input.Search
                          placeholder={t('Search measures')}
                          onChange={e => setSearchText(e.target.value)}
                          style={{ marginBottom: 8 }}
                      />
                  </div>
                  <Section style={{ border: 'none', padding: '0 16px' }}>
                      <List
                          dataSource={metricItems.filter(item => 
                              (item.verbose_name || item.metric_name || '').toLowerCase().includes(searchText.toLowerCase())
                          )}
                          renderItem={item => (
                              <List.Item style={{ padding: '8px 0' }}>
                                  <Checkbox 
                                      checked={selectedMetricKeys.has(item.metric_name)}
                                      onChange={() => toggleMetricSelection(item.metric_name)}
                                  >
                                      {item.verbose_name || item.metric_name}
                                  </Checkbox>
                              </List.Item>
                          )}
                      />
                  </Section>
              </Container>
            ),
          }
        ]}
      />
    </Modal>
  );
}
