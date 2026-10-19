import { Link, useParams } from "react-router-dom";
import { Card, ScreenTitle } from "../components/ui";

/**
 * Placeholder for the exam runner. It deliberately renders NO questions and NO
 * timer: a fake exam UI would be misleading, and the real runner must speak to
 * the server-owned session (/api/student/attempt/start → part → answers →
 * complete) so timing and scoring can never be tampered with client-side.
 */
export default function Runner() {
  const { sessionId } = useParams();

  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title="Test Runner" subtitle="Full-screen exam experience." />

      <Card>
        <span className="pill mb-2">Coming soon</span>
        <h2 className="text-sm font-semibold">Server-authoritative runner</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Question palette, part navigation, mark-for-review and the live countdown are built on the
          existing attempt APIs. The server owns <code>started_at</code> and each part&apos;s
          remaining time, so the countdown cannot be gamed by changing the device clock.
        </p>
        {sessionId ? (
          <p className="mt-3 text-xs text-muted">
            Session reference: <span className="mono">{sessionId}</span>
          </p>
        ) : null}
      </Card>

      <Link to="/mocks" className="btn btn-ghost btn-block mt-4">
        Back to Mock Tests
      </Link>
    </div>
  );
}
