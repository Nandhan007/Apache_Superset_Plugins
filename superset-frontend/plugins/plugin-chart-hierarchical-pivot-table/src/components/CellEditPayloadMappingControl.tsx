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
import { useState, useEffect } from 'react';
import AceEditor from 'react-ace';
import { Alert } from 'antd';
import { t } from '@apache-superset/core/translation';

// Ace editor imports
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-github';

interface CellEditPayloadMappingControlProps {
  value?: string;
  onChange: (value: string) => void;
}

export default function CellEditPayloadMappingControl({
  value = '',
  onChange,
}: CellEditPayloadMappingControlProps) {
  const [textValue, setTextValue] = useState<string>(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTextValue(value || '');
  }, [value]);

  const handleChange = (newVal: string) => {
    setTextValue(newVal);
    if (!newVal) {
      setError(null);
      onChange('');
      return;
    }
    try {
      JSON.parse(newVal);
      setError(null);
      onChange(newVal);
    } catch (err: any) {
      setError(err.message);
      onChange(newVal);
    }
  };

  return (
    <div>
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <AceEditor
          mode="json"
          theme="github"
          name="cell-edit-payload-mapping-editor"
          width="100%"
          height="200px"
          fontSize={14}
          showPrintMargin={false}
          focus={false}
          editorProps={{ $blockScrolling: true }}
          wrapEnabled
          highlightActiveLine
          value={textValue}
          onChange={handleChange}
          tabSize={2}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: true,
            showGutter: true,
            useWorker: false,
          }}
        />
      </div>
      {error && (
        <Alert
          type="error"
          message={t('Invalid JSON format')}
          description={error}
          showIcon
          style={{ marginTop: 8 }}
        />
      )}
    </div>
  );
}
