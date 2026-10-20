"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  OAUTH_PENDING_KEY,
  OAUTH_INTENT_TTL_MS,
  hasOAuthQueryTags,
  hasOAuthReturnEvidence,
  isAppAuthError,
  oauthErrorLoginPath,
  parseStoredRedirect,
  postLoginPath,
  readOAuthReturn,
} from "@/lib/oauth-return";

const LANDING_PATHS = ["/", "/login", "/signup", "/login-choice"];
const SESSION_WAIT_MS = 10_000;

function initialDocumentUrl(): string {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.name) return nav.name;
  } catch {}
  return window.location.href;
}

function pendingAt(): number | null {
  try {
    const raw = window.sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return null;
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0) return null;
    if (Date.now() - at > OAUTH_INTENT_TTL_MS) {
      window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
      return null;
    }
    return at;
  } catch {
    return null;
  }
}

function clearLocal(): void {
  try {
    window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
    window.localStorage.removeItem("nimcuet-post-login-redirect");
  } catch {}
}

/**
 * Last-resort OAuth completion for the browser.
 *
 * The proxy recovers a code delivered to `/`, `/login`, `/signup` or
 * `/login-choice` before the page renders. This component covers the remaining
 * race: @supabase/ssr may have already consumed the code and cleaned the URL,
 * leaving only an updated auth cookie and navbar. In that case we wait for the
 * session and finish the navigation the callback would normally have done.
 */
export default function OAuthCompletion() {
  const router = useRouter();

  useEffect(() => {
    const path = window.location.pathname;
    if (!LANDING_PATHS.includes(path)) {
      // Once the user reaches a gated area the round-trip is finished.
      if (path.startsWith("/dashboard") || path.startsWith("/admin")) clearLocal();
      return;
    }

    const initial = initialDocumentUrl();
    const current = window.location.href;
    const pending = pendingAt();
    // A bare code/error is not enough: email confirmation and recovery links
    // can land here too. Only this tab's in-flight OAuth marker or explicit
    // OAuth query tags opt the page into completion.
    const oauthTagged =
      pending !== null || hasOAuthQueryTags(current) || hasOAuthQueryTags(initial);
    if (!oauthTagged) return;
    const evidence = hasOAuthReturnEvidence(initial) || hasOAuthReturnEvidence(current);

    const currentReturn = readOAuthReturn(current);
    const initialReturn = readOAuthReturn(initial);
    const provider = currentReturn.provider ?? initialReturn.provider;
    const queryNext = currentReturn.next ?? initialReturn.next;

    const authError = currentReturn.error ?? initialReturn.error;
    if (authError) {
      // The callback already translated its own failures into AuthForm
      // messages (no-account, exists, exchange, ...). Clear the marker but do
      // not rewrite the URL and lose the specific explanation.
      if ((path === "/login" || path === "/signup") && isAppAuthError(authError)) {
        clearLocal();
        return;
      }
      clearLocal();
      router.replace(
        oauthErrorLoginPath({
          error: authError,
          provider,
          next: queryNext,
        }),
      );
      return;
    }

    let stopped = false;
    let finished = false;
    let subscription: { unsubscribe: () => void } | null = null;
    let poll = 0;

    const stop = () => {
      stopped = true;
      if (poll) window.clearInterval(poll);
      try {
        subscription?.unsubscribe();
      } catch {}
    };

    const finish = () => {
      if (stopped || finished) return;
      finished = true;
      stop();
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem("nimcuet-post-login-redirect");
      } catch {}
      const destination = postLoginPath(parseStoredRedirect(stored) ?? queryNext);
      clearLocal();
      router.replace(destination);
    };

    const check = async () => {
      if (stopped || finished) return;
      try {
        const { data } = await getSupabase().auth.getSession();
        if (data.session) finish();
      } catch {}
    };

    try {
      const sb = getSupabase();
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
          finish();
        }
      });
      subscription = data.subscription;
    } catch {}

    void check();
    const started = Date.now();
    poll = window.setInterval(() => {
      if (stopped || finished) return;
      if (Date.now() - started > SESSION_WAIT_MS) {
        stop();
        clearLocal();
        // Only a real OAuth return is sent to the login screen. A stale
        // in-tab marker on its own must never bounce a normal visit.
        if (evidence) {
          router.replace(oauthErrorLoginPath({ error: "oauth", provider, next: queryNext }));
        }
        return;
      }
      void check();
    }, 350);

    return stop;
  }, [router]);

  return null;
}
