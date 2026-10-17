import { NextResponse } from "next/server";
import { requireAdmin, serverAdminEmails } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";

// GET /api/admin/settings/config — safe configuration VISIBILITY: booleans
// and counts only. Environment variable values and secrets are never sent.
export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const { configured, list } = serverAdminEmails();

    const tableOk = async (t: string) => {
      try {
        const r = await svc.from(t).select("id", { count: "exact", head: true });
        return !r.error;
      } catch {
        return false;
      }
    };
    const bucketOk = async () => {
      try {
        const r = await svc.storage.getBucket("avatars");
        return !r.error;
      } catch {
        return false;
      }
    };

    const [avatars, announcements, feedback, auditLog] = await Promise.all([
      bucketOk(),
      tableOk("announcements"),
      tableOk("feedback"),
      tableOk("admin_audit_log"),
    ]);

    return NextResponse.json({
      adminEmail: user.email,
      adminEmailsConfigured: configured,
      adminEmailsCount: list.length,
      serviceKeyConfigured: true, // requireAdmin already proved the service client exists
      supabaseConfigured: true,
      avatarsBucket: avatars,
      tables: { announcements, feedback, auditLog },
      environment: process.env.VERCEL_ENV || "local",
    });
  } catch (e) {
    const p = errorPayload(e, "Configuration check failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
