import { createBrowserClient } from "@supabase/ssr";

export function getSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key || url.includes("xyzcompany")) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in your real project URL + key, then restart the dev server."
    );
  }
  return createBrowserClient(url, key);
}

export async function saveAttempt(input: {
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
}) {
  try {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { error } = await sb.from("attempts").insert({
      user_id: user.id,
      test: input.test,
      score: input.score,
      correct: input.correct,
      wrong: input.wrong,
      skipped: input.skipped,
    });
    return !error;
  } catch {
    return false;
  }
}
