import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_CONFIGURED } from "./env";

// ONE Supabase client for the app, backed by the native WebView's localStorage
// (Capacitor persists it across launches). Sessions are read straight from
// Supabase Auth; the resulting access token is what authorises the website's
// /api/student/* routes (see lib/api.ts — Authorization: Bearer <token>).
//
// `detectSessionInUrl: false`: the app receives its callbacks through the
// nimcuet:// deep link, not a browser URL fragment, so Supabase must never try
// to parse its own location.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!SUPABASE_CONFIGURED) {
    throw new Error(
      "Supabase is not configured. Copy mobile/.env.example to mobile/.env.local, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart."
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }
  return client;
}

/** Exposed for callers that must not throw when config is missing (e.g. boot). */
export function supabaseConfigured(): boolean {
  return SUPABASE_CONFIGURED;
}

/** A throwaway client used only to hand a session off (never persisted). */
export function ephemeralClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
