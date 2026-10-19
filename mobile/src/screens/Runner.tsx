import { Link, useParams } from "react-router-dom";
import { Icon, type IconName } from "../components/icons";

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "clock", title: "Server-owned clock", body: "Each section's window is kept on the server, so the countdown cannot be gamed." },
  { icon: "layers", title: "Part navigation", body: "Move through the paper one timed section at a time, exactly like exam day." },
  { icon: "target", title: "Mark for review", body: "Flag questions and return to them before the section closes." },
];

/**
 * Placeholder for the exam runner. It deliberately renders NO questions and NO
 * timer: a fake exam UI would be misleading, and the real runner must speak to
 * the server-owned session so timing and scoring can never be tampered with.
 */
export default function Runner() {
  const { sessionId } = useParams();

  return (
    <div className="screen">
      <div className="pt-5">
        <Link
          to="/mocks"
          className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted"
        >
          <Icon name="chevronLeft" size={14} />
          Catalogue
        </Link>
      </div>

      <div className="mt-8 text-center">
        <span className="empty-icon empty-icon-lg mx-auto">
          <Icon name="play" size={28} />
        </span>
        <p className="eyebrow mt-5">Next chapter</p>
        <h1 className="display mt-2 text-[2.2rem] leading-[1.03]">
          The paper, <em>in your pocket.</em>
        </h1>
        <p className="mx-auto mt-3 max-w-[34ch] text-[13px] leading-relaxed text-muted">
          The full-screen runner is being built on the existing server-authoritative
          attempt APIs. No fake questions and no client-side clock — only the real
          paper.
        </p>
      </div>

      <div className="card mt-7 p-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="scheme-row">
            <div className="flex min-w-0 items-start gap-3">
              <span className="scheme-num">
                <Icon name={f.icon} size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold">{f.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{f.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sessionId ? (
        <p className="mt-4 text-center text-[10px] text-faint">
          Session reference <span className="mono text-muted">{sessionId.slice(0, 8)}…</span>
        </p>
      ) : null}

      <Link to="/mocks" className="btn btn-primary btn-block mt-5">
        Back to mock tests
        <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}
