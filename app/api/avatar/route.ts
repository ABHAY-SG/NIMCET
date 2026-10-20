import { NextResponse } from "next/server";
import { getAdminSession, requireUser } from "@/lib/admin-server";
import { errorPayload } from "@/lib/admin-queries";

// GET /api/avatar?src=<stored value> — 302 to a short-lived signed URL.
// Students may only view their own avatar path. Admins (verified via the same
// server-side allowlist the panel uses) may sign any stored avatar path, so
// the Students detail view can show real student photos instead of a broken
// image. The stored value is either a storage path ("<userId>/avatar.jpg",
// current) or a legacy full public URL from before the bucket went private
// (path extracted, query stripped).
export async function GET(req: Request) {
  const ctx = await requireUser();
  if ("error" in ctx) return ctx.error;
  const { svc, user } = ctx;
  try {
    const raw = (new URL(req.url).searchParams.get("src") || "").trim();
    if (!raw) return NextResponse.json({ error: "Missing src." }, { status: 400 });
    let path = raw.split("?")[0];
    const marker = "/avatars/";
    const at = path.lastIndexOf(marker);
    if (at >= 0) path = path.slice(at + marker.length);
    path = path.replace(/^\/+/, "");
    // Reject traversal/empty segments before the ownership prefix check. The
    // prefix test alone would accept "userId/../other-user/avatar.jpg".
    if (
      !path ||
      path.includes("\\") ||
      path.split("/").some((seg) => seg === "" || seg === "." || seg === "..")
    ) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    if (!path.startsWith(`${user.id}/`)) {
      const session = await getAdminSession();
      if (session.status !== "admin") {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
    }
    const { data, error } = await svc.storage.from("avatars").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw error ?? new Error("Sign failed.");
    const res = NextResponse.redirect(data.signedUrl);
    // A signed URL is valid for an hour; a short private cache avoids a fresh
    // storage round-trip on every avatar render without ever being shared.
    res.headers.set("Cache-Control", "private, max-age=300");
    return res;
  } catch (e) {
    const p = errorPayload(e, "Avatar unavailable.");
    return NextResponse.json({ error: p.error }, { status: p.status });
  }
}
