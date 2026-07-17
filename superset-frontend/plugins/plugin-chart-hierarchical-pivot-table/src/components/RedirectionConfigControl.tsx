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
import { Button, List, Modal, Form, Input, Checkbox, Select } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { t } from '@apache-superset/core/translation';
import { RedirectConfig, DatasourceColumn } from '../types';

interface RedirectionConfigControlProps {
  value?: RedirectConfig[];
  onChange: (value: RedirectConfig[]) => void;
  isGlobal?: boolean;
  allColumns?: DatasourceColumn[];
}

export default function RedirectionConfigControl({
  value = [],
  onChange,
  isGlobal = false,
  allColumns = [],
}: RedirectionConfigControlProps) {
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
    form.setFieldsValue({
      openInNewTab: false,
      ...value[index],
    });
    setIsModalVisible(true);
  };

  const handleDelete = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const handleOk = () => {
    form.validateFields().then(values => {
      const config: RedirectConfig = {
        label: values.label,
        url: values.url,
        addDimensionsAsParams: values.addDimensionsAsParams,
        openInNewTab: values.openInNewTab,
        uniqueField: values.uniqueField || undefined,
      };

      const newValue = [...value];
      if (editingIndex !== null) {
        newValue[editingIndex] = config;
      } else {
        newValue.push(config);
      }
      setIsModalVisible(false);
      form.resetFields();
      onChange(newValue);
    });
  };

  return (
    <div>
      <List
        size="small"
        bordered
        dataSource={value}
        renderItem={(item, index) => (
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
                item.label ||
                (isGlobal
                  ? t('Untitled Global Redirection')
                  : t('Untitled Redirection'))
              }
            />
          </List.Item>
        )}
      />
      <Button
        type="dashed"
        onClick={handleAdd}
        style={{ width: '100%', marginTop: 8 }}
        icon={<PlusOutlined />}
      >
        {isGlobal
          ? t('Add Global Redirection Link')
          : t('Add Redirection Link')}
      </Button>

      <Modal
        title={
          editingIndex !== null
            ? isGlobal
              ? t('Edit Global Redirection Link')
              : t('Edit Redirection Link')
            : isGlobal
              ? t('Add Global Redirection Link')
              : t('Add Redirection Link')
        }
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="label"
            label={t('Menu Name')}
            rules={[{ required: true, message: t('Please input a menu name') }]}
          >
            <Input placeholder={t('e.g. Search store')} />
          </Form.Item>
          <Form.Item
            name="url"
            label={t('Redirection URL')}
            rules={[
              { required: true, message: t('Please input a redirection URL') },
            ]}
          >
            <Input
              placeholder={t('e.g. https://google.com/search?q={store_name}')}
            />
          </Form.Item>
          <Form.Item
            name="openInNewTab"
            valuePropName="checked"
            initialValue={false}
          >
            <Checkbox>{t('Open in New Tab')}</Checkbox>
          </Form.Item>
          {!isGlobal && (
            <Form.Item name="addDimensionsAsParams" valuePropName="checked">
              <Checkbox>{t('Add Dimensions as Filter Params')}</Checkbox>
            </Form.Item>
          )}
          <Form.Item name="uniqueField" label={t('Unique Column')}>
            <Select
              placeholder={t('Select unique column (optional)')}
              allowClear
              options={allColumns.map(c => ({
                label: c.verbose_name || c.column_name,
                value: c.column_name,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
