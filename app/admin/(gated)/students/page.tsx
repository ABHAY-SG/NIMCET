"use client";
import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InfoRow,
  Modal,
  Pagination,
  Select,
  Skeleton,
  StatCard,
  TableSkeleton,
  TextInput,
  Avatar,
  useToast,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { adminMutate, useAdminData, useDebounced, usePageSize } from "@/components/admin/hooks";
import { fmtDate, fmtNum, fmtPct, relTime } from "@/lib/format";

type Student = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  disabled: boolean;
  attempts: number;
  avg: number;
  best: number;
  last_attempt_at: string | null;
};

type ListPayload = {
  total: number;
  page: number;
  per: number;
  pages: number;
  rows: Student[];
  summary: { users: number; disabled: number; withAttempts: number };
};

type DetailPayload = {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    dob: string;
    gender: string;
    custom_avatar: string;
    created_at: string;
    last_sign_in_at: string | null;
    provider: string;
    disabled: boolean;
  };
  attempts: Array<{
    id: string;
    test: string;
    score: number;
    correct: number;
    wrong: number;
    skipped: number;
    created_at: string;
    pct: number | null;
    maxMarks: number | null;
  }>;
  summary: {
    attempts: number;
    avg: number;
    best: number;
    correct: number;
    wrong: number;
    skipped: number;
    accuracy: number | null;
    avgPct: number | null;
    unmapped: number;
  };
};

export default function AdminStudents() {
  const toast = useToast();
  const per = usePageSize(20);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);

  const debSearch = useDebounced(search, 300);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (debSearch.trim()) p.set("q", debSearch.trim());
    if (status !== "all") p.set("status", status);
    if (sort !== "new") p.set("sort", sort);
    p.set("page", String(page));
    p.set("per", String(per));
    return `/api/admin/students?${p.toString()}`;
  }, [debSearch, status, sort, page, per]);

  const { data, error, loading, reload } = useAdminData<ListPayload>(url);

  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useAdminData<DetailPayload>(detailId ? `/api/admin/students/${detailId}` : null);
  const [toToggle, setToToggle] = useState<Student | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const rows = data?.rows ?? [];

  const doToggle = async () => {
    if (!toToggle) return;
    setToggleBusy(true);
    try {
      await adminMutate(`/api/admin/students/${toToggle.id}/status`, "POST", {
        disabled: !toToggle.disabled,
      });
      toast(toToggle.disabled ? "Account enabled." : "Account disabled.");
      setToToggle(null);
      reload();
      if (detailId === toToggle.id) detail.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Status change failed.", "error");
    } finally {
      setToggleBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        {loading && !data ? (
          <>
            <Skeleton className="h-[96px]" />
            <Skeleton className="h-[96px]" />
            <Skeleton className="h-[96px]" />
          </>
        ) : (
          <>
            <StatCard label="Registered students" value={fmtNum(data?.summary.users ?? 0)} icon="students" tone="blue" />
            <StatCard label="With attempts" value={fmtNum(data?.summary.withAttempts ?? 0)} icon="attempts" tone="accent" />
            <StatCard label="Disabled accounts" value={fmtNum(data?.summary.disabled ?? 0)} icon="lock" tone={data && data.summary.disabled > 0 ? "red" : "green"} />
          </>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
            <Icon name="search" size={14} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="pl-9!"
            aria-label="Search students"
          />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status filter">
          <option value="all">All students</option>
          <option value="active">Active only</option>
          <option value="disabled">Disabled only</option>
        </Select>
        <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="w-auto" aria-label="Sort students">
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="attempts">Most attempts</option>
          <option value="avg">Highest average</option>
          <option value="best">Highest score</option>
        </Select>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {loading && !data ? (
        <Card className="px-5 py-4">
          <TableSkeleton rows={8} cols={6} />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="px-5 py-4">
          <EmptyState
            icon="students"
            title={(data?.summary.users ?? 0) === 0 ? "No students registered yet" : "No students match"}
            hint={(data?.summary.users ?? 0) === 0 ? "Accounts appear here as soon as students sign up." : "Try a different search or filter."}
          />
        </Card>
      ) : (
        <Card className="px-5 py-4">
          <div className="admin-scroll overflow-x-auto">
            <table className="admin-table w-full min-w-[860px]">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Joined</th>
                  <th>Last active</th>
                  <th>Attempts</th>
                  <th>Avg score</th>
                  <th>Best</th>
                  <th>Account</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="admin-row">
                    <td className="max-w-[260px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name || s.email} size={32} />
                        <div className="min-w-0">
                          <span className="block truncate font-bold">{s.name || s.email.split("@")[0]}</span>
                          <span className="block truncate text-[11.5px]" style={{ color: "var(--muted)" }}>
                            {s.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--muted)" }}>
                      {fmtDate(s.created_at)}
                    </td>
                    <td className="whitespace-nowrap text-[12.5px]">{relTime(s.last_sign_in_at || s.last_attempt_at)}</td>
                    <td className="font-bold">{fmtNum(s.attempts)}</td>
                    <td>{s.attempts ? fmtNum(s.avg, 1) : "—"}</td>
                    <td>{s.attempts ? fmtNum(s.best, 1) : "—"}</td>
                    <td>
                      <Badge tone={s.disabled ? "red" : "green"}>{s.disabled ? "Disabled" : "Active"}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="admin-btn px-2 py-1.5" title="View profile" aria-label="View profile" onClick={() => setDetailId(s.id)}>
                          <Icon name="eye" size={14} />
                        </button>
                        <button
                          type="button"
                          className={s.disabled ? "admin-btn px-2 py-1.5" : "admin-btn admin-btn-danger px-2 py-1.5"}
                          title={s.disabled ? "Enable account" : "Disable account"}
                          aria-label={s.disabled ? "Enable account" : "Disable account"}
                          onClick={() => setToToggle(s)}
                        >
                          <Icon name={s.disabled ? "check" : "lock"} size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 pt-3">
              <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} total={data?.total ?? 0} per={per} onPage={setPage} />
            </div>
          </div>
        </Card>
      )}

      {/* detail modal */}
      <Modal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title="Student profile"
        subtitle={detail.data?.user.email || "Loading…"}
        width="max-w-3xl"
        footer={
          detail.data ? (
            <>
              <button
                type="button"
                className={detail.data.user.disabled ? "admin-btn" : "admin-btn admin-btn-danger"}
                onClick={() => {
                  const u = detail.data!.user;
                  setToToggle({
                    id: u.id,
                    email: u.email,
                    name: [u.first_name, u.last_name].filter(Boolean).join(" "),
                    created_at: u.created_at,
                    last_sign_in_at: u.last_sign_in_at,
                    disabled: u.disabled,
                    attempts: detail.data!.summary.attempts,
                    avg: detail.data!.summary.avg,
                    best: detail.data!.summary.best,
                    last_attempt_at: null,
                  });
                }}
              >
                <Icon name={detail.data.user.disabled ? "check" : "lock"} size={14} />
                {detail.data.user.disabled ? "Enable account" : "Disable account"}
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => setDetailId(null)}>
                Close
              </button>
            </>
          ) : undefined
        }
      >
        {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}
        {detail.loading && !detail.data && (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <TableSkeleton rows={4} cols={4} />
          </div>
        )}
        {detail.data && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar src={detail.data.user.custom_avatar || undefined} name={detail.data.user.email} size={52} />
              <div className="min-w-0">
                <div className="truncate text-[16px] font-extrabold">
                  {[detail.data.user.first_name, detail.data.user.last_name].filter(Boolean).join(" ") ||
                    detail.data.user.email.split("@")[0]}
                </div>
                <div className="truncate text-[12.5px]" style={{ color: "var(--muted)" }}>
                  {detail.data.user.email}
                </div>
                <div className="mt-1">
                  <Badge tone={detail.data.user.disabled ? "red" : "green"}>
                    {detail.data.user.disabled ? "Disabled" : "Active"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl px-4 py-1" style={{ background: "var(--pill)" }}>
                <InfoRow label="Joined" value={fmtDate(detail.data.user.created_at)} />
                <InfoRow label="Last sign-in" value={detail.data.user.last_sign_in_at ? relTime(detail.data.user.last_sign_in_at) : "—"} />
                <InfoRow label="Sign-in method" value={detail.data.user.provider || "email"} />
                <InfoRow label="Date of birth" value={detail.data.user.dob || "—"} />
                <InfoRow label="User ID" value={detail.data.user.id.slice(0, 13) + "…"} mono />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Attempts" value={fmtNum(detail.data.summary.attempts)} tone="accent" icon="attempts" />
                <StatCard label="Avg score" value={fmtNum(detail.data.summary.avg, 1)} tone="violet" icon="analytics" />
                <StatCard label="Best score" value={fmtNum(detail.data.summary.best, 1)} tone="green" icon="check" />
                <StatCard
                  label="Accuracy"
                  value={detail.data.summary.accuracy !== null ? fmtPct(detail.data.summary.accuracy) : "—"}
                  tone="amber"
                  icon="pulse"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[13px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>
                Attempt history ({detail.data.summary.attempts})
              </h3>
              {detail.data.attempts.length === 0 ? (
                <EmptyState icon="attempts" title="No attempts yet" />
              ) : (
                <div className="admin-scroll max-h-72 overflow-y-auto rounded-2xl" style={{ border: "1px solid var(--border)" }}>
                  <table className="admin-table w-full">
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Score</th>
                        <th>%</th>
                        <th>C / W / S</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.attempts.map((a) => (
                        <tr key={a.id} className="admin-row">
                          <td className="max-w-[200px]">
                            <span className="block truncate font-semibold">{a.test}</span>
                          </td>
                          <td className="mono font-bold">{fmtNum(a.score, 1)}</td>
                          <td>{a.pct !== null ? fmtPct(a.pct) : "—"}</td>
                          <td className="mono text-[12px]" style={{ color: "var(--muted)" }}>
                            {a.correct} / {a.wrong} / {a.skipped}
                          </td>
                          <td className="whitespace-nowrap text-[12px]" style={{ color: "var(--muted)" }}>
                            {relTime(a.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toToggle}
        title={toToggle?.disabled ? "Enable this account?" : "Disable this account?"}
        tone={toToggle?.disabled ? "primary" : "danger"}
        confirmLabel={toToggle?.disabled ? "Enable account" : "Disable account"}
        busy={toggleBusy}
        requireText={toToggle?.disabled ? undefined : toToggle?.email}
        message={
          toToggle?.disabled ? (
            <>
              <strong>{toToggle?.email}</strong> will be able to sign in again immediately.
            </>
          ) : (
            <>
              <strong>{toToggle?.email}</strong> will be signed out and blocked from signing in (Supabase
              ban). Existing sessions end within their token lifetime. This is recorded in the audit log.
            </>
          )
        }
        onCancel={() => setToToggle(null)}
        onConfirm={doToggle}
      />
    </AdminLayout>
  );
}
