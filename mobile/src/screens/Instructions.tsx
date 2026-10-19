import { Link, useParams } from "react-router-dom";
import { Card, ScreenTitle } from "../components/ui";

export default function Instructions() {
  const { testId } = useParams();

  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title="Test Instructions" subtitle="Read before you begin." />

      <Card>
        <h2 className="text-sm font-semibold">Before you start</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>The paper has three timed parts; each part&apos;s clock runs independently.</li>
          <li>
            Moving on from a part is permanent — you cannot return to an earlier part once its time
            ends.
          </li>
          <li>The clock is kept on the server, so refreshing or losing signal cannot buy time.</li>
          <li>Unanswered questions score zero; wrong answers carry the negative marks shown.</li>
          <li>The test submits automatically when the total time is over.</li>
        </ul>
      </Card>

      <Card className="mt-3 border-dashed">
        <span className="pill mb-2">Phase 2</span>
        <p className="text-sm text-muted">
          The live runner (server-owned timer, per-part navigation, resume) is wired to{" "}
          <code>/api/student/attempt/*</code> in the next phase. Paper reference:{" "}
          <span className="mono">{testId}</span>.
        </p>
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        <button className="btn btn-primary btn-block" type="button" disabled>
          Begin test
        </button>
        <Link to="/mocks" className="btn btn-ghost btn-block">
          Back
        </Link>
      </div>
    </div>
  );
}
