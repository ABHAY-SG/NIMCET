import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient;

function readEnv(): { url: string; key: string } {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key || url.includes("xyzcompany")) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in your real project URL + key, then restart the dev server."
    );
  }
  return { url, key };
}

// ONE browser client, cookie-backed via @supabase/ssr. Cookies are the only
// session store the Next.js server can read, so every auth action must go
// through this client. (An earlier "Remember me OFF = in-memory session" mode
// produced sessions the server could not see — every student API answered 401
// — and let a stale cookie session from a previous login leak into the next
// one. Both problems disappear with a single store; privacy on shared devices
// is handled by signOutAll() clearing this device's local data.)
let client: Client | null = null;

export function getSupabase(): Client {
  const { url, key } = readEnv();
  if (!client) client = createBrowserClient(url, key);
  return client;
}

// Client that sees the current login. Kept for API compatibility.
export function getAuthClient(): Client {
  return getSupabase();
}

// The ONLY avatar the app ever displays: the user's own uploaded photo.
// Provider pictures (Google/GitHub) are deliberately never used, so a custom
// photo can never be overwritten or shadowed by them on login, refresh, or
// profile load. Empty string = neutral initials placeholder.
export function resolveAvatarUrl(meta: unknown): string {
  const m = (meta ?? {}) as { custom_avatar?: unknown };
  return typeof m.custom_avatar === "string" ? m.custom_avatar : "";
}

// Device-local data written by the student flows. Cleared on sign-out so a
// shared computer never shows one student's local attempts, pending-signup
// email, or redirect target to the next account.
const DEVICE_KEYS = [
  "nimcuet-attempts",
  "nimcuet-pending-email",
  "nimcuet-pending-challenge",
  "nimcuet-pending-at",
  "nimcuet-post-login-redirect",
  "nimcuet-remember-me",
];

export async function signOutAll(): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } catch {}
  try {
    for (const k of DEVICE_KEYS) window.localStorage.removeItem(k);
    window.sessionStorage.removeItem("nimcuet-run-v1");
  } catch {}
}
