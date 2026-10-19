import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAsync } from "../lib/useAsync";
import {
  computeStats,
  fetchAnnouncements,
  formatDate,
  listMyAttempts,
  listPublishedTests,
  type Announcement,
  type AttemptRow,
  type StudentTest,
} from "../lib/data";
import { Alert, Card, ScreenTitle, Spinner } from "../components/ui";

type DashData = {
  attempts: AttemptRow[];
  tests: StudentTest[];
  announcements: Announcement[];
  attemptsError: string | null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const name = user?.email?.split("@")[0] ?? "student";

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

  if (loading) return <Spinner label="Loading your dashboard…" />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const stats = computeStats(data?.attempts ?? []);
  const latest = (data?.attempts ?? [])[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title={`Hi, ${name}`} subtitle="Your NIMCET prep, on the go." />

      <div className="grid grid-cols-2 gap-3">
        <Link to="/mocks" className="card p-4 active:scale-[0.98] transition-transform">
          <div className="text-2xl">📝</div>
          <div className="mt-2 text-sm font-semibold">Mock Tests</div>
          <div className="text-xs text-muted">
            {data?.tests.length ?? 0} published
          </div>
        </Link>
        <Link to="/profile" className="card p-4 active:scale-[0.98] transition-transform">
          <div className="text-2xl">👤</div>
          <div className="mt-2 text-sm font-semibold">Profile</div>
          <div className="text-xs text-muted">Account & settings</div>
        </Link>
      </div>

      {data?.attemptsError ? (
        <div className="mt-3">
          <Alert kind="error">{data.attemptsError}</Alert>
        </div>
      ) : null}

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Performance</h2>
        {stats ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Attempts" value={String(stats.count)} />
            <Stat label="Best score" value={String(stats.best)} />
            <Stat label="Average" value={String(stats.average)} />
            <Stat label="Accuracy" value={stats.accuracy === null ? "—" : `${stats.accuracy}%`} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No attempts yet. Take a mock test and your scores, accuracy and history will appear here.
          </p>
        )}
        {latest ? (
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
            Last attempt: <span className="text-fg">{latest.test}</span> ·{" "}
            <span className="mono">{Number(latest.score) || 0}</span> on {formatDate(latest.created_at)}
          </p>
        ) : null}
      </Card>

      {data && data.announcements.length > 0 ? (
        <div className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-muted">Announcements</h2>
          <div className="flex flex-col gap-2">
            {data.announcements.map((a) => (
              <Card key={a.id}>
                <h3 className="text-sm font-semibold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
                <p className="mt-2 text-xs text-muted">{formatDate(a.created_at)}</p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="mt-5 border-dashed">
        <span className="pill mb-2">Coming soon</span>
        <p className="text-sm text-muted">
          The in-app exam runner and per-question solutions are the next step. Until then, full mock
          tests can be taken on the website.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-pill px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mono mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
