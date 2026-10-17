"use client";
import { useEffect, useRef, useState } from "react";

// Animated number for async stats: eases from the previously displayed value
// to the new one whenever `value` changes (e.g. cloud stats landing after
// load). Non-numeric input renders the fallback text instead, and
// prefers-reduced-motion jumps straight to the final value.
export default function CountUp({
  value,
  decimals = 0,
  duration = 900,
  prefix = "",
  suffix = "",
  fallback = "…",
}: {
  value: number | null;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  fallback?: string;
}) {
  const [shown, setShown] = useState<number | null>(null);
  const shownRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (value === null || !Number.isFinite(value)) return;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    const from = shownRef.current;
    if (reduced || from === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (value - from) * eased;
      shownRef.current = v;
      setShown(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else shownRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  if (value === null || !Number.isFinite(value)) return <>{fallback}</>;
  const v = shown === null ? value : shown;
  return (
    <>
      {prefix}
      {decimals > 0 ? v.toFixed(decimals) : String(Math.round(v))}
      {suffix}
    </>
  );
}
