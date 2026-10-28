export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://api.fengle.in/api/v1';

const TOKEN_KEY = 'fengle_admin_token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked — session lasts until reload */ }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
  /** Route not mounted on the backend yet (the Express 404 fallback). */
  get notBuilt() {
    return this.status === 404 && (this.body as { error?: string } | null)?.error === 'Not found';
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.set(k, v === true ? '1' : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs(query)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.', null);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const msg = (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** Fetches an authenticated GET endpoint as a blob (an <img> tag can't send the Bearer token). */
export async function fetchBlob(path: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.', null);
  }
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* not json */ }
    if (res.status === 401) onUnauthorized();
    throw new ApiError(res.status, (body as { error?: string } | null)?.error || `Request failed (${res.status})`, body);
  }
  return res.blob();
}

/** Downloads a file from an authenticated GET endpoint (e.g. the customer CSV export). */
export async function download(path: string, query: Query, filename: string) {
  const res = await fetch(`${API_URL}${path}${qs(query)}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    let body: unknown = null;
    try { body = await res.json(); msg = (body as { error?: string }).error || msg; } catch { /* not json */ }
    throw new ApiError(res.status, msg, body);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
