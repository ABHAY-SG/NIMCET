export function adminEmails(): string[] {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

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
