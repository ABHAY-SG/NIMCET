import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiGet } from "../lib/api";
import { Card, ScreenTitle } from "../components/ui";

type Announcement = { id: string; title: string; body: string; created_at: string };

export default function Dashboard() {
  const { user } = useAuth();
  const name = user?.email?.split("@")[0] ?? "student";

  // Real read of the existing student endpoint, using the app's bearer token.
  // Failures are non-fatal: the dashboard simply omits the section.
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  useEffect(() => {
    let active = true;
    apiGet<{ rows: Announcement[] }>("/api/student/announcements")
      .then((res) => {
        if (active) setAnnouncements(Array.isArray(res.rows) ? res.rows : []);
      })
      .catch(() => {
        if (active) setAnnouncements([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title={`Hi, ${name}`} subtitle="Your NIMCET prep, on the go." />

      <div className="grid grid-cols-2 gap-3">
        <Link to="/mocks" className="card p-4 active:scale-[0.98] transition-transform">
          <div className="text-2xl">📝</div>
          <div className="mt-2 text-sm font-semibold">Mock Tests</div>
          <div className="text-xs text-muted">Full-length papers</div>
        </Link>
        <Link to="/profile" className="card p-4 active:scale-[0.98] transition-transform">
          <div className="text-2xl">👤</div>
          <div className="mt-2 text-sm font-semibold">Profile</div>
          <div className="text-xs text-muted">Account & settings</div>
        </Link>
      </div>

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Account</h2>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="truncate font-medium">{user?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Status</dt>
            <dd className="font-medium text-ok">Verified</dd>
          </div>
        </dl>
      </Card>

      {announcements && announcements.length > 0 ? (
        <div className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-muted">Announcements</h2>
          <div className="flex flex-col gap-2">
            {announcements.map((a) => (
              <Card key={a.id}>
                <h3 className="text-sm font-semibold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="mt-5 border-dashed">
        <span className="pill mb-2">Phase 2</span>
        <p className="text-sm text-muted">
          Performance analytics, attempt history and daily streaks will appear here once the exam
          engine is wired up.
        </p>
      </Card>
    </div>
  );
}
