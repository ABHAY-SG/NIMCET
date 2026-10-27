"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";

function levelTone(level: string): { fg: string; bg: string; border: string } {
  const l = level.toLowerCase();
  if (l.includes("hard") || l.includes("difficult")) {
    return { fg: "var(--dash-danger)", bg: "var(--dash-danger-soft)", border: "rgba(220,38,38,.16)" };
  }
  if (l.includes("medium") || l.includes("moderate")) {
    return { fg: "var(--dash-warning)", bg: "var(--dash-warning-soft)", border: "rgba(180,83,9,.16)" };
  }
  if (l.includes("easy")) {
    return { fg: "var(--dash-success)", bg: "var(--dash-success-soft)", border: "rgba(21,128,61,.16)" };
  }
  return { fg: "var(--muted)", bg: "var(--dash-surface-muted)", border: "var(--dash-line)" };
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px]" style={{ background: "var(--dash-surface-muted)", color: "var(--muted)" }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="mono block truncate text-[12.5px] font-bold leading-tight" style={{ color: "var(--text)" }}>{value}</span>
        <span className="block truncate text-[9.5px] font-medium" style={{ color: "var(--muted)" }}>{label}</span>
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
    <article className="mock-card dash-card group relative flex flex-col overflow-hidden p-4 sm:p-[18px]">
      <span aria-hidden className="mock-card-accent" />

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="dash-icon-tile shrink-0 transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-[1.03]"
          style={{ width: 40, height: 40 }}
        >
          <Trophy size={19} strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-[1.4] tracking-[-0.012em]" style={{ color: "var(--text)" }} title={title}>
            {title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {tag && <span className="dash-chip !px-2 !py-0.5 !text-[9px]">{tag}</span>}
            <span className={free ? "dash-chip dash-chip-success !px-2 !py-0.5 !text-[9px]" : "dash-chip !px-2 !py-0.5 !text-[9px]"}>
              {free ? "Free" : "Premium"}
            </span>
            {attempted > 0 && (
              <span className="dash-chip !px-2 !py-0.5 !text-[9px]">
                <CheckCircle2 size={10} style={{ color: "var(--dash-success)" }} /> {attempted}×
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-[10px] border p-3" style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}>
        <Stat icon={<FileQuestion size={13} />} value={questions} label="Questions" />
        <Stat icon={<Clock3 size={13} />} value={`${minutes}m`} label="Duration" />
        <Stat icon={<Trophy size={13} />} value={Math.round(marks * 10) / 10} label="Marks" />
        <Stat
          icon={<BarChart3 size={13} />}
          value={<span style={{ color: level.fg }}>{difficulty}</span>}
          label="Level"
        />
      </div>

      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={onStart}
          className="dash-btn dash-btn-primary w-full"
          aria-label={`${attempted > 0 ? "Reattempt" : "Start"} ${title}`}
        >
          {attempted > 0 ? <RotateCcw size={14} /> : <Play size={14} fill="currentColor" />}
          {attempted > 0 ? "Reattempt test" : "Start test"}
        </button>
      </div>
    </article>
  );
}
