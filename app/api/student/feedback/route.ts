import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";

const CATEGORIES = ["general", "bug", "content", "test", "other"];

// POST /api/student/feedback — students write into the admin feedback inbox.
// Session-verified (the user id comes from the session, never the client),
// validated, and lightly rate-limited (one message per minute per account).
export async function POST(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const category =
      typeof body.category === "string" && CATEGORIES.includes(body.category) ? body.category : "general";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (subject.length < 3 || subject.length > 140) {
      return NextResponse.json({ error: "Subject must be 3–140 characters." }, { status: 400 });
    }
    if (message.length < 10 || message.length > 4000) {
      return NextResponse.json({ error: "Message must be 10–4000 characters." }, { status: 400 });
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count, error: cErr } = await svc
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "You just sent a message — please wait a minute before sending another." },
        { status: 429 }
      );
    }

    const { error } = await svc.from("feedback").insert({
      user_id: user.id,
      email: user.email,
      category,
      subject,
      message,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const p = errorPayload(e, "Send failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
