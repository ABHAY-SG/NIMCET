import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { safeNextPath } from "@/lib/admin";
import {
  OAUTH_INTENT_COOKIE,
  loginErrorPath,
  postLoginPath,
  readOAuthIntentCookie,
  validOAuthProvider,
} from "@/lib/oauth-return";

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;

async function addAccountRegistry(sb: SupabaseServerClient) {
  const { data: { user }, error: userError } = await sb.auth.getUser();
  if (userError || !user) return false;

  const { error } = await sb.from("oauth_account_registry").insert({
    user_id: user.id,
    email: user.email ?? null,
  });

  // A duplicate means this account was already registered.
  return !error || error.code === "23505";
}

function isExpiredOrUsedUp(message: string): boolean {
  return /expir|invalid|consumed|not found|already used/i.test(message);
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  // Supabase can return the OAuth code here with the query string intact, or
  // it can fall back to the Site URL. The proxy recovers the latter; this
  // cookie covers direct callback returns where a deployment lost the
  // mode/provider/next query tags.
  const intent = readOAuthIntentCookie(req.headers.get("cookie"));
  const queryNext = safeNextPath(searchParams.get("next"));
  const requestedNext = queryNext ?? intent?.next ?? null;
  const successNext = postLoginPath(requestedNext);
  const provider = validOAuthProvider(searchParams.get("provider")) ?? intent?.provider ?? null;
  const redirect = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    // The intent has served its purpose; never let it affect a later login.
    res.cookies.set({
      name: OAUTH_INTENT_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
    return res;
  };
  const fail = (reason: string) =>
    redirect(loginErrorPath(reason, { provider, next: requestedNext }));

  // Additive: the mobile app asks for ?mobile=1 so the success page can hand
  // control back to it (nimcuet:// deep link). Never present on website
  // signups, so every URL built below stays byte-identical for the browser.
  const mobile = searchParams.get("mobile") === "1";
  const verifiedPath = (challenge: string | null) => {
    const q = new URLSearchParams();
    if (challenge) q.set("challenge", challenge);
    if (mobile) q.set("mobile", "1");
    const s = q.toString();
    return `/auth/verified${s ? `?${s}` : ""}`;
  };

  try {
    const sb = await getSupabaseServer();

    // Email confirmation + password recovery links carry token_hash + type.
    // Handled FIRST: unlike the PKCE code exchange below, token verification
    // needs no browser-side verifier, so it also works when the email is
    // opened on a different device than the one used for signup.
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    if (tokenHash && type) {
      const { error } = await sb.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "recovery" | "email_change" | "magiclink",
      });
      if (error) {
        const errCode =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : "verify-failed";
        console.error(`[auth] verifyOtp failed code=${errCode}`);
        return fail(isExpiredOrUsedUp(error.message) ? "link-bad" : "verify");
      }

      if (type === "signup") {
        // Email is confirmed at this point. Everything below is bookkeeping
        // and must never turn a confirmed email into a failure screen:
        // a verified user can always log in with their password.
        // Diagnostics: error CODES only (no tokens, emails, or user data).
        try {
          const ok = await addAccountRegistry(sb);
          if (!ok) console.error("[auth] signup registry step failed code=registry-unavailable");
        } catch {
          console.error("[auth] signup registry step failed code=unknown");
        }

        // Mark the rendezvous row so the original waiting tab (possibly on
        // another device, polling as anon) can detect confirmation.
        const challenge = searchParams.get("challenge");
        if (challenge) {
          try {
            const { data: { user: verifiedUser } } = await sb.auth.getUser();
            if (verifiedUser) {
              await sb.from("signup_verification_sessions")
                .update({ verified_at: new Date().toISOString() })
                .eq("challenge_id", challenge)
                .eq("user_id", verifiedUser.id)
                .is("verified_at", null);
            }
          } catch {}
        }

        // verifyOtp established a session in the browser that opened the
        // link. Keep it (never signOut here) and route through the minimal
        // success page, preserving ?challenge= so that page can also
        // mark/broadcast the confirmation for the waiting tab.
        const next = verifiedPath(challenge);
        return redirect(next);
      }

      if (type === "recovery") {
        return redirect("/reset-password");
      }
      return redirect(verifiedPath(null));
    }

    // Provider refusal (e.g. Cancel on GitHub's/Google's screen): no code is
    // issued and no session exists. Send them back to the page they started
    // from — signup stays signup — without signing anything in.
    if (!searchParams.get("code") && /access_denied|user_denied|cancel/i.test(searchParams.get("error") ?? "")) {
      const backMode = (searchParams.get("mode") ?? intent?.mode) === "up" ? "up" : "in";
      const backTo = backMode === "up" ? "/signup" : "/login";
      const q = new URLSearchParams({ error: "cancelled" });
      if (provider) q.set("provider", provider);
      if (requestedNext && requestedNext !== "/dashboard") q.set("next", requestedNext);
      return redirect(`${backTo}?${q.toString()}`);
    }

    // OAuth (Google/GitHub) returns a PKCE code. Email confirmation links
    // also land here with ONLY a code (Supabase consumes the token server
    // side): our signup links always carry ?challenge=, OAuth links carry
    // ?mode= (plus ?provider=) — that tells the flows apart.
    const code = searchParams.get("code");
    if (code) {
      const challenge = searchParams.get("challenge");
      const isEmailFlow = !!challenge;
      const isRecoveryFlow = searchParams.get("flow") === "recovery";
      // `oauth=1` is set by the proxy when it recovers a code that landed on
      // the Site URL. The intent cookie covers direct callback returns that
      // lost their query tags.
      const isOAuthFlow =
        searchParams.has("mode") ||
        searchParams.get("oauth") === "1" ||
        !!intent;
      const ofail = (reason: string) =>
        redirect(loginErrorPath(reason, { provider, next: requestedNext }));
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) {
        console.error(`[auth] code exchange failed flow=${isEmailFlow ? "email" : isRecoveryFlow ? "recovery" : "oauth"}`);
        if (isRecoveryFlow) {
          // Reset links are single-use and short-lived; a failure here means
          // expired/used link or another device. Never sign the user in.
          await sb.auth.signOut().catch(() => {});
          return fail("recovery-bad");
        }
        if (isEmailFlow && /verifier/i.test(error.message)) {
          // The email WAS confirmed server-side (Supabase only mints this
          // code post-verify); only the signup browser holds the PKCE
          // verifier, so no session can be minted here. Mark best-effort so
          // the waiting tab transitions, then show the minimal success page.
          try {
            if (challenge) {
              await sb.from("signup_verification_sessions")
                .update({ verified_at: new Date().toISOString() })
                .eq("challenge_id", challenge)
                .is("verified_at", null)
                .gt("expires_at", new Date().toISOString());
            }
          } catch {}
          const next = verifiedPath(challenge);
          return redirect(next);
        }
        return fail("exchange");
      }

      if (isEmailFlow) {
        // Same browser that signed up: the exchange established a real
        // session and the email is now verified. Keep it (never signOut).
        // Best-effort bookkeeping only — never fail the confirmation itself.
        try {
          const { data: { user: confirmedUser } } = await sb.auth.getUser();
          if (confirmedUser) {
            await sb.from("oauth_account_registry").insert({
              user_id: confirmedUser.id,
              email: confirmedUser.email ?? null,
            });
            if (challenge) {
              await sb.from("signup_verification_sessions")
                .update({ verified_at: new Date().toISOString() })
                .eq("challenge_id", challenge)
                .eq("user_id", confirmedUser.id)
                .is("verified_at", null);
            }
          }
        } catch {}
        const next = verifiedPath(challenge);
        return redirect(next);
      }

      // Password-recovery links carry ?flow=recovery. A working exchange
      // means a live session for that user: send them to set a new password
      // without any registry checks.
      if (isRecoveryFlow) {
        return redirect("/reset-password");
      }

      // Legacy email links (sent before ?challenge= existed) carry neither
      // ?challenge= nor ?mode=. A successful exchange means the email is
      // confirmed and a session was minted — treat as email confirmation.
      if (!isOAuthFlow) {
        try {
          const { data: { user: legacyUser } } = await sb.auth.getUser();
          if (legacyUser?.email_confirmed_at) {
            try {
              await sb.from("oauth_account_registry").insert({
                user_id: legacyUser.id,
                email: legacyUser.email ?? null,
              });
            } catch {}
            return redirect(verifiedPath(null));
          }
        } catch {}
      }

      const mode = (searchParams.get("mode") ?? intent?.mode) === "up" ? "up" : "in";
      if (mode === "up") {
        const { data: { user: upUser }, error: upUserError } = await sb.auth.getUser();
        if (upUserError || !upUser) {
          await sb.auth.signOut();
          return ofail("user");
        }
        // If this identity already registered before, this is NOT a new
        // signup — refuse it instead of silently logging in.
        const { data: existing, error: lookupError } = await sb
          .from("oauth_account_registry")
          .select("user_id")
          .eq("user_id", upUser.id)
          .maybeSingle();
        if (lookupError) {
          await sb.auth.signOut();
          return ofail("registry");
        }
        if (existing) {
          await sb.auth.signOut();
          return ofail("exists");
        }
        if (!(await addAccountRegistry(sb))) {
          await sb.auth.signOut();
          return ofail("registry");
        }
        // New OAuth account with a live session: straight into the app.
        // (The /auth/verified interstitial is only for email confirmation,
        // where another tab may be waiting.)
        return redirect(successNext);
      }

      const { data: { user }, error: userError } = await sb.auth.getUser();
      if (userError || !user) {
        await sb.auth.signOut();
        return ofail("user");
      }

      const { data: registered, error: registryError } = await sb
        .from("oauth_account_registry")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (registryError) {
        await sb.auth.signOut();
        return ofail("registry");
      }
      if (!registered) {
        // OAuth providers can create a Supabase Auth user even during a login attempt.
        // Do not allow that newly-created identity into the app until the user registers.
        await sb.auth.signOut();
        return ofail("no-account");
      }

      // Existing OAuth account logging in with a live session: straight
      // into the app, no email-interstitial pit stop.
      return redirect(successNext);
    }

    return fail("no-code");
  } catch {
    return fail("config");
  }
}
