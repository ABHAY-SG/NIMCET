import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient;

function readEnv(): { url: string; key: string } {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key || url.includes("xyzcompany")) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in your real project URL + key, then restart the dev server."
    );
  }
  return { url, key };
}

// Persisted client: cookie storage via @supabase/ssr, readable server-side.
// Memory client: supabase-js with persistSession:false — tab-scoped only,
// used when the user unchecks "Remember me" at login.
let persisted: Client | null = null;
let memory: Client | null = null;
let memoryActive = false;

export function getSupabase(persist = true): Client {
  const { url, key } = readEnv();
  if (persist) {
    if (!persisted) persisted = createBrowserClient(url, key);
    return persisted;
  }
  if (!memory) {
    memory = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return memory;
}

// Client that sees the current login, whichever storage backs it.
export function getAuthClient(): Client {
  if (memoryActive && memory) return memory;
  return getSupabase(true);
}

export function markMemorySessionActive() {
  memoryActive = true;
}

export function forgetMemorySession() {
  memoryActive = false;
}

export async function signOutAll(): Promise<void> {
  try {
    await getSupabase(true).auth.signOut();
  } catch {}
  try {
    if (memory) await memory.auth.signOut();
  } catch {}
  memoryActive = false;
}

export async function saveAttempt(input: {
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
}) {
  try {
    const sb = getAuthClient();
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
