import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandLockup } from "./brand";

/**
 * Shared frame for the two auth screens. Keeps the brand, atmosphere and
 * switch affordance identical so login and signup feel like one experience.
 */
export default function AuthShell({
  mode,
  title,
  accent,
  subtitle,
  children,
  footer,
}: {
  mode: "in" | "up";
  title: string;
  accent: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const other = mode === "in" ? "/signup" : "/login";
  const otherLabel = mode === "in" ? "Create account" : "Log in";

  return (
    <div className="auth-screen">
      <span aria-hidden className="auth-aurora auth-aurora-a" />
      <span aria-hidden className="auth-aurora auth-aurora-b" />
      <span aria-hidden className="splash-grid" />

      <header className="auth-top">
        <BrandLockup size={36} />
        <Link to={other} className="auth-switch-link">
          {otherLabel}
        </Link>
      </header>

      <main className="auth-main">
        <p className="eyebrow reveal">NIMCET · CUET PG MCA</p>
        <h1 className="auth-title reveal" style={{ "--d": "60ms" } as React.CSSProperties}>
          {title} <em>{accent}</em>
        </h1>
        <p className="auth-sub reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
          {subtitle}
        </p>

        <div className="auth-card reveal" style={{ "--d": "180ms" } as React.CSSProperties}>
          {children}
        </div>

        {footer ? <div className="auth-foot reveal" style={{ "--d": "240ms" } as React.CSSProperties}>{footer}</div> : null}
      </main>

      <p className="auth-legal safe-bottom">
        Built for serious NIMCET aspirants. Your practice history stays tied to
        your account.
      </p>
    </div>
  );
}
