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

/**
 * Recursively extracts human-readable error messages from arbitrary API error structures.
 */
export function extractFromPayload(data: any): string | null {
  if (!data) return null;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return null;

    // Check if it's an HTML error page (e.g., 500 error page from backend server)
    if (trimmed.startsWith('<') && (trimmed.endsWith('>') || trimmed.includes('</'))) {
      const preMatch = trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      const pMatch = trimmed.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const h1Match = trimmed.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const titleMatch = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const extracted = preMatch?.[1] || pMatch?.[1] || h1Match?.[1] || titleMatch?.[1];
      if (extracted) {
        return extracted.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      }
      return null;
    }
    return trimmed;
  }

  if (Array.isArray(data)) {
    const messages = data
      .map(item => extractFromPayload(item))
      .filter((msg): msg is string => Boolean(msg));
    if (messages.length > 0) {
      return messages.join('; ');
    }
    return null;
  }

  if (typeof data === 'object') {
    // 1. Direct standard error string properties
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail.trim();
    }
    if (typeof data.msg === 'string' && data.msg.trim()) {
      return data.msg.trim();
    }
    if (typeof data.description === 'string' && data.description.trim()) {
      return data.description.trim();
    }
    if (typeof data.error_message === 'string' && data.error_message.trim()) {
      return data.error_message.trim();
    }

    // 2. Nested error structures
    if (data.errors) {
      const msg = extractFromPayload(data.errors);
      if (msg) return msg;
    }
    if (data.error && typeof data.error === 'object') {
      const msg = extractFromPayload(data.error);
      if (msg) return msg;
    }
    if (data.detail && (Array.isArray(data.detail) || typeof data.detail === 'object')) {
      const msg = extractFromPayload(data.detail);
      if (msg) return msg;
    }
    if (data.message && typeof data.message === 'object') {
      const msg = extractFromPayload(data.message);
      if (msg) return msg;
    }

    // 3. Validation dictionary mapping fields to errors
    const entries = Object.entries(data);
    const fieldErrors: string[] = [];
    for (const [key, value] of entries) {
      if (['status', 'status_code', 'code', 'stack', 'name'].includes(key)) continue;
      const valMsg = extractFromPayload(value);
      if (valMsg) {
        fieldErrors.push(`${key}: ${valMsg}`);
      }
    }
    if (fieldErrors.length > 0) {
      return fieldErrors.join('; ');
    }
  }

  return null;
}

/**
 * Asynchronously extracts the exact API response error message from any error object
 * (Axios error, SupersetClient error, Fetch Response, or Error instance).
 */
export async function extractApiErrorMessage(
  err: any,
  fallback = 'Operation failed',
): Promise<string> {
  if (!err) return fallback;

  // 1. Fetch Response object (from window.fetch)
  if (
    err instanceof Response ||
    (typeof err === 'object' && typeof err.text === 'function')
  ) {
    try {
      const text = await err.text();
      try {
        const json = JSON.parse(text);
        const msg = extractFromPayload(json);
        if (msg) return msg;
      } catch {
        const msg = extractFromPayload(text);
        if (msg) return msg;
      }
      if (err.statusText) return err.statusText;
    } catch {
      // ignore
    }
  }

  // 2. Axios error: err.response.data
  if (err.response?.data) {
    const msg = extractFromPayload(err.response.data);
    if (msg) return msg;
  }

  // 3. SupersetClient error or object with err.json
  if (err.json) {
    const msg = extractFromPayload(err.json);
    if (msg) return msg;
  }

  // 4. SupersetClient error with err.response (Fetch Response)
  if (err.response && typeof err.response.text === 'function') {
    try {
      const text = await err.response.text();
      try {
        const json = JSON.parse(text);
        const msg = extractFromPayload(json);
        if (msg) return msg;
      } catch {
        const msg = extractFromPayload(text);
        if (msg) return msg;
      }
    } catch {
      // ignore
    }
  }

  // 5. Check if error payload itself has custom fields (e.g. { error: ..., message: ... })
  const directMsg = extractFromPayload(err);
  if (directMsg) {
    // Avoid generic Axios status code errors like "Request failed with status code 500" if statusText exists
    if (
      /Request failed with status code \d+/i.test(directMsg) ||
      /^Network Error$/i.test(directMsg)
    ) {
      if (err.response?.statusText) {
        return err.response.statusText;
      }
    } else {
      return directMsg;
    }
  }

  // 6. Fallback to error message
  if (err.message && typeof err.message === 'string') {
    if (!/Request failed with status code \d+/i.test(err.message)) {
      return err.message;
    }
    if (err.response?.statusText) {
      return err.response.statusText;
    }
  }

  return typeof err === 'string' ? err : fallback;
}
