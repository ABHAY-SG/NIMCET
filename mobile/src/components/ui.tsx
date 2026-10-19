import type { ReactNode } from "react";

/** Centered spinner used while the session is being restored. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      {label ? <p className="text-sm text-muted">{label}</p> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card p-4 ${className}`}>{children}</section>;
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </header>
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
}: {
  title: string;
  body: string;
  phase?: string;
}) {
  return (
    <Card className="border-dashed">
      <span className="pill mb-3">{phase}</span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </Card>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  return <div className={`alert alert-${kind}`}>{children}</div>;
}
