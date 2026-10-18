import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";

// GET /api/admin/profile — the authenticated admin's own account details.
// Read-only: name/avatar edits go through the same user_metadata + storage
// machinery the student profile already uses (client-side Supabase session),
// so there is exactly one profile system in the app. This route never exposes
// tokens or provider secrets — only display/account fields.
export async function GET() {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx.error;
  const { svc, user: actor } = ctx;
  try {
    const { data, error } = await svc.auth.admin.getUserById(actor.id);
    if (error) throw error;
    const u = data.user;
    if (!u) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

    return NextResponse.json({
      id: u.id,
      email: u.email ?? actor.email,
      first_name: str(meta.first_name),
      last_name: str(meta.last_name),
      custom_avatar: str(meta.custom_avatar),
      custom_cover: str(meta.custom_cover),
      created_at: u.created_at ?? "",
      last_sign_in_at: u.last_sign_in_at ?? null,
      provider: (u.app_metadata?.provider as string | undefined) ?? "",
    });
  } catch (e) {
    const p = errorPayload(e, "Profile load failed.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
