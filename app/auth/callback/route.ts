import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  if (!code) return NextResponse.redirect(`${origin}/login?error=no-code`);
  try {
    const sb = await getSupabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=exchange`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
