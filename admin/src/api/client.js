// Thin fetch wrapper shared by every api/*.js module.
// Reads REACT_APP_API_URL (defaults to the local dev backend), attaches the
// bearer token from localStorage, parses JSON, and throws a typed error
// carrying the server's own `message` so forms can show it directly.

export const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'nstp_admin_token';
const USER_KEY = 'nstp_admin_user';

export class ApiClientError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearSession() {
  setToken(null);
  setStoredUser(null);
}

// AuthContext registers a callback here so a 401 anywhere in the app can log
// the user out and redirect, without every call site needing to know how.
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function buildUrl(path, params) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      qs.append(key, value);
    });
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  return url;
}

async function request(path, { method = 'GET', body, params, isMultipart = false } = {}) {
  const url = buildUrl(path, params);
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let fetchBody;
  if (body !== undefined) {
    if (isMultipart) {
      fetchBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: fetchBody });
  } catch (err) {
    throw new ApiClientError('Unable to connect to server.', 0, null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      if (unauthorizedHandler) unauthorizedHandler();
    }
    const message = (data && data.message) || `Request failed with status ${res.status}.`;
    throw new ApiClientError(message, res.status, data);
  }

  return data;
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts = {}) => request(path, { method: 'PUT', body, ...opts }),
  patch: (path, body, opts = {}) => request(path, { method: 'PATCH', body, ...opts }),
  delete: (path, params) => request(path, { method: 'DELETE', params }),
};

/** Triggers a browser download for a binary/CSV endpoint (auth header required). */
export async function downloadFile(path, params, fallbackName) {
  const url = buildUrl(path, params);
  const token = getToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  if (!res.ok) {
    let message = `Download failed with status ${res.status}.`;
    try {
      const data = await res.json();
      if (data && data.message) message = data.message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    if (res.status === 401) {
      clearSession();
      if (unauthorizedHandler) unauthorizedHandler();
    }
    throw new ApiClientError(message, res.status, null);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = (match && match[1]) || fallbackName || 'download';

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Client-side CSV builder for lists we already have in memory (no export endpoint). */
export function toCsv(rows, columns) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','))
    .join('\r\n');
  return [header, body].join('\r\n');
}

export function downloadCsvString(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
