"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";

function levelTone(level: string): { fg: string; bg: string; border: string } {
  const l = level.toLowerCase();
  if (l.includes("hard") || l.includes("difficult")) {
    return { fg: "var(--dash-danger)", bg: "var(--dash-danger-soft)", border: "rgba(197,48,48,.16)" };
  }
  if (l.includes("medium") || l.includes("moderate")) {
    return { fg: "var(--dash-warning)", bg: "var(--dash-warning-soft)", border: "rgba(163,90,7,.16)" };
  }
  if (l.includes("easy")) {
    return { fg: "var(--dash-success)", bg: "var(--dash-success-soft)", border: "rgba(15,122,68,.16)" };
  }
  return { fg: "var(--muted)", bg: "var(--dash-surface-muted)", border: "var(--dash-line)" };
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: { fg: string; bg: string; border: string };
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] border"
        style={tone
          ? { background: tone.bg, borderColor: tone.border, color: tone.fg }
          : { background: "var(--dash-surface)", borderColor: "var(--dash-line)", color: "var(--muted)" }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="dash-num block truncate text-[12.5px] font-bold leading-tight" style={{ color: tone?.fg ?? "var(--text)" }}>{value}</span>
        <span className="block truncate text-[9px] font-semibold uppercase" style={{ color: "var(--muted)", letterSpacing: ".06em" }}>{label}</span>
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
  typeLabel,
  free,
  attempted,
  onStart,
  exam,
  statusLabel,
}: {
  title: string;
  questions: number;
  minutes: number;
  marks?: number;
  difficulty?: string;
  tag?: string;
  /** Optional paper type shown when marks/level are unavailable (e.g. PYQ). */
  typeLabel?: string;
  free: boolean;
  attempted: number;
  onStart: () => void;
  /** Optional category label shown above the title (e.g. NIMCET). */
  exam?: string;
  /** Optional status copy override for the footer. */
  statusLabel?: string;
}) {
  const level = difficulty ? levelTone(difficulty) : null;
  const taken = attempted > 0;

  return (
    <article
      className="dash-test-card group relative flex flex-col overflow-hidden p-4 sm:p-[18px]"
      data-state={taken ? "attempted" : free ? "free" : "premium"}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="dash-icon-tile dash-icon-tile-brand shrink-0 transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-[1.03]"
          style={{ width: 40, height: 40 }}
        >
          <Trophy size={19} strokeWidth={1.8} />
        </span>

        <div className="flex flex-wrap justify-end gap-1">
          {free ? (
            <span className="dash-chip dash-chip-success !px-2 !py-0.5 !text-[9px]">Free access</span>
          ) : (
            <span className="dash-chip dash-chip-brand !px-2 !py-0.5 !text-[9px]">
              <Sparkles size={9} /> Premium
            </span>
          )}
          {taken && (
            <span className="dash-chip dash-chip-accent !px-2 !py-0.5 !text-[9px]">
              <CheckCircle2 size={9} /> {attempted}×
            </span>
          )}
        </div>
      </div>

      <div className="mt-3.5 min-w-0 flex-1">
        <div className="dash-eyebrow truncate">{exam || tag || "Full-length mock"}</div>
        <h3
          className="mt-1 line-clamp-2 text-[14.5px] font-semibold leading-[1.4] tracking-[-0.012em]"
          style={{ color: "var(--text)", fontFamily: "var(--font-display), var(--font-sans), sans-serif" }}
          title={title}
        >
          {title}
        </h3>
      </div>

      <div
        className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-[12px] border p-3"
        style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}
      >
        <Stat icon={<FileQuestion size={13} />} value={questions} label="Questions" />
        <Stat icon={<Clock3 size={13} />} value={`${minutes}m`} label="Duration" />
        {marks !== undefined && difficulty && level ? (
          <>
            <Stat icon={<Trophy size={13} />} value={Math.round(marks * 10) / 10} label="Marks" />
            <Stat icon={<BarChart3 size={13} />} value={difficulty} label="Level" tone={level} />
          </>
        ) : (
          <>
            <Stat icon={<CheckCircle2 size={13} />} value={attempted > 0 ? `${attempted}×` : "—"} label="Attempts" />
            {typeLabel ? (
              <Stat icon={<Layers size={13} />} value={typeLabel} label="Type" />
            ) : (
              <Stat icon={<Sparkles size={13} />} value={free ? "Free" : "Premium"} label="Access" />
            )}
          </>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: taken ? "var(--dash-success)" : free ? "var(--accent)" : "var(--dash-line-strong)" }}
          />
          <span className="truncate">
            {statusLabel ? statusLabel : taken ? "Attempted · ready to revisit" : "Not attempted yet"}
          </span>
        </span>
        <button
          type="button"
          onClick={onStart}
          className={`dash-btn dash-btn-sm shrink-0 ${taken ? "dash-btn-secondary" : "dash-btn-primary"}`}
          aria-label={`${taken ? "Reattempt" : "Start"} ${title}`}
        >
          {taken ? <RotateCcw size={13} /> : <Play size={13} fill="currentColor" />}
          {taken ? "Reattempt" : "Start"}
        </button>
      </div>
    </article>
  );
}
