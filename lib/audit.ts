import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "./admin-server";

// SERVER ONLY — append-only audit logging for sensitive admin mutations.
// Best effort by design: the mutation itself is already authorized and has
// succeeded before this runs; a failed log write must never corrupt the
// user-visible result. Failures are surfaced in server logs only.
//
// Never pass secrets, tokens or passwords in `details` — callers summarize:
// changed field names, before/after of DISPLAY values, record titles, counts.

const MAX_JSON = 4000;

export type AuditInput = {
  actor: SessionUser;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

export async function logAdminAction(svc: SupabaseClient, input: AuditInput): Promise<void> {
  try {
    let details: Record<string, unknown> = input.details ?? {};
    if (JSON.stringify(details).length > MAX_JSON) {
      details = { note: "details omitted (too large)", keys: Object.keys(details).slice(0, 20) };
    }
    const { error } = await svc.from("admin_audit_log").insert({
      actor_id: input.actor.id,
      actor_email: input.actor.email,
      action: input.action.slice(0, 80),
      entity: input.entity.slice(0, 40),
      entity_id: String(input.entityId ?? "").slice(0, 80),
      details,
    });
    if (error) console.error("audit log insert failed:", error.message);
  } catch (e) {
    console.error("audit log insert threw:", e instanceof Error ? e.message : e);
  }
}
