import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

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
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

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
        const { error: registryError } = await (async () => {
          try {
            const ok = await addAccountRegistry(sb);
            return { error: ok ? null : new Error("registry-unavailable") };
          } catch (e) {
            return { error: e };
          }
        })();
        if (registryError) {
          const code =
            registryError instanceof Error
              ? registryError.message
              : typeof registryError === "object" && registryError !== null && "code" in registryError
                ? String((registryError as { code: unknown }).code)
                : "unknown";
          console.error(`[auth] signup registry step failed code=${code}`);
        }

        // The email link may be opened on a different device. Mark only the
        // matching user's high-entropy challenge as verified, then remove the
        // session from the device that opened the email link.
        const { data: { user: verifiedUser } } = await sb.auth.getUser();
        const metadataChallenge = verifiedUser?.user_metadata?.signup_challenge;
        const challengeId =
          searchParams.get("challenge") ??
          (typeof metadataChallenge === "string" ? metadataChallenge : null);

        if (challengeId) {
          const { data: challenge, error: challengeError } = await sb
            .from("signup_verification_sessions")
            .update({ verified_at: new Date().toISOString() })
            .eq("challenge_id", challengeId)
            .eq("user_id", verifiedUser?.id ?? "")
            .is("verified_at", null)
            .gt("expires_at", new Date().toISOString())
            .select("challenge_id")
            .maybeSingle();

          if (challengeError || !challenge) {
            await sb.auth.signOut();
            return NextResponse.redirect(new URL("/auth/verified?error=challenge", origin));
          }
        }

        await sb.auth.signOut();
        return NextResponse.redirect(new URL("/auth/verified", origin));
      }

      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", origin));
      }
      return NextResponse.redirect(new URL("/auth/verified", origin));
    }

    // OAuth (Google/GitHub) returns a PKCE code. Email confirmation links
    // also land here with ONLY a code (Supabase consumes the token server
    // side): our signup links always carry ?challenge=, OAuth links carry
    // ?mode= — that tells the two flows apart.
    const code = searchParams.get("code");
    if (code) {
      const isEmailFlow = searchParams.has("challenge");
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) {
        console.error(`[auth] code exchange failed flow=${isEmailFlow ? "email" : "oauth"}`);
        if (isEmailFlow && /verifier/i.test(error.message)) {
          // The email WAS confirmed server-side (Supabase only mints this
          // code post-verify); only the signup browser holds the PKCE
          // verifier, so no session can be minted here (e.g. confirmed on
          // another device). Mark the challenge best-effort so the original
          // tab can auto-sign-in, then send them to log in — the email is
          // confirmed.
          try {
            const cid = searchParams.get("challenge");
            if (cid) {
              await sb.from("signup_verification_sessions")
                .update({ verified_at: new Date().toISOString() })
                .eq("challenge_id", cid)
                .is("verified_at", null)
                .gt("expires_at", new Date().toISOString());
            }
          } catch {}
          return NextResponse.redirect(new URL("/login?verified=1", origin));
        }
        return fail("exchange");
      }

      if (isEmailFlow) {
        // Same browser that signed up: session established, email verified.
        // Best-effort bookkeeping only — never fail the confirmation itself.
        try {
          const { data: { user: confirmedUser } } = await sb.auth.getUser();
          if (confirmedUser) {
            await sb.from("oauth_account_registry").insert({
              user_id: confirmedUser.id,
              email: confirmedUser.email ?? null,
            });
            const cid = searchParams.get("challenge");
            if (cid) {
              await sb.from("signup_verification_sessions")
                .update({ verified_at: new Date().toISOString() })
                .eq("challenge_id", cid)
                .eq("user_id", confirmedUser.id)
                .is("verified_at", null);
            }
          }
        } catch {}
        return NextResponse.redirect(new URL("/dashboard", origin));
      }

      const mode = searchParams.get("mode") === "up" ? "up" : "in";
      if (mode === "up") {
        const { data: { user: upUser }, error: upUserError } = await sb.auth.getUser();
        if (upUserError || !upUser) {
          await sb.auth.signOut();
          return fail("user");
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
          return fail("registry");
        }
        if (existing) {
          await sb.auth.signOut();
          return fail("exists");
        }
        if (!(await addAccountRegistry(sb))) {
          await sb.auth.signOut();
          return fail("registry");
        }
        return NextResponse.redirect(new URL("/dashboard", origin));
      }

      const { data: { user }, error: userError } = await sb.auth.getUser();
      if (userError || !user) {
        await sb.auth.signOut();
        return fail("user");
      }

      const { data: registered, error: registryError } = await sb
        .from("oauth_account_registry")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (registryError) {
        await sb.auth.signOut();
        return fail("registry");
      }
      if (!registered) {
        // OAuth providers can create a Supabase Auth user even during a login attempt.
        // Do not allow that newly-created identity into the app until the user registers.
        await sb.auth.signOut();
        return fail("no-account");
      }

      return NextResponse.redirect(new URL("/dashboard", origin));
    }

    return fail("no-code");
  } catch {
    return fail("config");
  }
}
