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
import { useState, useEffect, useMemo } from 'react';
import { Select } from 'antd';
import { SupersetClient } from '@superset-ui/core';
import axios from 'axios';

interface ApiEndpointOption {
  label: string;
  value: string;
}

interface ApiEndpointSelectControlProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ApiEndpointSelectControl({
  value,
  onChange,
  placeholder = 'Select API Endpoint',
  disabled = false,
}: ApiEndpointSelectControlProps) {
  const [options, setOptions] = useState<ApiEndpointOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchRoutes = async () => {
      setLoading(true);
      try {
        let data: any[] = [];
        try {
          const res = await SupersetClient.get({
            endpoint: '/api/openl/MFP/MFP/getApi_route',
          });
          const rawJson = res.json as any;
          if (Array.isArray(rawJson)) {
            data = rawJson;
          } else if (rawJson && Array.isArray(rawJson.data)) {
            data = rawJson.data;
          } else if (rawJson && typeof rawJson === 'object') {
            data = [rawJson];
          }
        } catch (_err) {
          const res = await axios.get('/api/openl/MFP/MFP/getApi_route');
          const rawData = res.data;
          data = Array.isArray(rawData) ? rawData : (rawData?.data || []);
        }

        if (isMounted && Array.isArray(data)) {
          const opts: ApiEndpointOption[] = data
            .map((item: any) => {
              if (typeof item === 'string') {
                return { label: item, value: item };
              }
              const route =
                item.Routes ||
                item.routes ||
                item.Route ||
                item.route ||
                item.endpoint ||
                item.path ||
                item.url;
              const name =
                item.Name ||
                item.name ||
                item.label ||
                route;
              if (!route && !name) return null;
              return {
                label: String(name || route),
                value: String(route || name),
              };
            })
            .filter(Boolean) as ApiEndpointOption[];
          setOptions(opts);
        }
      } catch (err) {
        console.warn(
          'Failed to fetch API routes from /api/openl/MFP/MFP/getApi_route:',
          err,
        );
        if (isMounted) {
          setOptions([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRoutes();
    return () => {
      isMounted = false;
    };
  }, []);

  const mergedOptions = useMemo(() => {
    if (value && !options.some(opt => opt.value === value)) {
      return [{ label: value, value }, ...options];
    }
    return options;
  }, [options, value]);

  return (
    <Select
      value={value || undefined}
      onChange={(val: any) => {
        console.log('[ApiEndpointSelectControl DEBUG] Selected value:', val);
        if (onChange) {
          onChange(val);
        }
      }}
      options={mergedOptions}
      loading={loading}
      disabled={disabled}
      placeholder={placeholder}
      allowClear
      showSearch
      filterOption={(input, option) =>
        Boolean(
          (option?.label as string)
            ?.toLowerCase()
            .includes(input.toLowerCase()) ||
            (option?.value as string)
              ?.toLowerCase()
              .includes(input.toLowerCase()),
        )
      }
      style={{ width: '100%' }}
    />
  );
}
