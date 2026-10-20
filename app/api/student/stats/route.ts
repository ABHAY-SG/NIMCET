import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload, migrationHint } from "@/lib/admin-queries";
import {
  calculateStats,
  type AttemptRow,
} from "@/lib/attempt-stats";

// GET /api/student/stats?tzOffset=-330
//
// Exact aggregate stats for the signed-in student, computed server-side over
// their own rows. The old dashboard computed totals from `.limit(20)`, so any
// student with 21+ attempts saw wrong totals. This route pages through the
// history in bounded chunks (cap below) instead of issuing one unbounded read.
//
// `tzOffset` is the browser's Date#getTimezoneOffset() so day streaks are
// computed in the student's local timezone, not the server's UTC day.

const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;

function clampOffset(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(840, Math.max(-840, Math.trunc(n)));
}

export async function GET(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const tzOffset = clampOffset(new URL(req.url).searchParams.get("tzOffset"));
    const rows: AttemptRow[] = [];

    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await svc
        .from("attempts")
        .select("id,test,score,correct,wrong,skipped,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        const hint = migrationHint(error);
        if (hint && /missing a table/i.test(hint)) {
          // Older deployments may not have the attempts table yet. Report it
          // as a setup state, not a cloud failure the student can retry.
          return NextResponse.json({
            attempts: [],
            stats: null,
            truncated: false,
            missingTable: true,
          });
        }
        throw error;
      }
      const page = (data ?? []) as AttemptRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    return NextResponse.json({
      attempts: rows.slice(0, 20),
      stats: calculateStats(rows, tzOffset),
      truncated: rows.length >= MAX_ROWS,
      missingTable: false,
    });
  } catch (e) {
    const p = errorPayload(e, "Could not load your attempt statistics.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
