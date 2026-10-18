"use client";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";
import { BarChart, Donut, LineChart } from "@/components/admin/charts";
import { Badge, Card, EmptyState, ErrorState, SectionCard, Skeleton, StatCard } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/hooks";
import { Icon } from "@/components/admin/icons";
import { fmtNum, fmtPct, relTime } from "@/lib/format";

type Overview = {
  students: { total: number; active30: number; new30: number };
  tests: { total: number; published: number; migrated: boolean };
  questions: { total: number };
  attempts: { total: number; last30: number; avgScore: number; avgPct: number | null; unmapped: number };
  feedback: { unread: number; available: boolean };
  scoreDist: Array<{ label: string; value: number }>;
  trends: { labels: string[]; registrations: number[]; attempts: number[] };
  recentAttempts: Array<{ id: string; email: string; test: string; score: number; created_at: string }>;
  recentTests: Array<{ id: string; title: string; published: boolean; created_at: string; questions: number }>;
  status: { feedback: boolean; announcements: boolean; auditLog: boolean; avatars: boolean };
};

const DIST_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#10b981"];

export default function AdminOverview() {
  const { data, error, loading, reload } = useAdminData<Overview>("/api/admin/overview");

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      actions={
        <button type="button" className="admin-btn" onClick={reload}>
          <Icon name="refresh" size={14} /> Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}
      {data && (
        <div className="space-y-3">
          {!data.tests.migrated && (
            <Card className="flex items-center gap-3 px-4 py-3 text-[13px] font-semibold">
              <span style={{ color: "#f59e0b" }}>
                <Icon name="alert" size={16} />
              </span>
              Test description/instructions columns are missing — run{" "}
              <code className="mono">supabase/migrations/0005_admin.sql</code> in the Supabase SQL
              Editor to unlock the full test editor.
            </Card>
          )}

          {/* stat cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total students"
              value={fmtNum(data.students.total)}
              sub={`${fmtNum(data.students.active30)} active in last 30 days`}
              icon="students"
              tone="blue"
            />
            <StatCard
              label="New registrations"
              value={fmtNum(data.students.new30)}
              sub="In the last 30 days"
              icon="pulse"
              tone="green"
            />
            <StatCard
              label="Mock tests"
              value={fmtNum(data.tests.total)}
              sub={`${fmtNum(data.tests.published)} published`}
              icon="tests"
              tone="violet"
            />
            <StatCard
              label="Question bank"
              value={fmtNum(data.questions.total)}
              sub="Total questions"
              icon="book"
              tone="amber"
            />
            <StatCard
              label="Total attempts"
              value={fmtNum(data.attempts.total)}
              sub={`${fmtNum(data.attempts.last30)} in last 30 days`}
              icon="attempts"
              tone="accent"
            />
            <StatCard
              label="Avg score (30d)"
              value={fmtNum(data.attempts.avgScore, 1)}
              sub={
                data.attempts.avgPct !== null
                  ? `≈ ${fmtPct(data.attempts.avgPct)} of max marks`
                  : "No attempts with a matched test"
              }
              icon="analytics"
              tone="green"
            />
            <Link href="/admin/feedback" className="block">
              <StatCard
                label="Unread feedback"
                value={fmtNum(data.feedback.unread)}
                sub={data.feedback.available ? "Open the feedback inbox" : "Feedback table missing"}
                icon="feedback"
                tone={data.feedback.unread > 0 ? "red" : "accent"}
              />
            </Link>
            <StatCard
              label="Tests awaiting publish"
              value={fmtNum(Math.max(0, data.tests.total - data.tests.published))}
              sub="Drafts not visible to students"
              icon="lock"
              tone="amber"
            />
          </div>

          {/* trends */}
          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard title="Registrations — last 30 days" subtitle="New student accounts per day (UTC)">
              {data.trends.registrations.some((v) => v > 0) ? (
                <LineChart labels={data.trends.labels} values={data.trends.registrations} suffix=" signups" />
              ) : (
                <EmptyState icon="students" title="No registrations in this window" hint="Daily signups will plot here." />
              )}
            </SectionCard>
            <SectionCard title="Attempts — last 30 days" subtitle="Mock submissions per day (UTC)">
              {data.trends.attempts.some((v) => v > 0) ? (
                <BarChart labels={data.trends.labels} values={data.trends.attempts} suffix=" attempts" />
              ) : (
                <EmptyState icon="attempts" title="No attempts in this window" hint="Submissions will plot here." />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {/* score distribution */}
            <SectionCard title="Score distribution (30d)" subtitle="Share of maximum marks, from real test marks">
              <Donut
                slices={data.scoreDist.map((s, i) => ({ ...s, color: DIST_COLORS[i] }))}
                centerLabel={fmtNum(data.scoreDist.reduce((a, b) => a + b.value, 0))}
                centerSub="attempts"
              />
              <p className="mt-3 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                Based on attempts submitted in the last 30 days. Attempts whose test is no longer
                found are excluded from this chart (never estimated).
              </p>
            </SectionCard>

            {/* recent activity */}
            <SectionCard title="Recent student activity" subtitle="Latest submissions" bodyClassName="px-2 py-2">
              {data.recentAttempts.length === 0 ? (
                <EmptyState icon="attempts" title="No attempts yet" />
              ) : (
                <ul>
                  {data.recentAttempts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                        style={{ background: "var(--pill)", color: "var(--accent)" }}
                      >
                        {fmtNum(a.score)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">{a.email || "unknown"}</span>
                        <span className="block truncate text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {a.test} · {relTime(a.created_at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* recent tests + system status */}
            <div className="space-y-3">
              <SectionCard title="Recent mocks" subtitle="Newest first" bodyClassName="px-2 py-2">
                {data.recentTests.length === 0 ? (
                  <EmptyState icon="tests" title="No tests created yet" />
                ) : (
                  <ul>
                    {data.recentTests.map((t) => (
                      <li key={t.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold">{t.title}</span>
                          <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
                            {t.questions} question{t.questions === 1 ? "" : "s"} · {relTime(t.created_at)}
                          </span>
                        </span>
                        <Badge tone={t.published ? "green" : "amber"}>{t.published ? "Live" : "Draft"}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="System status" subtitle="Safe configuration visibility — no secrets shown">
                <ul className="space-y-2 text-[13px]">
                  {[
                    { ok: data.status.avatars, label: "Avatars storage bucket" },
                    { ok: data.status.feedback, label: "Feedback table" },
                    { ok: data.status.announcements, label: "Announcements table" },
                    { ok: data.status.auditLog, label: "Audit log table" },
                  ].map((s) => (
                    <li key={s.label} className="flex items-center gap-2.5">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full"
                        style={{
                          background: s.ok ? "color-mix(in srgb, #10b981 16%, transparent)" : "color-mix(in srgb, #ef4444 14%, transparent)",
                          color: s.ok ? "#10b981" : "#ef4444",
                        }}
                      >
                        <Icon name={s.ok ? "check" : "alert"} size={11} strokeWidth={3} />
                      </span>
                      <span className="flex-1">{s.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                  Every admin page and API route is authorized server-side against the allowlist, and the service-role
                  key is only ever used on the server — invariants of the panel, not check results.
                </p>
                {!data.status.feedback && (
                  <p className="mt-3 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                    Missing tables are created by <code className="mono">supabase/migrations/0005_admin.sql</code>.
                  </p>
                )}
              </SectionCard>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
