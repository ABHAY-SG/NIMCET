"use client";
import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { BarChart, Donut, LineChart } from "@/components/admin/charts";
import { Badge, Card, EmptyState, ErrorState, SectionCard, Skeleton, StatCard } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/hooks";
import { fmtNum, fmtPct } from "@/lib/format";

type Analytics = {
  days: number;
  summary: {
    attempts: number;
    uniqueStudents: number;
    avgScore: number;
    avgPct: number | null;
    mapped: number;
    unmapped: number;
    newStudents: number;
    totalStudents: number;
    totalAttempts: number;
  };
  charts: { labels: string[]; registrations: number[]; attempts: number[]; avgScore: number[] };
  scoreDist: Array<{ label: string; value: number }>;
  testsTable: Array<{
    id: string;
    title: string;
    exam: string;
    published: boolean;
    minutes: number;
    questions: number;
    maxMarks: number | null;
    attempts: number;
    students: number;
    avg: number;
    avgPct: number | null;
  }>;
  bank: {
    total: number;
    sections: Array<{ label: string; value: number }>;
    difficulties: Array<{ label: string; value: number }>;
  };
  migrated: boolean;
};

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

const DIST_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#10b981"];
const DIFF_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useAdminData<Analytics>(`/api/admin/analytics?days=${days}`);

  return (
    <AdminLayout
      actions={
        <div className="flex items-center gap-1 rounded-full p-0.5" style={{ background: "var(--pill)" }}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
              style={
                days === r.days
                  ? { background: "var(--btn-bg)", color: "var(--btn-text)" }
                  : { color: "var(--muted)" }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="mb-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Attempts" value={fmtNum(data.summary.attempts)} sub={`in last ${data.days} days`} icon="attempts" tone="accent" />
            <StatCard label="Active learners" value={fmtNum(data.summary.uniqueStudents)} sub="students with submissions" icon="students" tone="blue" />
            <StatCard label="New registrations" value={fmtNum(data.summary.newStudents)} sub={`of ${fmtNum(data.summary.totalStudents)} total`} icon="pulse" tone="green" />
            <StatCard
              label="Average score"
              value={fmtNum(data.summary.avgScore, 1)}
              sub={data.summary.avgPct !== null ? `≈ ${fmtPct(data.summary.avgPct)} of max marks` : "no matched tests"}
              icon="analytics"
              tone="violet"
            />
            <StatCard
              label="Attempts mapped to tests"
              value={fmtNum(data.summary.mapped)}
              sub={data.summary.unmapped > 0 ? `${fmtNum(data.summary.unmapped)} unmatched (test removed)` : "all attempts matched"}
              icon="check"
              tone="green"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard title={`Registrations — last ${data.days} days`} subtitle="Daily signups (UTC); long ranges are bucketed">
              {data.charts.registrations.some((v) => v > 0) ? (
                <LineChart labels={data.charts.labels} values={data.charts.registrations} suffix=" signups" />
              ) : (
                <EmptyState icon="students" title="No registrations in this range" />
              )}
            </SectionCard>
            <SectionCard title={`Attempts — last ${data.days} days`} subtitle="Daily submissions (UTC); long ranges are bucketed">
              {data.charts.attempts.some((v) => v > 0) ? (
                <BarChart labels={data.charts.labels} values={data.charts.attempts} suffix=" attempts" />
              ) : (
                <EmptyState icon="attempts" title="No attempts in this range" />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard title="Average score trend" subtitle="Mean raw score per day (days without attempts show 0)">
              {data.charts.attempts.some((v) => v > 0) ? (
                <LineChart labels={data.charts.labels} values={data.charts.avgScore} color="#7c3aed" suffix=" avg score" />
              ) : (
                <EmptyState icon="analytics" title="Not enough data yet" />
              )}
            </SectionCard>
            <SectionCard title={`Score distribution — last ${data.days} days`} subtitle="Share of maximum marks (sum of the test's question marks)">
              <Donut
                slices={data.scoreDist.map((s, i) => ({ ...s, color: DIST_COLORS[i] }))}
                centerLabel={fmtNum(data.scoreDist.reduce((a, b) => a + b.value, 0))}
                centerSub="attempts"
              />
              {data.summary.unmapped > 0 && (
                <p className="mt-3 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                  {fmtNum(data.summary.unmapped)} attempt(s) excluded — their test no longer exists, so a
                  percentage cannot be computed honestly.
                </p>
              )}
            </SectionCard>
          </div>

          {/* test-wise comparison */}
          <SectionCard
            title="Test-wise comparison"
            subtitle={`Attempts in the last ${data.days} days · sorted by participation`}
            bodyClassName="px-2 pb-3 pt-2"
          >
            {data.testsTable.length === 0 ? (
              <EmptyState icon="tests" title="No tests to compare yet" />
            ) : (
              <div className="admin-scroll overflow-x-auto">
                <table className="admin-table w-full min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Questions</th>
                      <th>Max marks</th>
                      <th>Attempts</th>
                      <th>Students</th>
                      <th>Avg score</th>
                      <th>Avg %</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.testsTable.map((t) => (
                      <tr key={t.id} className="admin-row">
                        <td className="max-w-[280px]">
                          <span className="block truncate font-bold">{t.title}</span>
                          <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
                            {t.exam} · {t.minutes} min
                          </span>
                        </td>
                        <td>{fmtNum(t.questions)}</td>
                        <td>{t.maxMarks !== null ? fmtNum(t.maxMarks, 1) : "—"}</td>
                        <td className="font-bold">{fmtNum(t.attempts)}</td>
                        <td>{fmtNum(t.students)}</td>
                        <td>{t.attempts ? fmtNum(t.avg, 1) : "—"}</td>
                        <td>{t.avgPct !== null ? fmtPct(t.avgPct) : "—"}</td>
                        <td>
                          <Badge tone={t.published ? "green" : "amber"}>{t.published ? "Live" : "Draft"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* bank composition */}
          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard title="Question bank by section" subtitle={`${fmtNum(data.bank.total)} questions total`}>
              {data.bank.sections.length === 0 ? (
                <EmptyState icon="book" title="No questions yet" />
              ) : (
                <ul className="space-y-2.5">
                  {data.bank.sections.map((s) => {
                    const max = Math.max(1, ...data.bank.sections.map((x) => x.value));
                    return (
                      <li key={s.label}>
                        <div className="mb-1 flex items-center justify-between text-[12.5px]">
                          <span className="font-bold">{s.label}</span>
                          <span style={{ color: "var(--muted)" }}>{fmtNum(s.value)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(s.value / max) * 100}%`, background: "var(--accent)" }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Question bank by difficulty" subtitle="Real difficulty field on every question">
              {data.bank.total === 0 ? (
                <EmptyState icon="book" title="No questions yet" />
              ) : (
                <>
                  <Donut
                    slices={data.bank.difficulties.map((d, i) => ({ ...d, color: DIFF_COLORS[i] }))}
                    centerLabel={fmtNum(data.bank.total)}
                    centerSub="questions"
                  />
                  <p className="mt-4 text-[11.5px] leading-5" style={{ color: "var(--muted)" }}>
                    Subject/topic-wise <em>performance</em> analytics would need per-question answer
                    storage on attempts, which this schema intentionally does not keep — so this card
                    shows the real composition of the question bank instead of an invented chart.
                  </p>
                </>
              )}
            </SectionCard>
          </div>

          {!data.migrated && (
            <Card className="px-4 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
              Tip: run <code className="mono">supabase/migrations/0005_admin.sql</code> to unlock test
              descriptions/instructions in the test editor.
            </Card>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
