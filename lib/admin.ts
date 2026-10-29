// Client-safe helpers + shared row types. NOTE: there is intentionally NO
// client-side admin check here anymore. Authorization lives exclusively on
// the server (lib/admin-server.ts: getAdminSession / requireAdmin) so the
// browser never decides who is an admin — see app/admin/(gated)/layout.tsx.

// Allow only same-origin in-app paths as post-login return targets.
// Rejects absolute URLs, protocol-relative URLs and backslashes so a
// crafted ?next= can never bounce users off-site (open redirect).
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}

// Same tolerant parsing used by the authoritative server allowlist and by the
// proxy's root-entry destination hint. This is pure (no env read), so it is
// safe to import in both places.
export function parseAdminEmails(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase())
    .filter(Boolean);
}

export type QuestionRow = {
  id: string;
  exam: string;
  section: string;
  topic: string;
  difficulty: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
  plus: number;
  minus: number;
  created_at?: string;
};

export type TestRow = {
  id: string;
  exam: string;
  title: string;
  tag: string;
  minutes: number;
  free: boolean;
  published: boolean;
  question_ids: string[];
  created_at?: string;
};

export type AttemptRow = {
  id: string;
  user_id: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
};
