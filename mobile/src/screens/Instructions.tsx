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
import { Alert, SectionHead, Spinner } from "../components/ui";
import { Icon } from "../components/icons";

export default function Instructions() {
  const { testId = "" } = useParams();
  const { loading, data: test, error } = useAsync(() => getTest(testId), [testId]);

  if (loading) return <Spinner label="Preparing the briefing" />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!test)
    return (
      <div className="screen">
        <div className="screen-head">
          <div>
            <p className="eyebrow">Test briefing</p>
            <h1 className="screen-title mt-2">Unavailable</h1>
          </div>
        </div>
        <Alert kind="error">This test isn&apos;t available — it may have been unpublished.</Alert>
        <Link to="/mocks" className="btn btn-ghost btn-block mt-4">
          Back to mock tests
        </Link>
      </div>
    );

  const parts = partsForTest(test);
  const marks = displayMarks(test);
  const fullMock = isFullMockTemplate(test.template);

  return (
    <div className="screen">
      <div className="pt-4">
        <Link to="/mocks" className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">
          <Icon name="chevronLeft" size={14} />
          Catalogue
        </Link>
      </div>

      <header className="mt-5 reveal">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Test briefing</span>
          <span className={`pill ${test.free ? "pill-ok" : "pill-gold"}`}>
            {test.free ? "Free" : "Premium"}
          </span>
        </div>
        <h1 className="display mt-3 text-[2.15rem] leading-[1.02]">{test.title}</h1>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
          {test.exam}
          {test.tag ? ` · ${test.tag}` : ""}
        </p>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-2 reveal" style={{ "--d": "70ms" } as React.CSSProperties}>
        <div className="stat stat-sm">
          <div className="stat-label">
            <Icon name="hash" size={11} strokeWidth={2} />
            Questions
          </div>
          <div className="stat-value">{test.question_ids.length}</div>
        </div>
        <div className="stat stat-sm">
          <div className="stat-label">
            <Icon name="clock" size={11} strokeWidth={2} />
            Minutes
          </div>
          <div className="stat-value">{displayMinutes(test)}</div>
        </div>
        <div className="stat stat-sm">
          <div className="stat-label">
            <Icon name="trophy" size={11} strokeWidth={2} />
            Marks
          </div>
          <div className="stat-value">{marks ?? "—"}</div>
        </div>
      </div>

      <SectionHead title={fullMock ? "Paper scheme" : "Timed parts"} />
      <div className="card p-4 reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
        {fullMock
          ? NIMCET_SUBJECTS.map((s, i) => (
              <div key={s.key} className="scheme-row">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="scheme-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-faint">
                      {s.count} questions · {parts?.[s.part]?.minutes ?? "—"} min
                    </p>
                  </div>
                </div>
                <span className="pill pill-gold shrink-0">
                  +{s.plus} / {s.minus}
                </span>
              </div>
            ))
          : (parts ?? []).map((p, i) => (
              <div key={p.label} className="scheme-row">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="scheme-num">{String(i + 1).padStart(2, "0")}</span>
                  <p className="truncate text-[13px] font-bold">{p.label}</p>
                </div>
                <span className="meta-chip shrink-0">
                  <span className="mono">{p.count}</span> Q · {p.minutes} min
                </span>
              </div>
            ))}
      </div>

      <SectionHead title="Before you begin" />
      <div className="card card-quiet p-4">
        <ul className="space-y-3">
          {[
            "Each timed part runs on its own clock — unused time never carries over.",
            "The server owns the clock, so refreshing cannot buy extra seconds.",
            "Wrong answers carry the negative marks shown in the scheme.",
            "The paper submits itself the moment the final part ends.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted">
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
                style={{
                  background: "rgba(233,199,126,0.1)",
                  border: "1px solid rgba(233,199,126,0.2)",
                  color: "var(--gold)",
                }}
              >
                <Icon name="check" size={11} strokeWidth={2.4} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button className="btn btn-primary btn-block" type="button" disabled>
          <Icon name="lock" size={16} />
          Begin test — runner coming soon
        </button>
        <Link to="/mocks" className="btn btn-ghost btn-block">
          Back to catalogue
        </Link>
      </div>
    </div>
  );
}
