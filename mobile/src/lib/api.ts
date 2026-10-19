import { getSupabase } from "./supabase";
import { API_BASE_URL } from "./env";

// Thin fetch wrapper for the website's existing student APIs.
//
// The app is served from a WebView-local origin and holds no cookies for the
// API domain, so it authenticates with the Supabase access token it already
// has — exactly the additive bearer path the backend added in lib/admin-server.ts
// (requireUser / requireAdmin). The token is attached fresh on every call; on a
// 401 the session is refreshed once and the request retried.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown>;

async function accessToken(forceRefresh = false): Promise<string | null> {
  const sb = getSupabase();
  if (forceRefresh) {
    const { data } = await sb.auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "omit" });
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    /* non-JSON error body */
  }
  return `Request failed (${res.status}).`;
}

/** Authenticated JSON call against the existing Next.js API. */
export async function apiRequest<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  let token = await accessToken(false);

  let res = await request(normalized, init, token);
  if (res.status === 401) {
    // Expired access token: renew once (the refresh token is the app's own)
    // and retry with the fresh credential.
    token = await accessToken(true);
    res = await request(normalized, init, token);
  }

  if (!res.ok) throw new ApiError(res.status, await readError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

export function apiPost<T = unknown>(path: string, body?: Json): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
