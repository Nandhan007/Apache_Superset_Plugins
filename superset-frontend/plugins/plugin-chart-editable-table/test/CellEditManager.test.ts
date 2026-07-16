/*
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
import { CellEditManager } from '../src/CellEditManager';

jest.mock('axios');

describe('CellEditManager', () => {
  it('should trim the backendApiUrl when sending modifications', async () => {
    const mockPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: {} });
    const notificationMock = { success: jest.fn(), info: jest.fn(), error: jest.fn() };
    const manager = new CellEditManager(
      [],
      '   https://api.example.com/save   ',
      ['metric1'],
      notificationMock,
      'datasource1',
      ['dim1'],
    );
    // Add a modification
    manager.setValue(0, 'metric1', 10, 20, { dim1: 'val1', metric1: 10 });
    await manager.sendModifications();
    expect(mockPost).toHaveBeenCalledWith('https://api.example.com/save', expect.any(Object));
  });
});
