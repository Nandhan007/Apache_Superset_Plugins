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

function getValueByPath(obj: any, path: string): any {
  if (!path || typeof path !== 'string') return undefined;
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') {
      return acc[part];
    }
    return undefined;
  }, obj);
}

export function transformPayload(input: any, mapping: any): any {
  if (!mapping || typeof mapping !== 'object') return input;

  const transform = (mapNode: any): any => {
    if (typeof mapNode === 'string') {
      return getValueByPath(input, mapNode);
    }
    if (Array.isArray(mapNode)) {
      return mapNode.map(item => transform(item));
    }
    if (mapNode && typeof mapNode === 'object') {
      const result: Record<string, any> = {};
      Object.entries(mapNode).forEach(([key, val]) => {
        const transformedVal = transform(val);
        if (transformedVal !== undefined) {
          result[key] = transformedVal;
        }
      });
      return result;
    }
    return mapNode;
  };

  return transform(mapping);
}
