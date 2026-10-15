import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=no-code", origin));

  try {
    const sb = await getSupabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=exchange", origin));
    }
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }

  // After confirming their email, send users to the login page with a success notice.
  return NextResponse.redirect(new URL("/login?verified=1", origin));
}
