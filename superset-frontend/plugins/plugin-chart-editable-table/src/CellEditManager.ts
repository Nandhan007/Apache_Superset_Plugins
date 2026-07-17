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
import axios from 'axios';
import { notification } from 'antd';
import { DataRecord } from '@superset-ui/core';
import { transformPayload } from './utils/payloadTransform';

export class CellEditManager {
  modifications: Map<string, any>;
  changeListeners: Set<() => void>;
  data: DataRecord[];
  columns: string[];
  backendApiUrl?: string;
  editableMetrics?: string[];
  datasource?: string;
  groupby?: string[];
  notification: any;
  cellEditPayloadMapping?: string;

  constructor(
    data: DataRecord[],
    backendApiUrl?: string,
    editableMetrics?: string[],
    notificationInstance?: any,
    datasource?: string,
    groupby?: string[],
    cellEditPayloadMapping?: string,
  ) {
    this.modifications = new Map();
    this.changeListeners = new Set();
    this.data = data;
    this.backendApiUrl = backendApiUrl;
    this.editableMetrics = editableMetrics;
    this.notification = notificationInstance || notification;
    this.datasource = datasource;
    this.groupby = groupby;
    this.cellEditPayloadMapping = cellEditPayloadMapping;
  }

  addChangeListener = (listener: () => void) => {
    this.changeListeners.add(listener);
  };

  removeChangeListener = (listener: () => void) => {
    this.changeListeners.delete(listener);
  };

  notifyChange = () => {
    this.changeListeners.forEach(listener => listener());
  };

  getCellKey = (rowIndex: number, columnId: string) => {
    return `${rowIndex}::${columnId}`;
  };

  getValue = (rowIndex: number, columnId: string, originalValue: any) => {
    const cellKey = this.getCellKey(rowIndex, columnId);
    const modification = this.modifications.get(cellKey);
    return modification ? modification.current : originalValue;
  };

  setValue = (
    rowIndex: number,
    columnId: string,
    originalValue: any,
    newValue: any,
    record: DataRecord,
  ) => {
    const cellKey = this.getCellKey(rowIndex, columnId);

    if (
      newValue === originalValue ||
      String(newValue) === String(originalValue)
    ) {
      this.modifications.delete(cellKey);
    } else {
      this.modifications.set(cellKey, {
        original: originalValue,
        current: newValue,
        timestamp: Date.now(),
        rowIndex,
        columnId,
        record, // Store the full record for context if needed
      });
    }

    this.notifyChange();
  };

  isModified = (rowIndex: number, columnId: string) => {
    const cellKey = this.getCellKey(rowIndex, columnId);
    return this.modifications.has(cellKey);
  };

  getModifications = () => {
    const payloadData: any[] = [];
    const processedKeys = new Map();

    this.modifications.forEach(mod => {
      const { record, columnId, current } = mod;

      // Separate dimensions and measures
      const dimensions: Record<string, any> = {};
      const measures: Record<string, any> = { [columnId]: current };

      // Filter dimensions: ONLY include columns present in this.groupby
      if (this.groupby && this.groupby.length > 0) {
        this.groupby.forEach(groupCol => {
          if (record.hasOwnProperty(groupCol)) {
            dimensions[groupCol] = record[groupCol];
          }
        });
      } else {
        // Fallback if no groupby provided (though user request implies there should be)
        // We'll mimic previous behavior but ideally we shouldn't hit this if properly configured
        Object.keys(record).forEach(key => {
          if (key !== columnId) {
            dimensions[key] = record[key];
          }
        });
      }

      // Merge changes if multiple metrics changed for same row (dimensions)
      const dimensionsKey = JSON.stringify(dimensions);

      if (processedKeys.has(dimensionsKey)) {
        const existingEntry = processedKeys.get(dimensionsKey);
        existingEntry.measures = { ...existingEntry.measures, ...measures };
      } else {
        const newEntry = { dimensions, measures };
        payloadData.push(newEntry);
        processedKeys.set(dimensionsKey, newEntry);
      }
    });

    return {
      data: payloadData,
      datasource: this.datasource,
    };
  };

  clearModifications = () => {
    this.modifications.clear();
    this.notifyChange();
  };

  getModificationCount = () => {
    return this.modifications.size;
  };

  sendModifications = async () => {
    const trimmedUrl = this.backendApiUrl?.trim();
    if (!trimmedUrl) {
      console.warn('Backend URL is not configured.');
      return;
    }

    if (this.modifications.size === 0) {
      this.notification.info({
        message: 'Info',
        description: 'No modifications to send.',
      });
      return;
    }

    let payload = this.getModifications();
    if (this.cellEditPayloadMapping) {
      try {
        const mapping = JSON.parse(this.cellEditPayloadMapping);
        payload = transformPayload(payload, mapping);
      } catch (e) {
        console.error('Error parsing cellEditPayloadMapping:', e);
      }
    }

    console.log('Sending modifications:', payload);

    try {
      const response = await axios.post(trimmedUrl, payload);
      console.log('Modifications sent:', response.data);
      this.notification.success({
        message: 'Success',
        description: 'Modifications sent successfully.',
      });
      // this.clearModifications();
      return true;
    } catch (error) {
      console.error('Error sending modifications:', error);
      this.notification.error({
        message: 'Error',
        description: `Failed to send modifications: ${error instanceof Error ? error.message : String(error)}`,
      });
      return false;
    }
  };
}
