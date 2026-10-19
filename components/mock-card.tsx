"use client";

import type { ReactNode } from "react";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-8 8s3.57 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function QuestionsIcon() {
  return (
    <svg {...iconProps} className="h-[15px] w-[15px]">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps} className="h-[15px] w-[15px]">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 1.75" />
    </svg>
  );
}

function TrophyIcon({ className = "h-[15px] w-[15px]" }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0z" />
      <path d="M8 5.5H5.5V7A2.5 2.5 0 0 0 8 9.5M16 5.5h2.5V7A2.5 2.5 0 0 1 16 9.5" />
      <path d="M12 12.5V16M9 19.5h6M10.5 16h3" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg {...iconProps} className="h-[15px] w-[15px]">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function levelTone(level: string): { fg: string; bg: string } {
  const l = level.toLowerCase();
  if (l.includes("hard") || l.includes("difficult")) return { fg: "#dc2626", bg: "color-mix(in srgb, #dc2626 13%, transparent)" };
  if (l.includes("medium") || l.includes("moderate")) return { fg: "#d97706", bg: "color-mix(in srgb, #d97706 15%, transparent)" };
  if (l.includes("easy")) return { fg: "#15803d", bg: "color-mix(in srgb, #15803d 13%, transparent)" };
  return { fg: "#64748b", bg: "color-mix(in srgb, #64748b 14%, transparent)" };
}

function toneOf(fg: string): { fg: string; bg: string } {
  return { fg, bg: `color-mix(in srgb, ${fg} 14%, transparent)` };
}

function Stat({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode;
  tone: { fg: string; bg: string };
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {icon}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="mono shrink-0 text-[15px] font-extrabold leading-none" style={{ color: "var(--text)" }}>
          {value}
        </span>
        <span className="truncate text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
          {label}
        </span>
      </span>
    </div>
  );
}

export default function MockCard({
  title,
  questions,
  minutes,
  marks,
  difficulty,
  tag,
  free,
  attempted,
  onStart,
}: {
  title: string;
  questions: number;
  minutes: number;
  marks: number;
  difficulty: string;
  tag?: string;
  free: boolean;
  attempted: number;
  onStart: () => void;
}) {
  const level = levelTone(difficulty);

  return (
    <article
      className="mock-card group relative flex flex-col overflow-hidden rounded-[20px] p-5"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 2px rgba(2, 6, 23, 0.03), 0 18px 40px -28px rgba(2, 6, 23, 0.35)",
      }}
    >
      <span aria-hidden className="mock-card-accent" />

      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
          style={{
            background: "linear-gradient(145deg, #fef3c7, #fde68a)",
            color: "#b45309",
            border: "1px solid rgba(180, 83, 9, 0.18)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 6px 14px -10px rgba(180, 83, 9, 0.7)",
          }}
        >
          <TrophyIcon className="h-[21px] w-[21px]" />
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <h3
            className="line-clamp-2 text-[17px] font-extrabold leading-[1.3] tracking-tight"
            style={{ color: "var(--text)" }}
            title={title}
          >
            {title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tag && (
              <span
                className="rounded-md px-2 py-[3px] text-[9.5px] font-bold uppercase"
                style={{
                  letterSpacing: "0.08em",
                  background: "var(--pill)",
                  color: "var(--muted)",
                }}
              >
                {tag}
              </span>
            )}
            <span
              className="rounded-md px-2 py-[3px] text-[9.5px] font-bold uppercase"
              style={{
                letterSpacing: "0.08em",
                background: free ? "rgba(21, 128, 61, 0.1)" : "rgba(180, 83, 9, 0.1)",
                color: free ? "#15803d" : "#b45309",
              }}
            >
              {free ? "Free" : "Premium"}
            </span>
            {attempted > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[9.5px] font-bold uppercase"
                style={{ letterSpacing: "0.08em", background: "var(--pill)", color: "var(--muted)" }}
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "#15803d" }} />
                Attempted ×{attempted}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Stat
          icon={<QuestionsIcon />}
          tone={toneOf("#2563eb")}
          value={questions}
          label="Questions"
        />
        <Stat
          icon={<ClockIcon />}
          tone={toneOf("#7c3aed")}
          value={minutes}
          label="Minutes"
        />
        <Stat
          icon={<TrophyIcon />}
          tone={toneOf("#d97706")}
          value={Math.round(marks * 10) / 10}
          label="Marks"
        />
        <Stat icon={<TargetIcon />} tone={level} value={difficulty} label="Level" />
      </div>

      <div className="mt-auto pt-5">
        <div aria-hidden className="h-px w-full" style={{ background: "var(--border)" }} />
        <button
          type="button"
          onClick={onStart}
          className="cta-glow mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white transition-colors"
          style={{
            background: "linear-gradient(120deg, #0f5d55, #0b3f3a)",
            boxShadow: "0 14px 28px -18px rgba(11, 63, 58, 0.85)",
          }}
        >
          {attempted > 0 ? <RetryIcon /> : <PlayIcon />}
          {attempted > 0 ? "Reattempt" : "Start Test"}
        </button>
      </div>
    </article>
  );
}
