import { Link, useParams } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import {
  NIMCET_SUBJECTS,
  displayMarks,
  displayMinutes,
  getTest,
  isFullMockTemplate,
  partsForTest,
} from "../lib/data";
import { Alert, Card, ScreenTitle, Spinner } from "../components/ui";

export default function Instructions() {
  const { testId = "" } = useParams();
  const { loading, data: test, error } = useAsync(() => getTest(testId), [testId]);

  if (loading) return <Spinner label="Loading test…" />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!test)
    return (
      <div className="mx-auto w-full max-w-md">
        <ScreenTitle title="Test Instructions" />
        <Alert kind="error">This test isn&apos;t available — it may have been unpublished.</Alert>
        <Link to="/mocks" className="btn btn-ghost btn-block mt-4">
          Back to Mock Tests
        </Link>
      </div>
    );

  const parts = partsForTest(test);
  const marks = displayMarks(test);
  const fullMock = isFullMockTemplate(test.template);

  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title="Test Instructions" subtitle={test.title} />

      <Card>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <span className="mono text-fg">{test.question_ids.length}</span> questions
          </span>
          <span>
            <span className="mono text-fg">{displayMinutes(test)}</span> minutes
          </span>
          {marks !== null ? (
            <span>
              <span className="mono text-fg">{marks}</span> marks
            </span>
          ) : null}
          <span>{test.free ? "Free" : "Premium"}</span>
        </div>
      </Card>

      {fullMock ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Paper scheme</h2>
          <ul className="mt-2 divide-y divide-line">
            {NIMCET_SUBJECTS.map((s) => (
              <li key={s.key} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted">
                    {s.count} Q · {parts?.[s.part]?.minutes ?? "—"} min
                  </div>
                </div>
                <span className="mono text-xs text-muted">
                  +{s.plus} / {s.minus}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : parts ? (
        <Card className="mt-3">
          <h2 className="text-sm font-semibold">Timed parts</h2>
          <ul className="mt-2 divide-y divide-line">
            {parts.map((p) => (
              <li key={p.label} className="flex items-center justify-between py-2">
                <span className="text-sm font-medium">{p.label}</span>
                <span className="mono text-xs text-muted">
                  {p.count} Q · {p.minutes} min
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-3">
        <h2 className="text-sm font-semibold">Before you start</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>Each timed part&apos;s clock runs independently; unused time does not carry over.</li>
          <li>The clock is kept on the server, so refreshing cannot buy extra time.</li>
          <li>Wrong answers carry the negative marks shown above.</li>
          <li>The test submits automatically when the total time is over.</li>
        </ul>
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        <button className="btn btn-primary btn-block" type="button" disabled>
          Begin test (coming soon)
        </button>
        <Link to="/mocks" className="btn btn-ghost btn-block">
          Back
        </Link>
      </div>
    </div>
  );
}
