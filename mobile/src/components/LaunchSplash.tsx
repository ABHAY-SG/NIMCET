import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { LogoMark } from "./brand";

const MIN_VISIBLE_MS = 2650;
const MAX_VISIBLE_MS = 5200;
const LEAVE_MS = 620;

/**
 * Launch experience: an art-directed brand reveal that plays while the saved
 * session is restored. It waits for auth readiness (never flashes the login
 * screen to a signed-in student) but always releases after MAX_VISIBLE_MS so a
 * slow network cannot trap the app. Tap to skip after the reveal lands.
 */
export default function LaunchSplash({ onDone }: { onDone: () => void }) {
  const { ready } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const min = window.setTimeout(() => setMinElapsed(true), reduced ? 900 : MIN_VISIBLE_MS);
    const max = window.setTimeout(() => setMaxElapsed(true), MAX_VISIBLE_MS);
    const skip = window.setTimeout(() => setCanSkip(true), reduced ? 300 : 1400);
    return () => {
      window.clearTimeout(min);
      window.clearTimeout(max);
      window.clearTimeout(skip);
    };
  }, []);

  useEffect(() => {
    if (leaving) return;
    if (!minElapsed) return;
    if (!ready && !maxElapsed) return;
    setLeaving(true);
  }, [leaving, minElapsed, ready, maxElapsed]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(finish, LEAVE_MS);
    return () => window.clearTimeout(t);
    // finish is intentionally stable for the lifetime of the splash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const skip = () => {
    if (!canSkip || leaving) return;
    setLeaving(true);
  };

  const word = "NimCuet";

  return (
    <div
      className="launch-splash"
      data-leaving={leaving ? "true" : "false"}
      role="status"
      aria-label="NimCuet is starting"
      onClick={skip}
    >
      <span aria-hidden className="splash-aurora splash-aurora-a" />
      <span aria-hidden className="splash-aurora splash-aurora-b" />
      <span aria-hidden className="splash-aurora splash-aurora-c" />
      <span aria-hidden className="splash-grid" />

      <button type="button" className="splash-skip" onClick={skip} tabIndex={-1} aria-hidden>
        Skip
      </button>

      <div className="splash-stage">
        <div className="splash-mark-wrap">
          <span aria-hidden className="halo halo-1" />
          <span aria-hidden className="halo halo-2" />
          <span aria-hidden className="halo halo-3" />
          <span aria-hidden className="orbit-dot" />
          <span aria-hidden className="splash-spark spark-a" />
          <span aria-hidden className="splash-spark spark-b" />
          <span aria-hidden className="splash-spark spark-c" />
          <LogoMark size={96} glow className="splash-mark" />
        </div>

        <h1 className="splash-word" aria-label="NimCuet">
          {word.split("").map((letter, i) => (
            <span
              key={`${letter}-${i}`}
              aria-hidden
              className="splash-letter"
              style={{
                animationDelay: `${560 + i * 70}ms`,
                color: i >= 3 ? "var(--gold)" : undefined,
                fontStyle: i >= 3 ? "italic" : "normal",
                fontWeight: i >= 3 ? 400 : undefined,
              }}
            >
              {letter}
            </span>
          ))}
        </h1>

        <p className="splash-tag">The art of exam preparation</p>
        <span aria-hidden className="splash-rule" />

        <div aria-hidden className="splash-progress">
          <span />
        </div>
        <p className="splash-status">
          Preparing your practice room <span className="breathe">·</span>
        </p>
      </div>

      <p className="splash-foot">NIMCET · CUET PG MCA</p>
    </div>
  );
}
