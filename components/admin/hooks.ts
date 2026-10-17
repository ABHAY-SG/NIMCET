"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyTheme, readTheme, type ThemeId } from "@/lib/theme";

// Shared client hooks for the admin panel.

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export type AdminData<T> = {
  data: T | null;
  error: string;
  loading: boolean;
  reload: () => void;
};

// Fetches a same-origin admin API endpoint with loading/error state.
// Re-fetches whenever `url` changes (callers compose urls from filters).
export function useAdminData<T>(url: string | null): AdminData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!url);
  const [tick, setTick] = useState(0);
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    // A new query (different url) must not render the previous query's rows
    // while its response is in flight. Manual reloads keep the old data so
    // the table doesn't flash empty.
    if (prevUrl.current !== url) {
      prevUrl.current = url;
      setData(null);
    }
    let alive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const r = await fetch(url, { credentials: "same-origin" });
        const j = (await r.json()) as T & { error?: string };
        if (!r.ok) throw new Error(j.error || `Request failed (${r.status}).`);
        if (alive) setData(j);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Load failed.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

// Theme state synced with the global theme system (lib/theme.ts).
export function useAdminTheme(): { theme: ThemeId; setTheme: (t: ThemeId) => void } {
  const [theme, setThemeState] = useState<ThemeId>("light");

  useEffect(() => {
    setThemeState(readTheme());
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setThemeState(typeof d === "string" ? (d as ThemeId) : readTheme());
    };
    window.addEventListener("mcamock-theme", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("mcamock-theme", on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const setTheme = useCallback((t: ThemeId) => setThemeState((prev) => {
    if (prev !== t) applyTheme(t);
    return t;
  }), []);

  return { theme, setTheme };
}

const PAGE_SIZE_KEY = "admin-page-size";

export function usePageSize(defaultSize = 20): number {
  const [size, setSize] = useState(defaultSize);
  useEffect(() => {
    const read = () => {
      try {
        const v = Number(localStorage.getItem(PAGE_SIZE_KEY));
        if (Number.isFinite(v) && v >= 5 && v <= 100) setSize(v);
      } catch {}
    };
    read();
    window.addEventListener("admin-page-size", read);
    return () => window.removeEventListener("admin-page-size", read);
  }, []);
  return size;
}

export function setStoredPageSize(n: number) {
  try {
    localStorage.setItem(PAGE_SIZE_KEY, String(n));
    window.dispatchEvent(new Event("admin-page-size"));
  } catch {}
}

// Small helper: fetch JSON with method/body, throwing server-provided errors.
export async function adminMutate<T = { ok: boolean }>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const r = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status}).`);
  return j;
}

// Downloads a URL response as a file (used for CSV exports).
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `Export failed (${r.status}).`);
  }
  const blob = await r.blob();
  const disp = r.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(disp);
  const name = match?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function useInterval(cb: () => void, ms: number | null) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
