import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "./env";

// Hosts allowed to be opened inside the in-app browser (system "Custom Tab" /
// SFSafariViewController) — only our own backend. Anything else is rejected so
// a crafted link can never turn the app into an open navigator.
const TRUSTED_HOSTS = (() => {
  try {
    return [new URL(API_BASE_URL).host];
  } catch {
    return [] as string[];
  }
})();

export function isTrustedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    // Supabase auth (OAuth provider screens) lives on *.supabase.co.
    if (u.host.endsWith(".supabase.co")) return true;
    return TRUSTED_HOSTS.includes(u.host);
  } catch {
    return false;
  }
}

/**
 * Subscribe to custom-scheme links the OS hands to the app (nimcuet://…).
 * No-op on the web, where such links never arrive. Returns an unsubscribe fn.
 */
export function onDeepLink(handler: (url: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let removed = false;
  const subscription = App.addListener("appUrlOpen", (event) => {
    if (event.url) handler(event.url);
  });
  return () => {
    if (removed) return;
    removed = true;
    void subscription.then((s) => s.remove());
  };
}
