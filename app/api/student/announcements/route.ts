import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";

// GET /api/student/announcements — published notices for signed-in students.
// Drafts are never exposed: the `published` filter runs server-side.
export async function GET() {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc } = ctx;
  try {
    const { data, error } = await svc
      .from("announcements")
      .select("id,title,body,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const p = errorPayload(e, "Load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
