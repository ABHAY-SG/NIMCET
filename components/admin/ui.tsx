"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

// Shared admin UI kit: cards, badges, skeletons, modals, form fields,
// pagination, empty/error states and a toast system. Everything is themed
// through the site's CSS variables, so light/dark and all color themes work
// with zero per-component theming logic.

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function initialsOf(name: string): string {
  const src = (name || "").trim();
  if (!src) return "?";
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ============ layout ============

export function Card({
  children,
  className,
  style,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cx("rounded-2xl backdrop-blur-xl", className)}
      style={{
        background: "color-mix(in srgb, var(--nav-bg) 62%, transparent)",
        border: "1px solid var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <Card className={className} id={id}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-1 pt-4">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-extrabold tracking-tight">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cx("px-5 py-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "accent",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: IconName;
  tone?: "accent" | "green" | "amber" | "blue" | "violet" | "red";
}) {
  const tones: Record<string, string> = {
    accent: "var(--accent)",
    green: "#10b981",
    amber: "#f59e0b",
    blue: "#0ea5e9",
    violet: "#7c3aed",
    red: "#ef4444",
  };
  const c = tones[tone];
  return (
    <Card className="group px-5 py-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono text-[10.5px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.14em" }}>
            {label}
          </div>
          <div className="mono mt-1.5 truncate text-[26px] font-extrabold leading-none">{value}</div>
          {sub && (
            <div className="mt-1.5 truncate text-[11.5px]" style={{ color: "var(--muted)" }}>
              {sub}
            </div>
          )}
        </div>
        {icon && (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: `color-mix(in srgb, ${c} 70%, var(--text))` }}
          >
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
    </Card>
  );
}

// ============ badges / states ============

export type BadgeTone = "neutral" | "green" | "red" | "amber" | "blue" | "violet";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  // Tint base hues toward the current text color so contrast holds in both
  // light and dark themes (a fixed dark green fails on a near-black card).
  const mix = (c: string, pct = 62) => `color-mix(in srgb, ${c} ${pct}%, var(--text))`;
  const styles: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: "var(--pill)", fg: "var(--muted)" },
    green: { bg: "color-mix(in srgb, #10b981 15%, transparent)", fg: mix("#10b981") },
    red: { bg: "color-mix(in srgb, #ef4444 15%, transparent)", fg: mix("#ef4444") },
    amber: { bg: "color-mix(in srgb, #f59e0b 17%, transparent)", fg: mix("#f59e0b", 48) },
    blue: { bg: "color-mix(in srgb, #0ea5e9 15%, transparent)", fg: mix("#0ea5e9") },
    violet: { bg: "color-mix(in srgb, #7c3aed 15%, transparent)", fg: mix("#7c3aed") },
  };
  const s = styles[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="var(--border)" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl", className)} style={{ background: "var(--pill)" }} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5 py-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cx("h-5", c === 0 && "w-3/4")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "book",
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "var(--pill)", color: "var(--muted)" }}
      >
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-3 text-sm font-extrabold">{title}</p>
      {hint && (
        <p className="mt-1 max-w-sm text-[12.5px] leading-5" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3.5 text-sm"
      style={{ background: "color-mix(in srgb, #ef4444 10%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 26%, transparent)" }}
      role="alert"
    >
      <span style={{ color: "#ef4444" }}>
        <Icon name="alert" size={18} />
      </span>
      <span className="min-w-0 flex-1 font-semibold">{message}</span>
      {onRetry && (
        <button type="button" className="admin-btn" onClick={onRetry}>
          <Icon name="refresh" size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  per,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  per: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * per + 1;
  const to = Math.min(total, page * per);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <span className="text-[12px]" style={{ color: "var(--muted)" }}>
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="admin-btn px-2.5"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" size={14} />
        </button>
        <span className="px-2 text-[12.5px] font-bold">
          {page} / {pages}
        </span>
        <button
          type="button"
          className="admin-btn px-2.5"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  );
}

// ============ modal / confirm ============

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = "max-w-2xl",
  busy = false,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: string;
  busy?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Keep keyboard focus inside the dialog while it is open.
      if (e.key !== "Tab") return;
      const root = ref.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog once it has painted.
    const t = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const auto =
        root.querySelector<HTMLElement>("[data-autofocus]") ??
        root.querySelector<HTMLElement>('input, textarea, select, a[href], button:not([disabled])');
      auto?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      // Return focus to whatever had it before the dialog opened.
      try {
        restore?.focus();
      } catch {}
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pb-8 pt-[5vh]">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        style={{ background: "rgba(0,0,0,0.5)" }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        className={cx("menu-in relative w-full rounded-[22px]", width)}
        style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 24px 80px -24px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <h3 id={titleId} className="truncate text-[16px] font-extrabold tracking-tight">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full"
            style={{ border: "1px solid var(--border)" }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="admin-scroll max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
  requireText,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  requireText?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const ready = !requireText || typed.trim() === requireText;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="max-w-md"
      busy={busy}
      footer={
        <>
          <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={cx("admin-btn", tone === "danger" ? "admin-btn-danger" : "admin-btn-primary")}
            onClick={onConfirm}
            disabled={busy || !ready}
          >
            {busy && <Spinner size={13} />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-6">{message}</div>
      {requireText && (
        <div className="mt-4">
          <Field label={`Type “${requireText}” to confirm`}>
            <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={requireText} autoFocus />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ============ forms ============

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.08em" }}>
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] font-semibold" style={{ color: "#ef4444" }}>
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[12px]" style={{ color: "var(--muted)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cx("admin-input", className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={cx("admin-input", className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={cx("admin-input", className)}>
      {children}
    </select>
  );
}

export function InfoRow({ label, value, mono = false }: { label: React.ReactNode; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <span className="text-[11px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.09em" }}>
        {label}
      </span>
      <span className={cx("min-w-0 break-words text-right text-[13.5px] font-semibold", mono && "mono")}>{value}</span>
    </div>
  );
}

export function Avatar({ src, name, size = 36 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar?src=${encodeURIComponent(src)}`}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, border: "1px solid var(--border)" }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold"
      style={{ width: size, height: size, background: "var(--accent)", color: "var(--accent-fg)", fontSize: Math.max(11, Math.round(size * 0.38)) }}
    >
      {initialsOf(name)}
    </span>
  );
}

// ============ toasts ============

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const ToastCtx = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const tones: Record<ToastTone, { color: string; icon: IconName }> = {
    success: { color: "#10b981", icon: "check" },
    error: { color: "#ef4444", icon: "alert" },
    info: { color: "var(--accent)", icon: "bell" },
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[320px] max-w-[90vw] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="menu-in pointer-events-auto flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-semibold"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 18px 50px -12px rgba(0,0,0,0.35)" }}
            role="status"
          >
            <span className="mt-0.5" style={{ color: tones[t.tone].color }}>
              <Icon name={tones[t.tone].icon} size={15} />
            </span>
            <span className="min-w-0 flex-1 leading-5">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
