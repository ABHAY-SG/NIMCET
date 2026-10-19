import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabase, supabaseConfigured } from "./supabase";
import { API_BASE_URL } from "./env";
import { onDeepLink } from "./deeplink";
import { onUnauthorized } from "./session";

export type AuthResult = { error: string | null };

export type AuthContextValue = {
  /** False until the persisted session has been restored on boot. */
  ready: boolean;
  /** True when VITE_SUPABASE_* are present; screens show a config notice otherwise. */
  configured: boolean;
  session: Session | null;
  user: User | null;
  /** Mirrors the server rule: requireUser rejects unverified email sessions. */
  emailVerified: boolean;
  /** One-shot message to show on the login screen (e.g. session expired). */
  notice: string | null;
  clearNotice: () => void;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string
  ) => Promise<AuthResult & { needsVerification: boolean }>;
  resendVerification: (email: string) => Promise<AuthResult>;
  signInWithOAuth: (provider: "google" | "github", mode: "in" | "up") => Promise<AuthResult>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function verified(u: User | null | undefined): boolean {
  return !!(u?.email_confirmed_at || u?.confirmed_at);
}

/**
 * Turn Supabase's raw auth errors into something a student can act on. Unknown
 * messages are passed through unchanged (never hidden behind a generic string).
 */
export function describeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed"))
    return "Verify your email first — open the confirmation link we sent, then log in.";
  if (m.includes("user already registered"))
    return "That email is already registered. Try logging in instead.";
  if (m.includes("password should be at least"))
    return "Your password is too short. Use at least 8 characters.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "That email address doesn't look valid.";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deepLinkBound = useRef(false);
  // Distinguishes an intentional logout (no message) from an expired session
  // (explain the redirect). Both surface as SIGNED_OUT with no session.
  const manualSignOut = useRef(false);

  const clearNotice = useCallback(() => setNotice(null), []);

  // Boot: restore the persisted session, then track every auth change.
  useEffect(() => {
    if (!supabaseConfigured()) {
      setReady(true);
      return;
    }
    const sb = getSupabase();
    let active = true;

    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });

    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      // A refresh that fails surfaces as SIGNED_OUT with no session: that is a
      // genuine expiry, so tell the user why they landed back on login. An
      // intentional logout sets manualSignOut first and stays silent.
      if (event === "SIGNED_OUT" && !next) {
        if (manualSignOut.current) manualSignOut.current = false;
        else setNotice((prev) => prev ?? "Your session has expired. Please log in again.");
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // A protected API call came back 401 even after a refresh (see lib/api.ts):
  // drop the dead session and explain the redirect.
  useEffect(() => {
    return onUnauthorized(() => {
      setNotice("Your session has expired. Please log in again.");
      setSession(null);
      if (supabaseConfigured()) {
        void getSupabase()
          .auth.signOut()
          .catch(() => {});
      }
    });
  }, []);

  // nimcuet://auth/verified — the website's hand-off after email confirmation.
  // It carries no secret, so we only close the in-app browser (if open) and
  // re-read the session; verification itself is confirmed against Supabase.
  useEffect(() => {
    if (deepLinkBound.current || !supabaseConfigured()) return;
    deepLinkBound.current = true;
    return onDeepLink((url) => {
      if (!url.startsWith("nimcuet://auth/verified")) return;
      if (Capacitor.isNativePlatform()) {
        void Browser.close().catch(() => {});
      }
      void getSupabase()
        .auth.refreshSession()
        .catch(() => {})
        .finally(() =>
          getSupabase()
            .auth.getSession()
            .then(({ data }) => setSession(data.session ?? null))
            .catch(() => {})
        );
    });
  }, []);

  const reload = useCallback(async () => {
    if (!supabaseConfigured()) return;
    const { data } = await getSupabase().auth.getSession();
    setSession(data.session ?? null);
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (email, password) => {
    setNotice(null);
    const { error, data } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (!error) setSession(data.session ?? null);
    return { error: error ? describeAuthError(error.message) : null };
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async (email, password) => {
    // Email confirmation is handled by the website's existing route; ?mobile=1
    // makes it hand control back to the app via the nimcuet:// deep link.
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${API_BASE_URL}/auth/callback?mobile=1` },
    });
    if (error) return { error: describeAuthError(error.message), needsVerification: false };
    if (data.session) setSession(data.session);
    // No session on signup == confirmation email required.
    return { error: null, needsVerification: !data.session };
  }, []);

  const resendVerification = useCallback<AuthContextValue["resendVerification"]>(
    async (email) => {
      const { error } = await getSupabase().auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${API_BASE_URL}/auth/callback?mobile=1` },
      });
      return { error: error ? describeAuthError(error.message) : null };
    },
    []
  );

  const signInWithOAuth = useCallback<AuthContextValue["signInWithOAuth"]>(
    async (provider, mode) => {
      // NOTE: not reachable from the UI yet — the on-device PKCE/deep-link
      // hand-off is not implemented, so the buttons stay disabled. Kept here as
      // the single integration point for when it is.
      const redirectTo = `${API_BASE_URL}/auth/callback?mobile=1&mode=${mode}&provider=${provider}`;
      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: describeAuthError(error.message) };
      if (!data?.url) return { error: "Could not start the sign-in flow." };
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: data.url, windowName: "_system" });
      } else {
        window.location.assign(data.url);
      }
      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    manualSignOut.current = true;
    setNotice(null);
    await getSupabase().auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: supabaseConfigured(),
      session,
      user: session?.user ?? null,
      emailVerified: verified(session?.user),
      notice,
      clearNotice,
      signIn,
      signUp,
      resendVerification,
      signInWithOAuth,
      signOut,
      reload,
    }),
    [
      ready,
      session,
      notice,
      clearNotice,
      signIn,
      signUp,
      resendVerification,
      signInWithOAuth,
      signOut,
      reload,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
