import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/icons";

/**
 * Placeholder for results/solutions. Shows no invented scores — the real view
 * reads the server-scored result (overall + per-subject + solutions) once the
 * runner is implemented.
 */
export default function Results() {
  const { attemptId } = useParams();

  return (
    <div className="screen">
      <div className="mt-8 text-center">
        <span className="empty-icon empty-icon-lg mx-auto">
          <Icon name="trophy" size={28} />
        </span>
        <p className="eyebrow mt-5">Scorecards</p>
        <h1 className="display mt-2 text-[2.2rem] leading-[1.03]">
          Honest results, <em>every time.</em>
        </h1>
        <p className="mx-auto mt-3 max-w-[34ch] text-[13px] leading-relaxed text-muted">
          Overall score, subject-wise breakdown, accuracy and question-by-question
          solutions will render here from the server-computed result — never from
          client-side guesses.
        </p>
      </div>

      {attemptId ? (
        <p className="mt-5 text-center text-[10px] text-faint">
          Attempt reference <span className="mono text-muted">{attemptId.slice(0, 8)}…</span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <Link to="/mocks" className="btn btn-primary btn-block">
          Take another test
          <Icon name="arrowRight" size={16} />
        </Link>
        <Link to="/dashboard" className="btn btn-ghost btn-block">
          Back home
        </Link>
      </div>
    </div>
  );
}
