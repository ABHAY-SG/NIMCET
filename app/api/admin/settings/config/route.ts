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

    // Derived from the server env at request time (the route can only run when
    // the service client exists, but the booleans still report the real check).
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
    const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    return NextResponse.json({
      adminEmail: user.email,
      adminEmailsConfigured: configured,
      adminEmailsCount: list.length,
      serviceKeyConfigured: !!service,
      supabaseConfigured: !!(url && anon),
      avatarsBucket: avatars,
      tables: { announcements, feedback, auditLog },
      environment: process.env.VERCEL_ENV || "local",
    });
  } catch (e) {
    const p = errorPayload(e, "Configuration check failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
