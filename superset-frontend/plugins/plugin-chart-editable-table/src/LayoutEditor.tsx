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
import { Modal, Tabs, Input, List, Button, Checkbox as AntCheckbox } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme, SupersetTheme } from '@apache-superset/core/theme';
import { DatasourceColumn, DatasourceMetric } from './types';

// Safe DnD Provider Wrapper
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
// Wait, I need to implement the check.
// Using DndContext from react-dnd directly implies we need to inspect it.
// Assuming we can't reliably import DndContext without risking build issues if it's not exported.
// I'll stick to removing forceRender first. If that fails on OPEN, I'll do the complex wrapper.
// But the user error was "while rendering the visualization" (immediate).
// Removing forceRender is the correct first step.


const ItemTypes = {
  CARD: 'card',
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
  padding: ${({ theme }) => theme.sizeUnit}px;
  margin-bottom: 2px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  cursor: pointer;
  opacity: ${({ $isDragging }) => ($isDragging ? 0.5 : 1)};
  display: flex;
  align-items: center;
  transition: all 0.2s;
  color: ${({ theme }) => theme.colorText};

  &:hover {
    background-color: ${({ theme }) => theme.colorBgLayout};
  }
`;



interface CardProps {
  id: string;
  text: string;
  index: number;
  listType: 'rows' | 'cols' | 'metrics';
  isSelected: boolean;
  moveCard: (dragIndex: number, hoverIndex: number, sourceList: 'rows' | 'cols' | 'metrics', targetList: 'rows' | 'cols' | 'metrics') => void;
  toggleSelection: (id: string, listType: 'rows' | 'cols' | 'metrics') => void;
}

const Card: React.FC<CardProps> = React.memo(({ id, text, index, moveCard, listType, isSelected, toggleSelection }) => {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const [{ isDragging }, drag] = useDrag<any, any, any>({
    type: ItemTypes.CARD,
    item: { type: ItemTypes.CARD, id, index, listType },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  } as any);

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
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {listType !== 'metrics' && (
             <MenuOutlined style={{ marginRight: 8, color: theme.colorTextSecondary, cursor: 'grab' }} />
          )}
          <AntCheckbox 
             checked={isSelected} 
             style={{ marginRight: 8 }} 
             onClick={(e) => e.stopPropagation()}
             onChange={() => toggleSelection(id, listType)}
          />
          <span style={{ flex: 1 }}>{text}</span>
      </div>
    </DraggableItem>
  );
});

interface SectionDropZoneProps {
    listType: 'rows' | 'cols';
    moveCard: (dragIndex: number, hoverIndex: number, sourceList: 'rows' | 'cols' | 'metrics', targetList: 'rows' | 'cols' | 'metrics') => void;
    children: React.ReactNode;
}



const SectionDropZone: React.FC<SectionDropZoneProps> = ({ listType, moveCard, children }) => {
    const [, drop] = useDrop({
        accept: ItemTypes.CARD,
        drop: (item: any, monitor) => {
             if (monitor.didDrop()) return;
             if (item.listType !== listType) {
                 // Prevent dropping metrics into rows/cols if needed, or handle it.
                 // Currently we only have 'rows' list type in this component usage.
                 if (item.listType === 'metrics') return; 
                 
                 moveCard(item.index, 0, item.listType, listType);
                 item.listType = listType;
                 item.index = 0;
             }
        }
    });

    const theme = useTheme();

    return (
        <Section ref={drop} theme={theme}>
            <SectionTitle>{t('Dimensions')}</SectionTitle>
            {children}
        </Section>
    )
}

interface LayoutEditorProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (newRows: string[], newCols: string[], newMetrics: string[]) => void;
  initialRows: string[];
  initialCols: string[];
  allColumns: DatasourceColumn[];
  initialMetrics: string[];
  allMetrics: DatasourceMetric[];
  mountNode?: HTMLElement | null;
}

// SafeDndProvider


export default function LayoutEditor({ 
    visible, 
    onCancel, 
    onSave, 
    initialRows, 
    initialCols, 
    allColumns,
    initialMetrics = [],
    allMetrics = [],
    mountNode,
}: LayoutEditorProps) {
  // We will treat 'rowItems' as the single 'Dimensions' list. 
  // We merge initialLines and initialCols into this list on init, effectively flattening any existing pivot config.
  const [items, setItems] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('1');
  
  // Metrics State
  const [metricItems, setMetricItems] = useState<DatasourceMetric[]>([]);
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');

  // Optimize initialization
  useEffect(() => {
     if (visible) {
        // Layout Initialization
        // Merge rows and cols into one single list
        const combined = Array.from(new Set([...initialRows, ...initialCols]));
        // Ensure uniqueness just in case
        const combinedSet = new Set(combined);
        
        // Find unused columns
        const unusedItems = allColumns
            .filter(c => c.groupby)
            .map(c => c.column_name)
            .filter(c => !combinedSet.has(c));
            
        const initialItems = [...combined, ...unusedItems];
        setItems(initialItems);
        setSelectedKeys(new Set(combined));

        // Metrics Initialization
        const initialMetricSet = new Set(initialMetrics);
        setSelectedMetricKeys(initialMetricSet);

        const allKnownMetricsMap = new Map<string, DatasourceMetric>();
        
        allMetrics.forEach(m => {
             allKnownMetricsMap.set(m.metric_name, m);
        });

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
        setItems((prevItems) => {
            const newItems = [...prevItems];
            const [removed] = newItems.splice(dragIndex, 1);
            newItems.splice(hoverIndex, 0, removed);
            return newItems;
        });
    },
    [],
  );
  
  const moveMetricCard = useCallback(
    (dragIndex: number, hoverIndex: number) => {
        setMetricItems((prevItems) => {
            const newItems = [...prevItems];
            const [removed] = newItems.splice(dragIndex, 1);
            newItems.splice(hoverIndex, 0, removed);
            return newItems;
        });
    },
    []
  );

  const toggleSelection = useCallback((key: string, listType: 'rows' | 'cols' | 'metrics') => {
      setSelectedKeys(prev => {
          const newSelected = new Set(prev);
          if (newSelected.has(key)) {
              newSelected.delete(key);
          } else {
              newSelected.add(key);
          }
           return newSelected;
      });
  }, []);
  
  const toggleMetricSelection = useCallback((key: string) => {
      setSelectedMetricKeys(prev => {
         const newSelected = new Set(prev);
         if (newSelected.has(key)) {
             newSelected.delete(key);
         } else {
             newSelected.add(key);
         }
         return newSelected;
      });
  }, []);

  const handleSave = () => {
      // Construct final Dimensions list
      // We want items that are IN 'items' array AND in 'selectedKeys'
      // Order Matters: we should preserve the order of 'items'
      const finalDimensions = items.filter(id => selectedKeys.has(id));
      const finalMetrics = metricItems.filter(m => selectedMetricKeys.has(m.metric_name)).map(m => m.metric_name);
      
      onSave(finalDimensions, [], finalMetrics);
  };

  // Optimize column lookup
  const columnMap = React.useMemo(() => {
     const map = new Map<string, DatasourceColumn>();
     allColumns.forEach(c => map.set(c.column_name, c));
     return map;
  }, [allColumns]);

  const draggableItems = items.map((id, index) => {
     // Find column meta if available
      const col = columnMap.get(id);
      const text = col ? (col.verbose_name || col.column_name) : id;
      
      return (
        <Card
          key={id}
          id={id}
          index={index}
          listType="rows"
          text={text}
          moveCard={moveCard}
          isSelected={selectedKeys.has(id)}
          toggleSelection={toggleSelection}
        />
      );
  });
  
  const filteredMetrics = metricItems.filter(m => 
      !searchText || 
      m.metric_name.toLowerCase().includes(searchText.toLowerCase()) || 
      (m.verbose_name && m.verbose_name.toLowerCase().includes(searchText.toLowerCase()))
  );

  return (
    <Modal
      title={t('Edit Layout')}
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('Cancel')}
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          {t('Apply')}
        </Button>,
      ]}
      className="pivot-table-layout-editor"
      destroyOnHidden
      getContainer={mountNode ? () => mountNode : undefined}
      styles={mountNode ? { mask: { position: 'absolute' } } : undefined}
      centered
    >
    <SingletonDndProvider>
        <Tabs 
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: '1',
              label: t('Dimensions'),
              children: (
                 <Container>
                  {/* Single Pane for Dimensions with Checks? 
                      Or Available vs Dimensions?
                      Code implements single DropZone 'rows'.
                  */}
                  <SectionDropZone listType="rows" moveCard={moveCard}>
                     {draggableItems}
                  </SectionDropZone>
                 </Container>
              ),
            },
            {
              key: '2',
              label: t('Data'),
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                      <Input 
                          placeholder={t('Search Metrics...')} 
                          value={searchText}
                          onChange={e => setSearchText(e.target.value)}
                      />
                  </div>
                  <Container style={{ display: 'block' }}>
                      <List
                          dataSource={filteredMetrics}
                          renderItem={(item, index) => (
                              <Card 
                                 key={item.metric_name}
                                 id={item.metric_name}
                                 index={index}
                                 listType="metrics" // special
                                 text={item.verbose_name || item.metric_name}
                                 moveCard={moveMetricCard as any}
                                 isSelected={selectedMetricKeys.has(item.metric_name)}
                                 toggleSelection={(id) => toggleMetricSelection(id)}
                              />
                          )}
                      />
                  </Container>
                </>
              ),
            }
          ]}
        />
      </SingletonDndProvider>
    </Modal>
  );
}
