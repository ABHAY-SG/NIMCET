"use client";
import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  InfoRow,
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
import { adminMutate, downloadFile, useAdminData, useDebounced, usePageSize } from "@/components/admin/hooks";
import { fmtDateTime, fmtNum, fmtPct } from "@/lib/format";

type AttemptRow = {
  id: string;
  user_id: string;
  email: string;
  test: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  created_at: string;
  pct: number | null;
  maxMarks: number | null;
};

type ListPayload = {
  total: number;
  page: number;
  per: number;
  pages: number;
  rows: AttemptRow[];
  tests: Array<{ title: string; count: number }>;
  migrated: boolean;
};

type DetailPayload = {
  attempt: AttemptRow;
  email: string;
  stats: { max: number; min: number; count: number } | null;
};

export default function AdminAttempts() {
  const toast = useToast();
  const per = usePageSize(20);

  const [search, setSearch] = useState("");
  const [test, setTest] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const debSearch = useDebounced(search, 300);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (debSearch.trim()) p.set("q", debSearch.trim());
    if (test !== "all") p.set("test", test);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (sort !== "newest") p.set("sort", sort);
    p.set("page", String(page));
    p.set("per", String(per));
    return `/api/admin/attempts?${p.toString()}`;
  }, [debSearch, test, from, to, sort, page, per]);

  const { data, error, loading, reload } = useAdminData<ListPayload>(url);

  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useAdminData<DetailPayload>(detailId ? `/api/admin/attempts/${detailId}` : null);

  const [corrOpen, setCorrOpen] = useState(false);
  const [corr, setCorr] = useState({ score: "", correct: "", wrong: "", skipped: "", reason: "" });
  const [corrBusy, setCorrBusy] = useState(false);

  const openCorrection = (a: AttemptRow) => {
    setCorr({
      score: String(a.score),
      correct: String(a.correct),
      wrong: String(a.wrong),
      skipped: String(a.skipped),
      reason: "",
    });
    setCorrOpen(true);
  };

  const saveCorrection = async () => {
    if (!detail.data) return;
    const reason = corr.reason.trim();
    if (reason.length < 3) return toast("A reason (3+ characters) is required for the audit log.", "error");
    setCorrBusy(true);
    try {
      await adminMutate(`/api/admin/attempts/${detail.data.attempt.id}`, "PUT", {
        score: Number(corr.score),
        correct: Number(corr.correct),
        wrong: Number(corr.wrong),
        skipped: Number(corr.skipped),
        reason,
      });
      toast("Score corrected and recorded in the audit log.");
      setCorrOpen(false);
      detail.reload();
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Correction failed.", "error");
    } finally {
      setCorrBusy(false);
    }
  };

  const rows = data?.rows ?? [];
  const stats = detail.data?.stats;

  return (
    <AdminLayout>
      <Card className="mb-3 flex flex-wrap items-center gap-2 px-3.5 py-3">
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
            placeholder="Search by student email or test…"
            className="pl-9"
            aria-label="Search attempts"
          />
        </div>
        <Select value={test} onChange={(e) => { setTest(e.target.value); setPage(1); }} className="w-auto max-w-[220px]" aria-label="Test filter">
          <option value="all">All tests</option>
          {(data?.tests ?? []).map((t) => (
            <option key={t.title} value={t.title}>
              {t.title} ({t.count})
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--muted)" }}>
          From
          <TextInput type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-auto" aria-label="From date" />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--muted)" }}>
          To
          <TextInput type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-auto" aria-label="To date" />
        </label>
        <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="w-auto" aria-label="Sort attempts">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="score_high">Highest score</option>
          <option value="score_low">Lowest score</option>
        </Select>
        {(search || test !== "all" || from || to || sort !== "newest") && (
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setSearch("");
              setTest("all");
              setFrom("");
              setTo("");
              setSort("newest");
              setPage(1);
            }}
          >
            <Icon name="x" size={13} /> Clear
          </button>
        )}
        <button
          type="button"
          className="admin-btn"
          onClick={async () => {
            try {
              await downloadFile(`/api/admin/attempts?format=csv&${url.split("?")[1] ?? ""}`, "attempts.csv");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Export failed.", "error");
            }
          }}
        >
          <Icon name="download" size={14} /> Export CSV
        </button>
      </Card>

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
        <Card>
          <EmptyState
            icon="attempts"
            title="No attempts found"
            hint="Adjust the filters, or wait for students to submit mocks."
          />
        </Card>
      ) : (
        <Card className="px-2 pb-3 pt-1">
          <div className="admin-scroll overflow-x-auto">
            <table className="admin-table w-full min-w-[880px]">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Test</th>
                  <th>Score</th>
                  <th>%</th>
                  <th>C / W / S</th>
                  <th>Submitted</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="admin-row">
                    <td className="max-w-[220px]">
                      <span className="block truncate font-semibold">{a.email || a.user_id.slice(0, 8)}</span>
                    </td>
                    <td className="max-w-[240px]">
                      <span className="block truncate">{a.test}</span>
                    </td>
                    <td className="mono font-bold">{fmtNum(a.score, 1)}</td>
                    <td>{a.pct !== null ? fmtPct(a.pct) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td className="mono text-[12px]" style={{ color: "var(--muted)" }}>
                      {a.correct} / {a.wrong} / {a.skipped}
                    </td>
                    <td className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--muted)" }}>
                      {fmtDateTime(a.created_at)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="admin-btn px-2 py-1.5" title="View breakdown" onClick={() => setDetailId(a.id)}>
                          <Icon name="eye" size={14} />
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
        title="Attempt breakdown"
        subtitle={detail.data ? `${detail.data.email || "student"} · ${detail.data.attempt.test}` : "Loading…"}
        width="max-w-2xl"
        footer={
          detail.data ? (
            <>
              <button type="button" className="admin-btn" onClick={() => openCorrection(detail.data!.attempt)}>
                <Icon name="edit" size={14} /> Correct score
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => setDetailId(null)}>
                Close
              </button>
            </>
          ) : undefined
        }
      >
        {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}
        {detail.loading && !detail.data && <Skeleton className="h-40" />}
        {detail.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl px-3.5 py-3" style={{ background: "var(--pill)" }}>
                <div className="text-[10.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>Score</div>
                <div className="mono mt-1 text-[22px] font-extrabold leading-none">{fmtNum(detail.data.attempt.score, 1)}</div>
                {stats && (
                  <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                    of {fmtNum(stats.max, 1)} max
                  </div>
                )}
              </div>
              <div className="rounded-2xl px-3.5 py-3" style={{ background: "var(--pill)" }}>
                <div className="text-[10.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>Correct</div>
                <div className="mono mt-1 text-[22px] font-extrabold leading-none" style={{ color: "#10b981" }}>{detail.data.attempt.correct}</div>
              </div>
              <div className="rounded-2xl px-3.5 py-3" style={{ background: "var(--pill)" }}>
                <div className="text-[10.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>Wrong</div>
                <div className="mono mt-1 text-[22px] font-extrabold leading-none" style={{ color: "#ef4444" }}>{detail.data.attempt.wrong}</div>
              </div>
              <div className="rounded-2xl px-3.5 py-3" style={{ background: "var(--pill)" }}>
                <div className="text-[10.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>Skipped</div>
                <div className="mono mt-1 text-[22px] font-extrabold leading-none" style={{ color: "var(--muted)" }}>{detail.data.attempt.skipped}</div>
              </div>
            </div>

            <div className="rounded-2xl px-4 py-1" style={{ background: "var(--pill)" }}>
              <InfoRow label="Student" value={detail.data.email || detail.data.attempt.user_id} />
              <InfoRow label="Test" value={detail.data.attempt.test} />
              <InfoRow label="Submitted" value={fmtDateTime(detail.data.attempt.created_at)} />
              {stats ? (
                <InfoRow
                  label="Mark range"
                  value={`${fmtNum(stats.min, 1)} to ${fmtNum(stats.max, 1)} across ${stats.count} question(s)`}
                />
              ) : (
                <InfoRow label="Mark range" value="Test no longer exists — range unknown" />
              )}
              <InfoRow label="Attempt ID" value={detail.data.attempt.id} mono />
            </div>

            <p className="text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
              Per-question answers are not stored on attempts by design, so corrections are manual: the
              server validates the new score against the test&apos;s real mark range, requires a reason, and
              writes before/after values to the audit log.
            </p>
          </div>
        )}
      </Modal>

      {/* correction modal */}
      <Modal
        open={corrOpen}
        onClose={() => setCorrOpen(false)}
        title="Correct attempt score"
        subtitle="Audited manual correction — the reason is stored with before/after values."
        width="max-w-lg"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setCorrOpen(false)} disabled={corrBusy}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={saveCorrection} disabled={corrBusy}>
              {corrBusy ? "Saving…" : "Save correction"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Score" hint={stats ? `Allowed: ${stats.min} – ${stats.max}` : "No matched test — −1000 to 10000"}>
              <TextInput type="number" step="0.1" value={corr.score} onChange={(e) => setCorr({ ...corr, score: e.target.value })} />
            </Field>
            <Field label="Correct">
              <TextInput type="number" value={corr.correct} onChange={(e) => setCorr({ ...corr, correct: e.target.value })} />
            </Field>
            <Field label="Wrong">
              <TextInput type="number" value={corr.wrong} onChange={(e) => setCorr({ ...corr, wrong: e.target.value })} />
            </Field>
            <Field label="Skipped">
              <TextInput type="number" value={corr.skipped} onChange={(e) => setCorr({ ...corr, skipped: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason (required, audit-logged)">
            <TextArea
              value={corr.reason}
              onChange={(e) => setCorr({ ...corr, reason: e.target.value })}
              rows={3}
              placeholder="e.g. Question 12 had two valid options — full marks granted after review."
            />
          </Field>
        </div>
      </Modal>
    </AdminLayout>
  );
}
