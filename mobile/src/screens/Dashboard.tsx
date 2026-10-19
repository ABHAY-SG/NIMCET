import { Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "../lib/auth";
import { useAsync } from "../lib/useAsync";
import {
  computeStats,
  displayMarks,
  displayMinutes,
  fetchAnnouncements,
  formatDate,
  listMyAttempts,
  listPublishedTests,
  partsForTest,
  type Announcement,
  type AttemptRow,
  type StudentTest,
} from "../lib/data";
import { Alert, SectionHead, Spinner, Stat } from "../components/ui";
import { Icon } from "../components/icons";

type DashData = {
  attempts: AttemptRow[];
  tests: StudentTest[];
  announcements: Announcement[];
  attemptsError: string | null;
};

function displayName(user: User | null | undefined): string {
  if (!user) return "student";
  const meta = (user.user_metadata ?? {}) as {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    name?: string;
  };
  const full =
    [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim() ||
    (meta.full_name ?? "").trim() ||
    (meta.name ?? "").trim();
  return full.split(/\s+/)[0] || (user.email ?? "").split("@")[0] || "student";
}

export default function Dashboard() {
  const { user } = useAuth();
  const name = displayName(user);

  const { loading, data, error } = useAsync<DashData>(async () => {
    const [attempts, tests, announcements] = await Promise.allSettled([
      listMyAttempts(30),
      listPublishedTests(60),
      fetchAnnouncements(),
    ]);
    return {
      attempts: attempts.status === "fulfilled" ? attempts.value : [],
      tests: tests.status === "fulfilled" ? tests.value : [],
      announcements: announcements.status === "fulfilled" ? announcements.value : [],
      attemptsError:
        attempts.status === "rejected" ? String(attempts.reason?.message ?? attempts.reason) : null,
    };
  }, [user?.id]);

  if (loading) return <Spinner label="Preparing your dashboard" />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const attempts = data?.attempts ?? [];
  const tests = data?.tests ?? [];
  const announcements = data?.announcements ?? [];
  const stats = computeStats(attempts);
  const latest = attempts[0] ?? null;

  return (
    <div className="screen">
      <div className="pt-5">
        <section className="hero reveal">
          <span aria-hidden className="hero-orb hero-orb-a" />
          <span aria-hidden className="hero-orb hero-orb-b" />
          <span aria-hidden className="hero-ring" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Your practice room</span>
              <span className="pill pill-gold">NIMCET 2026</span>
            </div>

            <h1 className="hero-title mt-4">
              Hello, <em>{name}.</em>
            </h1>
            <p className="hero-sub mt-2.5">
              One paper at a time. Sharpen the weak spots, protect the streak and
              walk into exam day already calm.
            </p>

            <div className="hero-actions">
              <Link to="/mocks" className="btn btn-primary">
                Start a mock
                <Icon name="arrowUpRight" size={16} />
              </Link>
              <Link to="/profile" className="btn btn-ghost">
                Profile
              </Link>
            </div>

            <div className="hero-strip">
              <span className="meta-chip">
                <Icon name="book" size={13} />
                <span className="mono">{tests.length}</span> papers live
              </span>
              <span className="meta-chip">
                <Icon name="clock" size={13} />
                <span className="mono">{attempts.length}</span> attempts
              </span>
            </div>
          </div>
        </section>
      </div>

      {data?.attemptsError ? (
        <div className="mt-4">
          <Alert kind="error">{data.attemptsError}</Alert>
        </div>
      ) : null}

      <SectionHead
        title="Performance"
        action={
          <Link to="/profile" className="section-link">
            History
            <Icon name="chevronRight" size={13} />
          </Link>
        }
      />

      {stats ? (
        <div className="stat-grid reveal" style={{ "--d": "60ms" } as React.CSSProperties}>
          <Stat icon="trophy" label="Best score" value={String(stats.best)} note="your highest attempt" />
          <Stat
            icon="target"
            label="Accuracy"
            value={stats.accuracy === null ? "—" : String(stats.accuracy)}
            suffix={stats.accuracy === null ? undefined : "%"}
            note="correct ÷ answered"
          />
          <Stat icon="layers" label="Average" value={String(stats.average)} note={`${stats.count} attempts tracked`} />
          <Stat
            icon="hash"
            label="Questions"
            value={String(stats.attemptedQuestions)}
            note="attempted in total"
          />
        </div>
      ) : (
        <div className="empty reveal">
          <span className="empty-icon">
            <Icon name="target" size={24} />
          </span>
          <p className="eyebrow">A clean slate</p>
          <h2 className="display mt-2 text-[1.5rem]">Your first scorecard is waiting.</h2>
          <p className="mt-2 max-w-[32ch] text-[13px] leading-relaxed text-muted">
            Take one paper and this space fills with your best score, accuracy and
            progress — no invented numbers, ever.
          </p>
          <Link to="/mocks" className="btn btn-primary mt-5 w-full">
            Browse mock tests
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      )}

      {latest ? (
        <div className="mt-3 reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
          <div className="latest">
            <span className="latest-score mono">{Number(latest.score) || 0}</span>
            <div className="min-w-0 flex-1">
              <p className="kicker">Last attempt</p>
              <p className="latest-title mt-1">{latest.test}</p>
              <p className="latest-meta">
                {latest.correct} correct · {latest.wrong} wrong · {latest.skipped} skipped
              </p>
            </div>
            <span className="meta-chip shrink-0">
              <Icon name="calendar" size={12} />
              {formatDate(latest.created_at)}
            </span>
          </div>
        </div>
      ) : null}

      <SectionHead
        title="Mock tests"
        action={
          <Link to="/mocks" className="section-link">
            View all
            <Icon name="chevronRight" size={13} />
          </Link>
        }
      />

      {tests.length === 0 ? (
        <div className="card card-quiet p-4 text-[13px] text-muted">
          No papers are published yet. New tests appear here automatically.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tests.slice(0, 3).map((test, index) => {
            const marks = displayMarks(test);
            const parts = partsForTest(test);
            return (
              <Link
                key={test.id}
                to={`/mocks/${test.id}/instructions`}
                className="test-card reveal"
                style={{ "--d": `${140 + index * 60}ms` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="test-index">PAPER {String(index + 1).padStart(2, "0")}</p>
                    <h3 className="test-title mt-1.5">{test.title}</h3>
                  </div>
                  <span className="test-arrow">
                    <Icon name="arrowUpRight" size={15} />
                  </span>
                </div>
                <div className="test-meta">
                  <span className="meta-chip">
                    <Icon name="hash" size={12} />
                    <span className="mono">{test.question_ids.length}</span> questions
                  </span>
                  <span className="meta-chip">
                    <Icon name="clock" size={12} />
                    <span className="mono">{displayMinutes(test)}</span> min
                  </span>
                  {marks !== null ? (
                    <span className="meta-chip">
                      <Icon name="trophy" size={12} />
                      <span className="mono">{marks}</span> marks
                    </span>
                  ) : null}
                  {parts ? (
                    <span className="meta-chip">
                      <Icon name="layers" size={12} />
                      <span className="mono">{parts.length}</span> parts
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {announcements.length > 0 ? (
        <>
          <SectionHead
            title="Notice board"
            action={<span className="kicker">{announcements.length} live</span>}
          />
          <div className="flex flex-col gap-2.5">
            {announcements.slice(0, 3).map((notice) => (
              <article key={notice.id} className="card card-quiet p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13.5px] font-bold">{notice.title}</h3>
                  <span className="kicker shrink-0">{formatDate(notice.created_at)}</span>
                </div>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[12.5px] leading-relaxed text-muted">
                  {notice.body}
                </p>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className="card card-dashed mt-5 flex items-start gap-3 p-4">
        <span className="empty-icon empty-icon-sm shrink-0">
          <Icon name="sparkles" size={18} />
        </span>
        <div>
          <p className="text-[12.5px] font-bold">The in-app paper is next.</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Question palette, part navigation and the live countdown are being built on
            the server-owned exam clock. Until then, full mocks open on the website.
          </p>
        </div>
      </div>
    </div>
  );
}
