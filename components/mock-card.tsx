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

function Stat({ icon, iconStyle, value, label }: { icon: string; iconStyle: React.CSSProperties; value: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "var(--pill)" }}>
      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px]" style={iconStyle}>{icon}</span>
      <span className="mono text-[13px] font-extrabold" style={{ color: "var(--text)" }}>{value}</span>
      <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{label}</span>
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
  icon = "🏆",
  iconBg = "#fef3c7",
  iconFg = "#d97706",
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
  icon?: string;
  iconBg?: string;
  iconFg?: string;
  onStart: () => void;
}) {
  return (
    <article
      className="group flex flex-col rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 12px 32px -20px rgba(30, 41, 82, 0.35)" }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: iconBg, color: iconFg, border: `1px solid color-mix(in srgb, ${iconFg} 22%, transparent)` }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold leading-snug" style={{ color: "var(--text)" }}>{title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {tag && (
              <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>{tag}</span>
            )}
            <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: free ? "#15803d" : "#b45309" }}>
              {free ? "Free" : "Premium"}
            </span>
            {attempted > 0 && (
              <span className="mono rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--pill)", color: "var(--muted)" }}>
                Attempted ×{attempted}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat icon="📘" iconStyle={{ background: "#dbeafe", color: "#1d4ed8" }} value={questions} label="Questions" />
        <Stat icon="🕒" iconStyle={{ background: "#ede9fe", color: "#6d28d9" }} value={`${minutes} min`} label="Duration" />
        <Stat icon="🏆" iconStyle={{ background: "#fef3c7", color: "#b45309" }} value={Math.round(marks * 10) / 10} label="Marks" />
        <Stat icon="🎯" iconStyle={{ background: "#dcfce7", color: "#15803d" }} value={difficulty} label="Level" />
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white transition-transform hover:-translate-y-px"
        style={{ background: "linear-gradient(120deg, #0f766e, #115e59)", boxShadow: "0 14px 30px -16px rgba(15, 118, 110, 0.75)" }}
      >
        {attempted > 0 ? <RetryIcon /> : <PlayIcon />}
        {attempted > 0 ? "Reattempt" : "Start Test"}
      </button>
    </article>
  );
}
