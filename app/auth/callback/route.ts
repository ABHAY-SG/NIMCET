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

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  try {
    const sb = await getSupabaseServer();

    // OAuth (Google/GitHub) returns a PKCE code. Keep login and registration distinct.
    const code = searchParams.get("code");
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) return fail("exchange");

      const mode = searchParams.get("mode") === "up" ? "up" : "in";
      if (mode === "up") {
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

    // Email confirmation + password recovery links carry token_hash + type.
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    if (tokenHash && type) {
      const { error } = await sb.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "recovery" | "email_change" | "magiclink",
      });
      if (error) return fail("verify");

      if (type === "signup" && !(await addAccountRegistry(sb))) {
        await sb.auth.signOut();
        return fail("registry");
      }

      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", origin));
      }
      return NextResponse.redirect(new URL("/dashboard", origin));
    }

    return fail("no-code");
  } catch {
    return fail("config");
  }
}
