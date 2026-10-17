import { NextResponse } from "next/server";
import { getAdminSession, serverAdminEmails } from "@/lib/admin-server";

// GET /api/admin/session — the admin UI's single source of truth for "am I
// an admin?". Backed by the EXACT same server-side decision the admin API
// routes use (getAdminSession), so the client never computes authorization
// from build-time env values — a stale browser bundle can no longer lock a
// legitimate admin out or let a non-admin in.
//
// Exposes only: whether a session exists, whether that session is on the
// server allowlist, whether the server allowlist is configured at all, and
// (to its own user) the session email. Nothing else.
// (No `dynamic` segment config: this project runs Cache Components, where
// request-time APIs opt the route out of prerendering on their own.)

export async function GET() {
  const session = await getAdminSession();
  const { configured } = serverAdminEmails();

  if (session.status === "unauthenticated") {
    return NextResponse.json({ authenticated: false, admin: false, configured });
  }
  return NextResponse.json({
    authenticated: true,
    admin: session.status === "admin",
    configured,
    email: session.user.email,
  });
}
