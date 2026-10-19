import { Link, useParams } from "react-router-dom";
import { Card, ScreenTitle } from "../components/ui";

/**
 * Placeholder for results/solutions. Shows no invented scores — the real view
 * reads the server-scored result (overall + per-subject + solutions) once the
 * runner is implemented.
 */
export default function Results() {
  const { attemptId } = useParams();

  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title="Results" subtitle="Scorecard and solutions." />

      <Card>
        <span className="pill mb-2">Phase 2</span>
        <h2 className="text-sm font-semibold">Honest scorecards</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Overall score, per-subject breakdown, accuracy and question-by-question solutions render
          here from the server-computed result — never from client-side guesses.
        </p>
        {attemptId ? (
          <p className="mt-3 text-xs text-muted">
            Attempt reference: <span className="mono">{attemptId}</span>
          </p>
        ) : null}
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        <Link to="/mocks" className="btn btn-primary btn-block">
          Take another test
        </Link>
        <Link to="/dashboard" className="btn btn-ghost btn-block">
          Back home
        </Link>
      </div>
    </div>
  );
}
