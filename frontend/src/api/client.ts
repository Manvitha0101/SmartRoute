/**
 * api/client.ts — Central API client for all backend calls.
 */

const BASE = '/api/v1';

const getToken = () => localStorage.getItem('accessToken');

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content (DELETE success) — no body to parse
  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:expired'));
  }

  if (!json.success) {
    throw new ApiError(
      json.error?.code ?? 'UNKNOWN',
      json.error?.message ?? (res.status === 401 ? 'Session expired. Please sign in again.' : 'Something went wrong'),
      res.status
    );
  }

  return json.data as T;
}

// Typed shorthand helpers
export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown)  => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};
