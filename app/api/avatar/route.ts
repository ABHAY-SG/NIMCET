import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";

// GET /api/avatar?src=<stored value> — 302 to a short-lived signed URL.
// Only the owner can view their own avatar path. The stored value is either
// a storage path ("<userId>/avatar.jpg", current) or a legacy full public
// URL from before the bucket went private (path extracted, query stripped).
// Browser <img> tags follow the redirect with no cookies needed.
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
    if (!path || !path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const { data, error } = await svc.storage.from("avatars").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw error ?? new Error("Sign failed.");
    return NextResponse.redirect(data.signedUrl);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Avatar unavailable." },
      { status: 500 }
    );
  }
}
