import { safeNextPath } from "@/lib/admin";

// OAuth round-trip bookkeeping shared by the browser and the server.
//
// Supabase normally returns the PKCE code to /auth/callback, but the code can
// also land on the project's Site URL (for example when a preview deployment
// or a provider callback loses the redirect target). In that case
// @supabase/ssr exchanges the code client-side, updates the navbar, and leaves
// the visitor on the marketing page. These helpers let the proxy recover the
// code before the page renders and let the browser finish the navigation if a
// code was already consumed.
export const OAUTH_INTENT_COOKIE = "nimcuet-oauth-intent";
export const OAUTH_PENDING_KEY = "nimcuet-oauth-pending";
export const OAUTH_INTENT_TTL_MS = 10 * 60 * 1000;
export const POST_LOGIN_REDIRECT_TTL_MS = 15 * 60 * 1000;

export type OAuthMode = "in" | "up";
export type OAuthProvider = "google" | "github";

export type OAuthIntent = {
  mode: OAuthMode;
  provider: OAuthProvider | null;
  next: string | null;
  at: number;
};

const LANDING_PATHS = ["/", "/login", "/signup", "/login-choice"];
const AUTH_ENTRY_PATHS = ["/login", "/signup", "/login-choice", "/auth", "/reset-password"];
const APP_AUTH_ERRORS = new Set([
  "cancelled",
  "no-account",
  "exists",
  "link-bad",
  "recovery-bad",
  "exchange",
  "registry",
  "user",
  "oauth",
  "config",
  "no-code",
]);

/** Error codes the app itself puts on /login or /signup for AuthForm to render. */
export function isAppAuthError(value: string | null | undefined): boolean {
  return !!value && APP_AUTH_ERRORS.has(value);
}

export function validOAuthProvider(value: unknown): OAuthProvider | null {
  return value === "google" || value === "github" ? value : null;
}

export function encodeOAuthIntent(intent: Omit<OAuthIntent, "at"> & { at?: number }): string {
  const at = intent.at ?? Date.now();
  const q = new URLSearchParams({
    v: "1",
    mode: intent.mode,
    at: String(at),
  });
  if (intent.provider) q.set("provider", intent.provider);
  if (intent.next) q.set("next", intent.next);
  return encodeURIComponent(q.toString());
}

export function decodeOAuthIntent(value: string | null | undefined, now = Date.now()): OAuthIntent | null {
  if (!value) return null;
  let raw = value;
  try {
    raw = decodeURIComponent(value);
  } catch {
    return null;
  }
  const q = new URLSearchParams(raw);
  if (q.get("v") !== "1") return null;
  const at = Number(q.get("at"));
  if (!Number.isFinite(at) || at <= 0) return null;
  const age = now - at;
  // A little clock skew is tolerated; stale intents are ignored so an
  // abandoned login can never redirect a much later visit.
  if (age < -60_000 || age > OAUTH_INTENT_TTL_MS) return null;
  const mode = q.get("mode");
  if (mode !== "in" && mode !== "up") return null;
  return {
    mode,
    provider: validOAuthProvider(q.get("provider")),
    next: safeNextPath(q.get("next")),
    at,
  };
}

export function readOAuthIntentCookie(
  cookieHeader: string | null | undefined,
  now = Date.now(),
): OAuthIntent | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== OAUTH_INTENT_COOKIE) continue;
    return decodeOAuthIntent(part.slice(i + 1).trim(), now);
  }
  return null;
}

export function oauthIntentCookie(
  intent: Omit<OAuthIntent, "at"> & { at?: number },
  options?: { secure?: boolean },
): string {
  const maxAge = Math.floor(OAUTH_INTENT_TTL_MS / 1000);
  const secure = options?.secure ? "; Secure" : "";
  return `${OAUTH_INTENT_COOKIE}=${encodeOAuthIntent(intent)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearOAuthIntentCookie(options?: { secure?: boolean }): string {
  const secure = options?.secure ? "; Secure" : "";
  return `${OAUTH_INTENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function parseStoredRedirect(stored: string | null | undefined, now = Date.now()): string | null {
  if (!stored) return null;
  const sep = stored.indexOf(":");
  if (sep <= 0) return null;
  const at = Number(stored.slice(0, sep));
  if (!Number.isFinite(at) || at <= 0) return null;
  const age = now - at;
  if (age < -60_000 || age > POST_LOGIN_REDIRECT_TTL_MS) return null;
  return safeNextPath(stored.slice(sep + 1));
}

/**
 * The user's validated post-login target. Auth entry pages are deliberately
 * rejected: sending a freshly signed-in user back to /login is a loop.
 */
export function postLoginPath(value: string | null | undefined): string {
  const safe = safeNextPath(value);
  if (!safe) return "/dashboard";
  if (AUTH_ENTRY_PATHS.some((p) => safe === p || safe.startsWith(`${p}/`))) return "/dashboard";
  return safe;
}

export function loginErrorPath(
  reason: string,
  input?: { provider?: string | null; next?: string | null },
): string {
  const q = new URLSearchParams({ error: reason });
  const provider = validOAuthProvider(input?.provider);
  if (provider) q.set("provider", provider);
  const next = safeNextPath(input?.next);
  if (next && next !== "/dashboard") q.set("next", next);
  return `/login?${q.toString()}`;
}

export function oauthErrorLoginPath(input: {
  error?: string | null;
  provider?: string | null;
  next?: string | null;
}): string {
  const reason = /access_denied|user_denied|cancel/i.test(input.error ?? "") ? "cancelled" : "oauth";
  return loginErrorPath(reason, input);
}

function hashParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.replace(/^#/, ""));
}

/** True when a URL carries the signature of an OAuth/provider return. */
export function hasOAuthReturnEvidence(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    if (u.searchParams.has("code") || u.searchParams.has("error")) return true;
    const hash = hashParams(u);
    return hash.has("access_token") || hash.has("refresh_token") || hash.has("error") || hash.has("error_description");
  } catch {
    return false;
  }
}

export function readOAuthReturn(value: string | null | undefined): {
  error: string | null;
  provider: OAuthProvider | null;
  next: string | null;
} {
  try {
    const u = new URL(value ?? "");
    const hash = hashParams(u);
    return {
      error: u.searchParams.get("error") ?? hash.get("error") ?? hash.get("error_description"),
      provider: validOAuthProvider(u.searchParams.get("provider")),
      next: safeNextPath(u.searchParams.get("next")),
    };
  } catch {
    return { error: null, provider: null, next: null };
  }
}

/**
 * If Supabase returned a code/error to a public page instead of the callback,
 * return the callback URL the proxy should use.
 *
 * Recovery requires an OAuth tag: the client-set intent cookie, or
 * mode/provider/oauth query tags. A bare code is deliberately not treated as
 * OAuth — an email-confirmation or recovery link that lost its own query string
 * must not be misrouted into the OAuth registry checks. The browser component
 * covers a bare code only while this tab still has an OAuth pending marker.
 */
export function oauthRecoveryPath(
  pathname: string,
  search: URLSearchParams,
  intent: OAuthIntent | null,
): string | null {
  if (!LANDING_PATHS.includes(pathname)) return null;
  const hasCode = search.has("code");
  const hasError = search.has("error");
  if (!hasCode && !hasError) return null;

  const isEmailOrRecovery = search.has("challenge") || search.get("flow") === "recovery";
  const tagged =
    !!intent ||
    search.has("mode") ||
    search.has("provider") ||
    search.get("oauth") === "1" ||
    isEmailOrRecovery;
  if (!tagged) return null;

  const q = new URLSearchParams(search);
  // Tell the callback this code is OAuth even if Supabase dropped mode/provider.
  // Email/recovery links keep their own tags; the callback handles those first.
  if (hasCode && !isEmailOrRecovery) q.set("oauth", "1");
  if (!q.has("mode") && intent) q.set("mode", intent.mode);
  if (!q.has("provider") && intent?.provider) q.set("provider", intent.provider);
  if (!q.has("next") && intent?.next) q.set("next", intent.next);
  return `/auth/callback?${q.toString()}`;
}

/** OAuth-specific URL tags (never emitted by email/recovery links). */
export function hasOAuthQueryTags(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return (
      u.searchParams.has("mode") ||
      u.searchParams.has("provider") ||
      u.searchParams.get("oauth") === "1"
    );
  } catch {
    return false;
  }
}
