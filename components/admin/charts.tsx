"use client";
import { useId } from "react";

// Dependency-free SVG charts. All colors come from theme CSS variables (or
// explicit palette entries), all values come from real API data, and every
// data point exposes a native <title> tooltip.

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function LineChart({
  labels,
  values,
  height = 180,
  color = "var(--accent)",
  suffix = "",
  className,
}: {
  labels: string[];
  values: number[];
  height?: number;
  color?: string;
  suffix?: string;
  className?: string;
}) {
  const rawId = useId();
  const gid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const w = 640;
  const h = height;
  const padL = 38;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const pts = values.length ? values : [0];
  const max = Math.max(1, ...pts);
  const n = Math.max(labels.length, 2);
  const x = (i: number) => padL + (i * (w - padL - padR)) / (n - 1);
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${padL},${h - padB} ${line} ${x(pts.length - 1).toFixed(1)},${h - padB}`;
  const tickStep = Math.max(1, Math.ceil(labels.length / 7));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cx("w-full", className)} role="img" aria-label="Line chart">
      <defs>
        <linearGradient id={`area${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padL} x2={w - padR} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeWidth="1" />
      ))}
      <text x={padL - 6} y={y(max) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
        {Math.round(max)}
      </text>
      <text x={padL - 6} y={h - padB + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
        0
      </text>
      <polygon points={area} fill={`url(#area${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill={color}>
          <title>{`${labels[i] ?? ""}: ${v}${suffix}`}</title>
        </circle>
      ))}
      {labels.map((l, i) =>
        i % tickStep === 0 ? (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
            {l.length > 10 ? l.slice(5) : l}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function BarChart({
  labels,
  values,
  height = 180,
  color = "var(--accent)",
  suffix = "",
  className,
}: {
  labels: string[];
  values: number[];
  height?: number;
  color?: string;
  suffix?: string;
  className?: string;
}) {
  const w = 640;
  const h = height;
  const padL = 38;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const pts = values.length ? values : [0];
  const max = Math.max(1, ...pts);
  const innerW = w - padL - padR;
  const step = innerW / pts.length;
  const bw = Math.max(2, Math.min(26, step * 0.62));
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const tickStep = Math.max(1, Math.ceil(labels.length / 7));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cx("w-full", className)} role="img" aria-label="Bar chart">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padL} x2={w - padR} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeWidth="1" />
      ))}
      <text x={padL - 6} y={y(max) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
        {Math.round(max)}
      </text>
      <text x={padL - 6} y={h - padB + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
        0
      </text>
      {pts.map((v, i) => {
        const cx0 = padL + step * i + step / 2;
        const top = y(v);
        const bh = Math.max(v > 0 ? 2 : 0, h - padB - top);
        return (
          <rect key={i} x={cx0 - bw / 2} y={top} width={bw} height={bh} rx={3} fill={color} opacity={0.9}>
            <title>{`${labels[i] ?? ""}: ${v}${suffix}`}</title>
          </rect>
        );
      })}
      {labels.map((l, i) =>
        i % tickStep === 0 ? (
          <text
            key={i}
            x={padL + step * i + step / 2}
            y={h - 8}
            textAnchor="middle"
            fontSize="9.5"
            fill="var(--muted)"
          >
            {l.length > 10 ? l.slice(5) : l}
          </text>
        ) : null
      )}
    </svg>
  );
}

export type DonutSlice = { label: string; value: number; color?: string };

const FALLBACK = ["var(--accent)", "#7c3aed", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444"];

export function Donut({
  slices,
  size = 168,
  thickness = 22,
  centerLabel,
  centerSub,
  className,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
  className?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className={cx("flex flex-wrap items-center gap-x-6 gap-y-3", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--pill)" strokeWidth={thickness} fill="none" />
          {total > 0 &&
            slices.map((s, i) => {
              const frac = Math.max(0, s.value) / total;
              if (frac === 0) return null;
              const len = Math.max(0, frac * c - (slices.filter((x) => x.value > 0).length > 1 ? 2 : 0));
              const off = -acc * c;
              acc += frac;
              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color ?? FALLBACK[i % FALLBACK.length]}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={off}
                  strokeLinecap="butt"
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              );
            })}
        </g>
        {centerLabel !== undefined && (
          <text x="50%" y="47%" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)">
            {centerLabel}
          </text>
        )}
        {centerSub !== undefined && (
          <text x="50%" y="61%" textAnchor="middle" fontSize="10" fill="var(--muted)">
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="min-w-[150px] flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color ?? FALLBACK[i % FALLBACK.length] }}
            />
            <span className="flex-1" style={{ color: "var(--muted)" }}>
              {s.label}
            </span>
            <span className="font-bold">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
