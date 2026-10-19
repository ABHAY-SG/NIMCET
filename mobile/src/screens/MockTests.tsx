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
import { Alert, Placeholder, ScreenTitle, Spinner } from "../components/ui";

type MocksData = { tests: StudentTest[]; bank: BankQuestion[] };

export default function MockTests() {
  const { user } = useAuth();
  const { loading, data, error } = useAsync<MocksData>(async () => {
    const [tests, bank] = await Promise.all([
      listPublishedTests(60),
      fetchBank(300).catch(() => [] as BankQuestion[]),
    ]);
    return { tests, bank };
  }, [user?.id]);

  if (loading) return <Spinner label="Loading mock tests…" />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const tests = data?.tests ?? [];
  const plusOf = new Map((data?.bank ?? []).map((q) => [q.id, Number(q.plus) || 0]));
  const marksOf = (t: StudentTest): number | null => {
    const full = displayMarks(t);
    if (full !== null) return full;
    if (plusOf.size === 0) return null;
    return t.question_ids.reduce((s, id) => s + (plusOf.get(id) ?? 0), 0);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title="Mock Tests" subtitle="Published papers for your account." />

      {tests.length === 0 ? (
        <Placeholder
          phase="Empty"
          title="No published mock tests yet"
          body="When an administrator publishes a test it appears here automatically — same catalogue as the website."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {tests.map((t) => {
            const parts = partsForTest(t);
            const marks = marksOf(t);
            return (
              <Link key={t.id} to={`/mocks/${t.id}/instructions`} className="card block p-4 active:scale-[0.99] transition-transform">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{t.title}</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.exam}
                      {t.tag ? ` · ${t.tag}` : ""}
                    </p>
                  </div>
                  <span className="pill shrink-0">{t.free ? "Free" : "Premium"}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    <span className="mono text-fg">{t.question_ids.length}</span> questions
                  </span>
                  <span>
                    <span className="mono text-fg">{displayMinutes(t)}</span> minutes
                  </span>
                  {marks !== null ? (
                    <span>
                      <span className="mono text-fg">{marks}</span> marks
                    </span>
                  ) : null}
                  {parts ? (
                    <span>
                      <span className="mono text-fg">{parts.length}</span> timed parts
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <Placeholder
          title="In-app exam runner"
          body="Taking the paper on the phone (server-owned timer, part navigation, auto-submit) is the next milestone. Tapping a test today opens its instructions."
        />
      </div>
    </div>
  );
}
