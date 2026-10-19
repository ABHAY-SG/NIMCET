import { Link } from "react-router-dom";
import { Card, Placeholder, ScreenTitle } from "../components/ui";

// Official NIMCET 2026 paper structure — the same numbers the website's
// lib/nimcet-full-mock.ts enforces server-side. Shown here as static,
// factual reference (no fabricated test data).
const PATTERN = [
  { part: "Part I", subject: "Mathematics", q: 50, min: 70, marks: "+12 / −3" },
  { part: "Part II", subject: "Analytical Ability & Reasoning", q: 40, min: 30, marks: "+6 / −1.5" },
  { part: "Part III", subject: "Computer Awareness", q: 20, min: 20, marks: "+6 / −1.5" },
  { part: "Part III", subject: "General English", q: 10, min: 20, marks: "+4 / −1" },
];

export default function MockTests() {
  return (
    <div className="mx-auto w-full max-w-md">
      <ScreenTitle title="Mock Tests" subtitle="NIMCET full-length papers with a server-run clock." />

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">NIMCET 2026 Full Mock</h2>
          <span className="pill">120 Q</span>
        </div>
        <p className="mt-1 text-sm text-muted">120 minutes · 1000 marks · 3 timed parts</p>

        <ul className="mt-3 divide-y divide-line">
          {PATTERN.map((row) => (
            <li key={`${row.part}-${row.subject}`} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium">{row.subject}</div>
                <div className="text-xs text-muted">
                  {row.part} · {row.q} Q · {row.min} min
                </div>
              </div>
              <span className="mono text-xs text-muted">{row.marks}</span>
            </li>
          ))}
        </ul>

        <Link to="/mocks/nimcet-2026/instructions" className="btn btn-primary btn-block mt-4">
          View instructions
        </Link>
      </Card>

      <div className="mt-4">
        <Placeholder
          title="Your available papers"
          body="The published-test list, per-student availability and resume-an-attempt entry points load from the existing /api/student APIs here in Phase 2."
        />
      </div>
    </div>
  );
}
