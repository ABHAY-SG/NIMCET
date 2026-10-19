import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAsync } from "../lib/useAsync";
import {
  displayMarks,
  displayMinutes,
  fetchBank,
  listPublishedTests,
  partsForTest,
  type BankQuestion,
  type StudentTest,
} from "../lib/data";
import { Alert, Placeholder, Spinner } from "../components/ui";
import { Icon } from "../components/icons";

type MocksData = { tests: StudentTest[]; bank: BankQuestion[] };
type Filter = "all" | "free" | "premium";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All papers" },
  { key: "free", label: "Free" },
  { key: "premium", label: "Premium" },
];

export default function MockTests() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const { loading, data, error } = useAsync<MocksData>(async () => {
    const [tests, bank] = await Promise.all([
      listPublishedTests(60),
      fetchBank(300).catch(() => [] as BankQuestion[]),
    ]);
    return { tests, bank };
  }, [user?.id]);

  if (loading) return <Spinner label="Loading the catalogue" />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const tests = data?.tests ?? [];
  const plusOf = new Map((data?.bank ?? []).map((q) => [q.id, Number(q.plus) || 0]));
  const marksOf = (t: StudentTest): number | null => {
    const full = displayMarks(t);
    if (full !== null) return full;
    if (plusOf.size === 0) return null;
    return t.question_ids.reduce((s, id) => s + (plusOf.get(id) ?? 0), 0);
  };

  const visible = tests.filter((t) => {
    if (filter === "free") return t.free;
    if (filter === "premium") return !t.free;
    return true;
  });

  const freeCount = tests.filter((t) => t.free).length;

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">The catalogue</p>
          <h1 className="screen-title mt-2">
            Mock <em>tests</em>
          </h1>
          <p className="screen-sub">
            {tests.length} published paper{tests.length === 1 ? "" : "s"} · {freeCount} free
          </p>
        </div>
        <span className="empty-icon empty-icon-sm shrink-0">
          <Icon name="book" size={22} />
        </span>
      </header>

      <div className="filter-row" role="tablist" aria-label="Filter mock tests">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className="filter-chip"
            data-active={filter === f.key ? "true" : "false"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tests.length === 0 ? (
          <Placeholder
            phase="Empty"
            icon="book"
            title="No papers yet"
            body="When an administrator publishes a test it appears here automatically — the same catalogue as the website."
          />
        ) : visible.length === 0 ? (
          <Placeholder
            phase="Nothing here"
            icon="layers"
            title={`No ${filter} papers`}
            body="Switch the filter to see the rest of the catalogue."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((test, index) => {
              const parts = partsForTest(test);
              const marks = marksOf(test);
              return (
                <Link
                  key={test.id}
                  to={`/mocks/${test.id}/instructions`}
                  className="test-card reveal"
                  style={{ "--d": `${index * 55}ms` } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="test-index">PAPER {String(index + 1).padStart(2, "0")}</p>
                        <span className={`pill ${test.free ? "pill-ok" : "pill-gold"}`}>
                          {test.free ? "Free" : "Premium"}
                        </span>
                      </div>
                      <h2 className="test-title mt-2">{test.title}</h2>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                        {test.exam}
                        {test.tag ? ` · ${test.tag}` : ""}
                      </p>
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
                        <span className="mono">{parts.length}</span> timed parts
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card card-dashed mt-5 flex items-start gap-3 p-4">
        <span className="empty-icon empty-icon-sm shrink-0">
          <Icon name="play" size={17} />
        </span>
        <div>
          <p className="text-[12.5px] font-bold">Instructions first, runner next</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Tap a paper to see its pattern, parts and marking. The in-app timed runner is
            the next milestone — until then, full mocks open on the website.
          </p>
        </div>
      </div>
    </div>
  );
}
