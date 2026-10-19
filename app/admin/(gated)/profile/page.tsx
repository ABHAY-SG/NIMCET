"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";
import PhotoCropper from "@/components/photo-cropper";
import {
  Avatar,
  Badge,
  Card,
  ErrorState,
  Field,
  InfoRow,
  SectionCard,
  Skeleton,
  TextInput,
  useToast,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { useAdminData } from "@/components/admin/hooks";
import { getAuthClient, resolveAvatarUrl } from "@/lib/supabase";
import { fmtDate, relTime } from "@/lib/format";

type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  custom_avatar: string;
  custom_cover: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
};

const PW_RULE =
  "Password needs 8+ characters with an uppercase letter, a number and a special character.";

// Frosted action chips that stay readable on any cover photo or gradient.
const chipCls =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold cursor-pointer disabled:opacity-60";
const chipStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.55)",
  color: "#fff",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

export default function AdminProfile() {
  const toast = useToast();
  const { data, error, loading, reload } = useAdminData<Profile>("/api/admin/profile");

  // Name, avatar and cover are edited through the SAME client-side Supabase
  // session machinery the student profile uses (user_metadata + avatars
  // bucket), so the app keeps exactly one profile system. The API route stays
  // read-only.
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [nameInit, setNameInit] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);

  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ kind: "avatar" | "cover"; src: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // Seed the editable fields once the real profile arrives (React's
  // documented adjust-during-render pattern — replaces an effect).
  if (data && !nameInit) {
    setNameInit(true);
    setFirst(data.first_name);
    setLast(data.last_name);
    setAvatar(data.custom_avatar);
    setCover(data.custom_cover);
  }

  const displayName = useMemo(() => {
    const n = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
    return n || (data?.email ? data.email.split("@")[0] : "Administrator");
  }, [data]);

  const notifyShell = () => {
    try {
      window.dispatchEvent(new CustomEvent("mcamock-admin-profile"));
    } catch {}
  };

  const saveName = async () => {
    const f = first.trim();
    if (!f) return toast("First name is required.", "error");
    setNameBusy(true);
    try {
      const sb = getAuthClient();
      const { error: e } = await sb.auth.updateUser({ data: { first_name: f, last_name: last.trim() } });
      if (e) throw e;
      toast("Name updated.");
      reload();
      notifyShell();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the name.", "error");
    } finally {
      setNameBusy(false);
    }
  };

  const pickFile = (f: File | undefined, kind: "avatar" | "cover") => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Choose an image file (JPG, PNG or WebP).", "error");
    if (f.size > 8 * 1024 * 1024) return toast("Keep the source photo under 8 MB.", "error");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCrop({ kind, src: reader.result });
    };
    reader.readAsDataURL(f);
  };

  const uploadAvatar = async (blob: Blob) => {
    if (blob.size > 2 * 1024 * 1024) {
      toast("Keep the cropped photo under 2 MB.", "error");
      return;
    }
    setPhotoBusy(true);
    try {
      const sb = getAuthClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("Log in again, then retry.");
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await sb.storage.from("avatars").upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
      });
      if (upErr) throw upErr;
      const { error: metaErr } = await sb.auth.updateUser({ data: { custom_avatar: path } });
      if (metaErr) throw metaErr;
      setAvatar(path);
      setCrop(null);
      toast("Profile photo updated.");
      reload();
      notifyShell();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Upload failed.";
      toast(
        /bucket|not found|row-level|policy|permission/i.test(raw)
          ? `${raw} — the 'avatars' bucket must exist (created with migration 0003).`
          : raw,
        "error"
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const uploadCover = async (blob: Blob) => {
    if (blob.size > 3 * 1024 * 1024) {
      toast("Keep the cropped cover under 3 MB.", "error");
      return;
    }
    setPhotoBusy(true);
    try {
      const sb = getAuthClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("Log in again, then retry.");
      const path = `${user.id}/cover.jpg`;
      const { error: upErr } = await sb.storage.from("avatars").upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
      });
      if (upErr) throw upErr;
      const { error: metaErr } = await sb.auth.updateUser({ data: { custom_cover: path } });
      if (metaErr) throw metaErr;
      setCover(path);
      setCrop(null);
      toast("Cover photo updated.");
      reload();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Cover upload failed.";
      toast(
        /bucket|not found|row-level|policy|permission/i.test(raw)
          ? `${raw} — the 'avatars' bucket must exist (created with migration 0003).`
          : raw,
        "error"
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      const sb = getAuthClient();
      const { error: e } = await sb.auth.updateUser({ data: { custom_avatar: "" } });
      if (e) throw e;
      setAvatar("");
      toast("Profile photo removed.");
      reload();
      notifyShell();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove the photo.", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeCover = async () => {
    setPhotoBusy(true);
    try {
      const sb = getAuthClient();
      const { error: e } = await sb.auth.updateUser({ data: { custom_cover: "" } });
      if (e) throw e;
      setCover("");
      toast("Cover photo removed.");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove the cover.", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  // Changing a password ALWAYS requires the current one. Google/GitHub-only
  // accounts have no password yet — they get the one-time "add a password"
  // prompt after sign-in instead (components/password-prompt.tsx), so this
  // form never doubles as a password-less "set" shortcut.
  const savePassword = async () => {
    if (newPw.length < 8 || !/\d/.test(newPw) || !/[A-Z]/.test(newPw) || !/[^A-Za-z0-9]/.test(newPw)) {
      return toast(PW_RULE, "error");
    }
    if (newPw !== confirmPw) return toast("Passwords do not match — retype the confirmation.", "error");
    if (!curPw) return toast("Enter your current password.", "error");
    setPwBusy(true);
    try {
      const sb = getAuthClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user?.email) throw new Error("Log in again, then retry.");
      const { error: reErr } = await sb.auth.signInWithPassword({ email: user.email, password: curPw });
      if (reErr) {
        if (/invalid login credentials/i.test(reErr.message)) {
          throw new Error("Current password is incorrect. If you joined with Google/GitHub and never set one, use Forgot password on the login page.");
        }
        throw reErr;
      }
      const { error: e } = await sb.auth.updateUser({ password: newPw });
      if (e) throw e;
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      toast("Password changed.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update the password.", "error");
    } finally {
      setPwBusy(false);
    }
  };

  const avatarSrc = resolveAvatarUrl({ custom_avatar: avatar ?? "" }) || undefined;
  const coverSrc = cover ? `/api/avatar?src=${encodeURIComponent(cover)}` : "";

  const facts: Array<{ label: string; value: string }> = [
    { label: "Role", value: "Administrator" },
    { label: "Member since", value: data ? fmtDate(data.created_at) : "—" },
    { label: "Last sign-in", value: data?.last_sign_in_at ? relTime(data.last_sign_in_at) : "—" },
  ];

  return (
    <AdminLayout>
      {error && (
        <div className="mb-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {/* Identity hero: LinkedIn-style cover (photo or gradient), overlapping
          avatar, live account facts. */}
      <Card className="overflow-hidden">
        <div className="relative h-28 overflow-hidden sm:h-36">
          {coverSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(2,6,23,0.1) 0%, rgba(2,6,23,0.05) 55%, rgba(2,6,23,0.32) 100%)" }}
              />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(120deg, color-mix(in srgb, var(--accent) 26%, transparent), color-mix(in srgb, var(--accent-2) 30%, transparent) 55%, color-mix(in srgb, var(--accent) 18%, transparent))",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(420px 170px at 16% 130%, color-mix(in srgb, var(--accent) 42%, transparent), transparent 70%), radial-gradient(320px 140px at 88% -30%, color-mix(in srgb, var(--accent-2) 36%, transparent), transparent 72%)",
                }}
              />
            </>
          )}

          {/* Cover controls */}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0], "cover");
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={chipCls}
              style={chipStyle}
              disabled={photoBusy}
              onClick={() => coverFileRef.current?.click()}
            >
              <Icon name="upload" size={13} /> {coverSrc ? "Change cover" : "Add cover"}
            </button>
            {coverSrc ? (
              <button type="button" className={chipCls} style={chipStyle} disabled={photoBusy} onClick={removeCover}>
                <Icon name="trash" size={13} /> Remove
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-5 pb-5">
          {loading && !data ? (
            <div className="space-y-3 pt-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                {/* Avatar floats over the cover on its own (negative margin
                    lives here, not on the row) and is explicitly stacked
                    above it — text therefore always starts at the cover
                    line and the circle is never sliced by the photo. */}
                <div className="flex min-w-0 flex-col items-start gap-x-4 gap-y-3 sm:flex-row">
                  <span
                    className="relative z-10 -mt-12 inline-flex shrink-0 rounded-full p-1.5"
                    style={{ background: "var(--card)", boxShadow: "0 14px 34px -20px rgba(2, 6, 23, 0.55)" }}
                  >
                    <Avatar src={avatarSrc} name={displayName} size={84} />
                  </span>
                  <div className="w-full min-w-0 sm:w-auto">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="dash-display truncate text-[21px] font-extrabold tracking-tight">{displayName}</h1>
                      <Badge tone="violet">Administrator</Badge>
                    </div>
                    <p className="mono mt-0.5 truncate text-[12px]" style={{ color: "var(--muted)" }}>
                      {data?.email ?? "…"}
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      pickFile(e.target.files?.[0], "avatar");
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={photoBusy}
                    onClick={() => avatarFileRef.current?.click()}
                  >
                    <Icon name="upload" size={14} /> {photoBusy ? "Working…" : "Change photo"}
                  </button>
                  {avatar ? (
                    <button type="button" className="admin-btn" disabled={photoBusy} onClick={removePhoto}>
                      <Icon name="trash" size={14} /> Remove
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                {facts.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-2xl px-3.5 py-3"
                    style={{ background: "var(--pill)", border: "1px solid var(--border)" }}
                  >
                    <div
                      className="text-[10.5px] font-extrabold uppercase"
                      style={{ color: "var(--muted)", letterSpacing: "0.12em" }}
                    >
                      {f.label}
                    </div>
                    <div className="mono mt-1 truncate text-[14px] font-extrabold">{f.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <SectionCard
            title="Profile details"
            subtitle="Shown in the header and dropdown across the panel"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <TextInput value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" />
              </Field>
              <Field label="Last name">
                <TextInput value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="admin-btn admin-btn-primary" disabled={nameBusy} onClick={saveName}>
                <Icon name="check" size={14} /> {nameBusy ? "Saving…" : "Save name"}
              </button>
              <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                Photos are cropped in-browser and stored in the shared <span className="mono">avatars</span> bucket.
              </span>
            </div>
          </SectionCard>

          <SectionCard title="Account" subtitle="Identity recorded with Supabase Auth">
            {data ? (
              <div className="rounded-2xl px-3.5 py-1" style={{ background: "var(--pill)" }}>
                <InfoRow label="Email" value={data.email} />
                <InfoRow label="Sign-in method" value={data.provider || "email"} />
                <InfoRow label="Member since" value={fmtDate(data.created_at)} />
                <InfoRow label="Last sign-in" value={data.last_sign_in_at ? relTime(data.last_sign_in_at) : "—"} />
                <InfoRow label="Account ID" value={data.id} mono />
              </div>
            ) : (
              <Skeleton className="h-40" />
            )}
          </SectionCard>
        </div>

        <SectionCard title="Security" subtitle="Changing your password always requires the current one" id="security">
          <div className="space-y-2.5">
            <Field label="Current password">
              <TextInput type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
            </Field>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field label="New password">
                <TextInput type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
              </Field>
              <Field label="Confirm">
                <TextInput type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" className="admin-btn admin-btn-primary" disabled={pwBusy} onClick={savePassword}>
                <Icon name="lock" size={14} /> {pwBusy ? "Working…" : "Change password"}
              </button>
              <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                {PW_RULE}
              </span>
            </div>
          </div>

          <p className="mt-4 border-t pt-3 text-[12px] leading-5" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            Signed in only with Google/GitHub? You have no password yet — set one from the one-time prompt after
            signing in, or through <Link href="/login" className="font-bold underline">Forgot password</Link>. The admin
            allowlist lives only in server environment variables (<span className="mono">ADMIN_EMAILS</span>) — it is
            intentionally not editable from this page. Theme and table density are in{" "}
            <Link href="/admin/settings" className="font-bold underline">
              Settings
            </Link>
            .
          </p>
        </SectionCard>
      </div>

      {crop && (
        <PhotoCropper
          src={crop.src}
          title={crop.kind === "cover" ? "Crop cover photo" : "Crop profile photo"}
          aspect={crop.kind === "cover" ? 4 : 1}
          onCancel={() => setCrop(null)}
          onConfirm={(blob) => (crop.kind === "cover" ? uploadCover(blob) : uploadAvatar(blob))}
        />
      )}
    </AdminLayout>
  );
}
