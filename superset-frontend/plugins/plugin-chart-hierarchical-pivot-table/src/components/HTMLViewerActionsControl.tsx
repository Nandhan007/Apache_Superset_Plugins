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
import { useState } from 'react';
import { Button, List, Modal, Form, Input, Select, Checkbox } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import * as AntdIcons from '@ant-design/icons';
import AceEditor from 'react-ace';
import 'ace-builds/src-min-noconflict/mode-html';
import 'ace-builds/src-min-noconflict/mode-css';
import 'ace-builds/src-noconflict/theme-github';

import { HTMLViewerActionConfig } from '../types/hierarchy';
import { DatasourceColumn } from '../types';

interface HTMLViewerActionsControlProps {
  value?: HTMLViewerActionConfig[];
  onChange: (value: HTMLViewerActionConfig[]) => void;
  allColumns?: DatasourceColumn[];
}

export default function HTMLViewerActionsControl({
  value = [],
  onChange,
  allColumns = [],
}: HTMLViewerActionsControlProps) {
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

  const columnOptions = (allColumns || []).map(c => ({
    label: c.column_name,
    value: c.column_name,
  }));

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
      const config: HTMLViewerActionConfig = {
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

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    form.setFieldsValue(value[index]);
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
                        `HTML Action (${item.buttonIcon || 'unnamed'})`}
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
        {t('Add Custom View Button')}
      </Button>

      <Modal
        title={
          editingIndex !== null
            ? t('Edit Custom View Action')
            : t('Add Custom View Action')
        }
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="buttonLabel"
            label={t('Button Label')}
            rules={[{ required: false }]}
          >
            <Input placeholder="e.g. View Details" />
          </Form.Item>
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
          <Form.Item
            name="modalTitle"
            label={t('Modal Title')}
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g. Entry Information Summary" />
          </Form.Item>

          <Form.Item
            name="isGlobalCustomView"
            valuePropName="checked"
          >
            <Checkbox>{t('Enable Global Custom View')}</Checkbox>
          </Form.Item>

          <Form.Item noStyle dependencies={['isGlobalCustomView']}>
            {({ getFieldValue }) =>
              !getFieldValue('isGlobalCustomView') ? (
                <>
                  <Form.Item
                    name="onlySelectedRow"
                    valuePropName="checked"
                  >
                    <Checkbox>{t('Enable Row-Level Context')}</Checkbox>
                  </Form.Item>

                  <Form.Item noStyle dependencies={['onlySelectedRow']}>
                    {({ getFieldValue: getChildValue }) =>
                      getChildValue('onlySelectedRow') ? (
                        <Form.Item
                          name="uniqueField"
                          label={t('Unique Column')}
                          rules={[{ required: true }]}
                        >
                          <Select
                            showSearch
                            placeholder="Select unique field"
                            options={columnOptions}
                            filterOption={(input, option) =>
                              (option?.value as string)
                                .toLowerCase()
                                .includes(input.toLowerCase())
                            }
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="handlebarsTemplate"
            label={t('HTML / Handlebars Template')}
            rules={[{ required: true }]}
          >
            <AceEditor
              mode="html"
              theme="github"
              name="action-html-template-editor"
              width="100%"
              height="250px"
              style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
              fontSize={14}
              showPrintMargin={false}
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

          <Form.Item name="styleTemplate" label={t('Custom CSS / Styles')}>
            <AceEditor
              mode="css"
              theme="github"
              name="action-style-template-editor"
              width="100%"
              height="150px"
              style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
              fontSize={14}
              showPrintMargin={false}
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
        </Form>
      </Modal>
    </div>
  );
}
