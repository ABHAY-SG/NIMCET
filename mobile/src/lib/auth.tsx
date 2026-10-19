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
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string
  ) => Promise<AuthResult & { needsVerification: boolean }>;
  signInWithOAuth: (provider: "google" | "github", mode: "in" | "up") => Promise<AuthResult>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function verified(u: User | null | undefined): boolean {
  return !!(u?.email_confirmed_at || u?.confirmed_at);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const deepLinkBound = useRef(false);

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

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
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
        .auth.getSession()
        .then(({ data }) => setSession(data.session ?? null))
        .catch(() => {});
    });
  }, []);

  const reload = useCallback(async () => {
    if (!supabaseConfigured()) return;
    const { data } = await getSupabase().auth.getSession();
    setSession(data.session ?? null);
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (email, password) => {
    const { error, data } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (!error) setSession(data.session ?? null);
    return { error: error ? error.message : null };
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async (email, password) => {
    // Email confirmation is handled by the website's existing route; ?mobile=1
    // makes it hand control back to the app via the nimcuet:// deep link.
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${API_BASE_URL}/auth/callback?mobile=1` },
    });
    if (error) return { error: error.message, needsVerification: false };
    if (data.session) setSession(data.session);
    // No session on signup == confirmation email required.
    return { error: null, needsVerification: !data.session };
  }, []);

  const signInWithOAuth = useCallback<AuthContextValue["signInWithOAuth"]>(
    async (provider, mode) => {
      // Reuses the website's existing /auth/callback (mode + provider + mobile).
      // Completed in the in-app browser so Supabase auth pages never leave the app.
      const redirectTo = `${API_BASE_URL}/auth/callback?mobile=1&mode=${mode}&provider=${provider}`;
      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: error.message };
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
      signIn,
      signUp,
      signInWithOAuth,
      signOut,
      reload,
    }),
    [ready, session, signIn, signUp, signInWithOAuth, signOut, reload]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
