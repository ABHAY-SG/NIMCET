import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/** Quiet brand loader used while a session or screen data is restored. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[54vh] flex-col items-center justify-center gap-4">
      <span
        aria-hidden
        className="grid h-12 w-12 place-items-center rounded-full"
        style={{
          border: "1px solid var(--line)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 18px 36px -24px rgba(244,162,97,0.55)",
        }}
      >
        <span
          className="h-5 w-5 animate-spin rounded-full"
          style={{
            border: "2px solid rgba(244,162,97,0.18)",
            borderTopColor: "var(--accent)",
          }}
        />
      </span>
      {label ? <p className="kicker">{label}</p> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "quiet" | "dashed";
}) {
  const extra =
    variant === "quiet" ? "card-quiet" : variant === "dashed" ? "card-dashed" : "";
  return <section className={`card p-4 ${extra} ${className}`}>{children}</section>;
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="screen-head">
      <div>
        <p className="eyebrow">NimCuet</p>
        <h1 className="screen-title mt-2">{title}</h1>
        {subtitle ? <p className="screen-sub">{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  );
}

/**
 * Honest placeholder: this screen is not implemented yet. It states exactly
 * what will live here so nothing is faked (no mock scores, no fake questions).
 */
export function Placeholder({
  title,
  body,
  phase = "Coming soon",
  icon = "sparkles",
  action,
}: {
  title: string;
  body: string;
  phase?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <span className="pill mb-3">{phase}</span>
      <h2 className="display text-[1.45rem]">{title}</h2>
      <p className="mt-2 max-w-[34ch] text-[13px] leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5 w-full">{action}</div> : null}
    </div>
  );
}

export function Alert({
  kind,
  children,
  shake = false,
}: {
  kind: "error" | "ok";
  children: ReactNode;
  shake?: boolean;
}) {
  return (
    <div className={`alert alert-${kind} ${shake ? "alert-shake" : ""}`} role="status" aria-live="polite">
      <Icon name={kind === "error" ? "alert" : "check"} size={16} strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

export function Stat({
  icon,
  label,
  value,
  suffix,
  note,
}: {
  icon: IconName;
  label: string;
  value: string;
  suffix?: string;
  note?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        <Icon name={icon} size={12} strokeWidth={2} />
        {label}
      </div>
      <div className="stat-value">
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </div>
      {note ? <p className="mt-1 text-[10px] text-faint">{note}</p> : null}
    </div>
  );
}

export function Meta({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="meta-chip">
      <Icon name={icon} size={12} strokeWidth={1.9} />
      {children}
    </span>
  );
}
