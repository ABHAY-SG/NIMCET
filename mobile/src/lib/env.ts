// Central, typed access to the app's public configuration.
//
// Only VITE_* variables reach the client bundle. The Supabase anon/publishable
// key is a public, RLS-bound credential (the same one the website ships), so it
// is safe here; the SERVICE-ROLE key must never exist in this project.

const env = import.meta.env;

/** Existing Next.js backend (Vercel). Trailing slashes trimmed for joining. */
export const API_BASE_URL = (
  (env.VITE_API_BASE_URL as string | undefined) || "https://nimcet-eta.vercel.app"
).replace(/\/+$/, "");

export const SUPABASE_URL = ((env.VITE_SUPABASE_URL as string | undefined) || "").trim();
export const SUPABASE_ANON_KEY = ((env.VITE_SUPABASE_ANON_KEY as string | undefined) || "").trim();

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Custom URL scheme handled by the native app (Android intent filter). */
export const APP_SCHEME = "nimcuet";
/** Deep link the website fires after email verification when ?mobile=1. */
export const VERIFIED_DEEPLINK = "nimcuet://auth/verified";
