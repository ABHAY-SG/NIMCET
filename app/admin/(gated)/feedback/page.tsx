"use client";
import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Pagination,
  Select,
  Skeleton,
  TableSkeleton,
  TextArea,
  TextInput,
  useToast,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { adminMutate, useAdminData, useDebounced, usePageSize } from "@/components/admin/hooks";
import { fmtDateTime, fmtNum, relTime } from "@/lib/format";

type FeedbackRow = {
  id: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type Payload = {
  total: number;
  page: number;
  per: number;
  pages: number;
  counts: { new: number; read: number; in_progress: number; resolved: number; total: number };
  rows: FeedbackRow[];
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  read: "Read",
  in_progress: "In progress",
  resolved: "Resolved",
};

const STATUS_TONE: Record<string, "red" | "blue" | "amber" | "green"> = {
  new: "red",
  read: "blue",
  in_progress: "amber",
  resolved: "green",
};

const CATEGORIES = ["general", "bug", "content", "test", "other"];

export default function AdminFeedback() {
  const toast = useToast();
  const per = usePageSize(15);

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debSearch = useDebounced(search, 300);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (debSearch.trim()) p.set("q", debSearch.trim());
    p.set("page", String(page));
    p.set("per", String(per));
    return `/api/admin/feedback?${p.toString()}`;
  }, [status, debSearch, page, per]);

  const { data, error, loading, reload } = useAdminData<Payload>(url);

  const [open, setOpen] = useState<FeedbackRow | null>(null);
  const [draftStatus, setDraftStatus] = useState("new");
  const [draftNote, setDraftNote] = useState("");
  const [busy, setBusy] = useState(false);

  const openRow = (r: FeedbackRow) => {
    setOpen(r);
    setDraftStatus(r.status);
    setDraftNote(r.admin_note);
  };

  const save = async () => {
    if (!open) return;
    setBusy(true);
    try {
      await adminMutate(`/api/admin/feedback/${open.id}`, "PUT", { status: draftStatus, admin_note: draftNote });
      toast("Feedback updated.");
      setOpen(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const counts = data?.counts;
  const tabs = [
    { id: "new", label: `New`, n: counts?.new ?? 0 },
    { id: "read", label: `Read`, n: counts?.read ?? 0 },
    { id: "in_progress", label: `In progress`, n: counts?.in_progress ?? 0 },
    { id: "resolved", label: `Resolved`, n: counts?.resolved ?? 0 },
    { id: "all", label: `All`, n: counts?.total ?? 0 },
  ];

  return (
    <AdminLayout>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-full p-0.5" style={{ background: "var(--pill)" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setStatus(t.id);
                setPage(1);
              }}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
              style={status === t.id ? { background: "var(--btn-bg)", color: "var(--btn-text)" } : { color: "var(--muted)" }}
            >
              {t.label}
              {t.n > 0 && (
                <span className="ml-1.5 opacity-80" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t.n}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
            <Icon name="search" size={14} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search subject, email or message…"
            className="pl-9!"
            aria-label="Search feedback"
          />
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {loading && !data ? (
        <Card className="px-5 py-4">
          <TableSkeleton rows={6} cols={4} />
        </Card>
      ) : (data?.rows ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon="feedback"
            title={counts && counts.total > 0 ? "Nothing in this view" : "Inbox is empty"}
            hint={
              counts && counts.total > 0
                ? "Try another status tab or clear the search."
                : "Student messages sent from the dashboard feedback form land here."
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {(data?.rows ?? []).map((r) => (
            <Card key={r.id} className="px-4 py-3.5">
              <button type="button" onClick={() => openRow(r)} className="flex w-full cursor-pointer flex-wrap items-center gap-3 text-left">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: r.status === "new" ? "color-mix(in srgb, #ef4444 14%, transparent)" : "var(--pill)",
                    color: r.status === "new" ? "#ef4444" : "var(--muted)",
                  }}
                >
                  <Icon name={r.status === "new" ? "bell" : "mail"} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13.5px] font-extrabold">{r.subject}</span>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    <Badge tone="neutral">{CATEGORIES.includes(r.category) ? r.category : "general"}</Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--muted)" }}>
                    {r.email || "unknown"} · {relTime(r.created_at)} · {r.message.slice(0, 90)}
                    {r.message.length > 90 ? "…" : ""}
                  </span>
                </span>
                <span className="shrink-0" style={{ color: "var(--muted)" }}>
                  <Icon name="chevronRight" size={15} />
                </span>
              </button>
            </Card>
          ))}
          <Card className="px-3 py-2.5">
            <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} total={data?.total ?? 0} per={per} onPage={setPage} />
          </Card>
        </div>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject ?? ""}
        subtitle={open ? `${open.email || "unknown"} · ${fmtDateTime(open.created_at)}` : ""}
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setOpen(null)} disabled={busy}>
              Close
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save review"}
            </button>
          </>
        }
      >
        {open && (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13.5px] leading-7" style={{ background: "var(--pill)" }}>
              {open.message}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </Select>
              </Field>
              <div className="self-end text-[12px]" style={{ color: "var(--muted)" }}>
                Status changes are recorded in the audit log. Student identity comes from their session —
                it cannot be forged.
              </div>
            </div>
            <Field label="Internal note" hint="Only admins see this. Stored with the feedback item.">
              <TextArea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={3} placeholder="e.g. Fixed the explanation in question 12 — reply sent." />
            </Field>
            {open.admin_note && !draftNote && (
              <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                Previous note: {open.admin_note}
              </p>
            )}
          </div>
        )}
      </Modal>

      {counts && counts.new > 0 && status === "all" && (
        <p className="mt-3 px-1 text-[12px]" style={{ color: "var(--muted)" }}>
          {fmtNum(counts.new)} unread item(s) — the bell in the header tracks this count in real time.
        </p>
      )}
      {loading && data && (
        <div className="mt-3">
          <Skeleton className="h-3 w-40" />
        </div>
      )}
    </AdminLayout>
  );
}
