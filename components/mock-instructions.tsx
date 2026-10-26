"use client";

import { useState, type CSSProperties } from "react";
import { NAV_LEGEND, PALETTE } from "@/lib/cbt-nav";

export type SchemeRow = {
  label: string;
  count: number;
  marks: number;
  plus: number;
  minus: number;
  minutes?: number;
  /** Optional 0-based timed part index when one part holds several subjects. */
  part?: number;
  /** True when this subject shares its timed part's clock with another subject. */
  shared?: boolean;
  /** Optional clarification shown under the row (e.g. Part III mixes two subjects). */
  note?: string;
};

const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)",
};

function fmtMarks(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className="mono mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: "var(--pill)", color: "var(--accent)" }}
      >
        •
      </span>
      <span>{children}</span>
    </li>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--pill)", border: "1px solid var(--border)" }}>
      <span className="mono block text-[10px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>{label}</span>
      <span className="dash-display block text-xl font-extrabold leading-6" style={{ color: "var(--text)" }}>{value}</span>
      <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{note}</span>
    </div>
  );
}

export default function MockInstructions({
  title,
  minutes,
  count,
  totalMarks,
  scheme,
  timed,
  instructions,
  serverMode = false,
  onStart,
}: {
  title: string;
  minutes: number;
  count: number;
  totalMarks: number;
  scheme: SchemeRow[];
  timed: boolean;
  instructions?: string;
  /** True for server-enforced template exams: no early submit, resume via server. */
  serverMode?: boolean;
  onStart: () => void;
}) {
  const [page, setPage] = useState<1 | 2>(1);
  const [agreed, setAgreed] = useState(false);
  const showTime = scheme.some((s) => s.minutes != null && s.minutes > 0);
  const partCount = scheme.some((s) => s.part !== undefined)
    ? new Set(scheme.map((s) => s.part)).size
    : scheme.length;
  const hasSharedPart = scheme.some((s) => s.shared);

  const general: string[] = [
    timed
      ? partCount === scheme.length
        ? `The paper is divided into ${partCount} timed sections — ${scheme.map((s) => s.label).join(", ")} — with a combined clock of ${minutes} minutes.`
        : `The paper is divided into ${partCount} timed parts across ${scheme.length} subject sections — ${scheme.map((s) => s.label).join(", ")} — with a combined clock of ${minutes} minutes.`
      : `The paper has ${count} questions to be answered in ${minutes} minutes.`,
    timed
      ? hasSharedPart
        ? "Mathematics opens first. Each timed part runs on its own clock; a future part stays locked until its official window begins. A part locks the moment its time ends and the next one opens automatically — you cannot return to a finished part. Subjects that share a part also share that part's clock."
        : "Mathematics opens first. Each timed part runs on its own clock; a future part stays locked until its official window begins. A part locks the moment its time ends and the next one opens automatically — you cannot return to a finished part."
      : "The countdown starts as soon as you begin and never pauses, even if you switch tabs or refresh the page.",
    `Every question is a multiple-choice question with 4 options — exactly one option is correct.`,
    "Unattempted questions score 0. There is no negative marking for leaving a question blank.",
    serverMode
      ? "Refreshing or reopening the page is safe: your answers and the section clock live on the server, so you resume exactly where you left off."
      : "Refreshing or reopening the page is safe: your answers, your position and the running clock are restored automatically.",
    serverMode
      ? "The test submits itself when the final section's time ends — there is no early submission, so use every minute you are given."
      : "The test submits itself when the time ends — you can also submit early with the Submit Test button. Answers cannot be changed after submission.",
    "This is an original NIMCET-style practice paper, not the official question paper.",
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="overflow-hidden rounded-2xl" style={CARD}>
        {/* Identity strip */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0 flex-1">
            <p className="mono text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.16em" }}>BEFORE YOU START</p>
            <h2 className="dash-display truncate text-lg font-extrabold tracking-tight" style={{ color: "var(--text)" }} title={title}>{title}</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="mono rounded px-2 py-1 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>{count} Questions</span>
            <span className="mono rounded px-2 py-1 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>{minutes} Minutes</span>
            <span className="mono rounded px-2 py-1 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>{fmtMarks(totalMarks)} Marks</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2.5 px-5 py-3" style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--pill) 55%, transparent)" }}>
          <span className="flex items-center gap-2">
            <span aria-hidden className="mono flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>1</span>
            <span className="text-[12.5px] font-bold" style={{ color: "var(--text)" }}>Instructions</span>
          </span>
          <span aria-hidden className="h-px w-6" style={{ background: "var(--border)" }} />
          <span className="flex items-center gap-2">
            <span aria-hidden className="mono flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold" style={page === 2 ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--pill)", color: "var(--muted)", border: "1px solid var(--border)" }}>2</span>
            <span className="text-[12.5px] font-bold" style={page === 2 ? { color: "var(--text)" } : { color: "var(--muted)" }}>Exam details</span>
          </span>
        </div>

        {page === 1 ? (
          <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
            <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
              <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
                General Instructions
              </h3>
              <ol className="mt-3 space-y-2.5 text-[13px] leading-6" style={{ color: "var(--muted)" }}>
                {general.map((b, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden className="mono mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--pill)", color: "var(--accent)" }}>{i + 1}</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ol>
              {instructions && instructions.trim() !== "" && (
                <div
                  className="mt-4 rounded-xl px-3.5 py-3"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 7%, transparent)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="mono text-[10px] font-bold" style={{ color: "var(--accent)", letterSpacing: "0.14em" }}>
                    PAPER-SPECIFIC INSTRUCTIONS
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-6" style={{ color: "var(--text)" }}>
                    {instructions.trim()}
                  </p>
                </div>
              )}
            </div>
            <div
              className="rounded-xl p-4 sm:p-5"
              style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}
            >
              <h3
                id="navigational-instructions"
                className="text-[15px] font-extrabold tracking-tight"
                style={{ color: "#1e293b" }}
              >
                Navigational Instructions
              </h3>
              <ul
                aria-labelledby="navigational-instructions"
                className="mt-3 space-y-2.5 text-[13px] leading-6"
                style={{ color: "#334155" }}
              >
                <li className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1 h-4 w-4 shrink-0 rounded-[4px] bg-blue-700 ring-2 ring-blue-700 ring-offset-2"
                  />
                  <span>
                    <strong className="font-extrabold" style={{ color: "#1e293b" }}>Current question</strong>{" "}
                    always has the indigo fill and ring, even when it is answered or marked.
                  </span>
                </li>
                {NAV_LEGEND.map((item) => (
                  <li key={item.key} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1 h-4 w-4 shrink-0 rounded-[4px]"
                      style={PALETTE[item.key]}
                    />
                    <span>
                      <strong className="font-extrabold" style={{ color: "#1e293b" }}>{item.label}</strong>{" "}
                      — {item.help}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg px-3 py-2 text-[12px] leading-5" style={{ background: "#f1f5f9", color: "#475569" }}>
                The current cell also carries small corner markers for answered (green) and
                marked-for-review (amber) states, so the active question is never ambiguous.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">
            <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>
              Exam Details
            </h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Tile label="Duration" value={`${minutes} min`} note={timed ? (partCount === scheme.length ? `${partCount} timed sections` : `${partCount} timed parts · ${scheme.length} subjects`) : "single continuous clock"} />
              <Tile label="Questions" value={String(count)} note="4 options each" />
              <Tile label="Maximum marks" value={fmtMarks(totalMarks)} note="scored on the server" />
            </div>

            {scheme.length > 0 && (
              <div className="mt-4">
                <p className="mono text-[10px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>SECTION-WISE MARKING SCHEME</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-[13px]">
                    <thead>
                      <tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
                        <th className="py-1.5 pr-3 text-left font-bold">SECTION</th>
                        <th className="px-2 py-1.5 text-right font-bold">QUESTIONS</th>
                        <th className="px-2 py-1.5 text-right font-bold">MARKS</th>
                        <th className={showTime ? "px-2 py-1.5 text-right font-bold" : "py-1.5 pl-3 text-right font-bold"}>MARKING</th>
                        {showTime && <th className="py-1.5 pl-3 text-right font-bold">TIME</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {scheme.map((s) => (
                        <tr key={s.label} style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                          <td className="py-2 pr-3 font-semibold">
                            {s.label}
                            {s.note ? (
                              <span className="block text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                                {s.note}
                              </span>
                            ) : null}
                          </td>
                          <td className="mono px-2 py-2 text-right">{s.count}</td>
                          <td className="mono px-2 py-2 text-right">{fmtMarks(s.marks)}</td>
                          <td className="mono px-2 py-2 text-right">+{s.plus} / {s.minus}</td>
                          {showTime && <td className="mono py-2 pl-3 text-right">{s.minutes} min{s.shared ? " (shared)" : ""}</td>}
                        </tr>
                      ))}
                      <tr style={{ borderTop: "1.5px solid var(--border)", color: "var(--text)" }}>
                        <td className="py-2 pr-3 font-extrabold">Total</td>
                        <td className="mono px-2 py-2 text-right font-extrabold">{count}</td>
                        <td className="mono px-2 py-2 text-right font-extrabold">{fmtMarks(totalMarks)}</td>
                        <td className="mono px-2 py-2 text-right font-extrabold">per {partCount === scheme.length ? "section" : "part"}</td>
                        {showTime && <td className="mono py-2 pl-3 text-right font-extrabold">{minutes} min</td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <ul className="mt-4 space-y-2.5 text-[13px] leading-6" style={{ color: "var(--muted)" }}>
              <Bullet>Every correct answer adds the section&apos;s positive mark; every wrong answer deducts its negative mark.</Bullet>
              <Bullet>Unattempted questions are worth 0 — skipping is never penalised.</Bullet>
              <Bullet>The clock does not pause, even if you get pulled away from the screen.</Bullet>
              <Bullet>
                {serverMode
                  ? "Your paper is scored on the server when the final section ends — the browser never decides your marks."
                  : "Your paper is scored on the server the moment you submit — the browser never decides your marks."}
              </Bullet>
            </ul>

            <label
              className="mt-4 flex cursor-pointer select-none items-start gap-3 rounded-xl px-3.5 py-3"
              style={agreed
                ? { border: "1.5px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 7%, transparent)" }
                : { border: "1px solid var(--border)", background: "var(--pill)" }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-[13px] font-semibold leading-5" style={{ color: "var(--text)" }}>
                I have read all the instructions and I am ready to start the test.
              </span>
            </label>
          </div>
        )}

        {/* Bottom bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--pill) 40%, transparent)" }}>
          <span className="mono text-[10px] font-bold" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>STEP {page} OF 2</span>
          <div className="ml-auto flex items-center gap-2">
            {page === 2 && (
              <button
                type="button"
                onClick={() => setPage(1)}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-px"
                style={{ border: "1px solid var(--border)", color: "var(--text)" }}
              >
                ← Previous
              </button>
            )}
            {page === 1 ? (
              <button
                type="button"
                onClick={() => setPage(2)}
                className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px"
                style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
              >
                Next →
              </button>
            ) : (
              <>
                {!agreed && (
                  <span className="mono hidden text-[10px] font-bold sm:block" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
                    TICK THE BOX TO ENABLE
                  </span>
                )}
                <button
                  type="button"
                  onClick={onStart}
                  disabled={!agreed}
                  className="cursor-pointer rounded-xl px-6 py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-px disabled:cursor-default disabled:opacity-40 disabled:hover:translate-y-0"
                  style={{ background: "linear-gradient(120deg, #0f766e, #115e59)" }}
                >
                  Start Test →
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
