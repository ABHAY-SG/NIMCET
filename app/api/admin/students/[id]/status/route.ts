import { NextResponse } from "next/server";
import { requireAdmin, serverAdminEmails } from "@/lib/admin-server";
import { errorPayload, isUuid } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

// POST /api/admin/students/[id]/status — deliberate, audited account
// disable/enable. Backed by Supabase's own ban mechanism (auth admin API);
// nothing else in the auth flow is touched. Guardrails:
//   - the acting admin can never change their own status
//   - any email on the server admin allowlist is protected
//   - every change is written to the audit log
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid student id." }, { status: 400 });

    const body = (await req.json()) as { disabled?: unknown };
    if (typeof body.disabled !== "boolean") {
      return NextResponse.json({ error: "disabled must be true or false." }, { status: 400 });
    }
    const disabled = body.disabled;

    if (id === actor.id) {
      return NextResponse.json({ error: "You cannot change your own account status." }, { status: 400 });
    }

    const { data, error } = await svc.auth.admin.getUserById(id);
    if (error) throw error;
    const target = data.user;
    if (!target) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const email = (target.email ?? "").toLowerCase();
    const { list } = serverAdminEmails();
    if (email && list.includes(email)) {
      return NextResponse.json({ error: "Admin accounts cannot be disabled here." }, { status: 400 });
    }

    const { error: upErr } = await svc.auth.admin.updateUserById(id, {
      ban_duration: disabled ? "876000h" : "none",
    });
    if (upErr) throw upErr;

    await logAdminAction(svc, {
      actor,
      action: disabled ? "student.disable" : "student.enable",
      entity: "student",
      entityId: id,
      details: { email: target.email ?? "" },
    });

    return NextResponse.json({ ok: true, disabled });
  } catch (e) {
    const p = errorPayload(e, "Status change failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
