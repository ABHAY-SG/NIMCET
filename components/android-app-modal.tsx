"use client";

import { useEffect, useRef, useState, useId } from "react";
import { APK_PATH } from "@/lib/android-app";

export default function AndroidAppModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  // Track this modal instance to prevent cross-talk between modals
  const modalStackRef = useRef<(symbol | null)[]>([]);
  const tokenRef = useRef<symbol | null>(null);

  useEffect(() => {
    tokenRef.current = Symbol("android-app-modal");
    modalStackRef.current.push(tokenRef.current);
  });

  // Close behavior: Escape key, backdrop click, and onClose prop
  useEffect(() => {
    if (!open) {
      // Cleanup when closing
      if (tokenRef.current) {
        const idx = modalStackRef.current.indexOf(tokenRef.current);
        if (idx >= 0) modalStackRef.current.splice(idx, 1);
      }
      document.body.style.overflow = "";
      return;
    }

    // Open: set up focus trap and body overflow
    const onKey = (e: KeyboardEvent) => {
      const latestToken = modalStackRef.current[modalStackRef.current.length - 1];
      if (latestToken !== tokenRef.current) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = ref.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Auto-focus first focusable element after paint
    const t = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const auto =
        root.querySelector<HTMLElement>("[data-autofocus]") ??
        root.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
        ) ??
        root.querySelector<HTMLElement>('button:not([disabled]), a[href]');
      auto?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (tokenRef.current) {
        const i = modalStackRef.current.lastIndexOf(tokenRef.current);
        if (i >= 0) modalStackRef.current.splice(i, 1);
      }
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="download-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="download-modal-scrim fixed inset-0 cursor-default"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        className="download-modal-card relative mx-auto flex max-h-[min(90dvh,760px)] w-full max-w-[440px] flex-col overflow-hidden rounded-[28px] border border-[var(--border)]"
        style={{ background: "var(--card)" }}
      >
        <div className="relative shrink-0 overflow-hidden border-b px-5 py-5 sm:px-7 sm:py-6" style={{ borderColor: "var(--border)" }}>
          <span aria-hidden className="download-modal-wash pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--accent)" }}>YOUR NEXT MOCK STARTS HERE</p>
              <h3 id={dialogId} className="display text-[1.65rem] font-semibold tracking-tight sm:text-[1.9rem]">
                Get NimCuet for Android
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="download-modal-close -mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:px-7 sm:py-6">
          <p className="mb-5 text-sm leading-relaxed sm:text-[15px]" style={{ color: "var(--muted)", fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif" }}>
            Carry your preparation with you. Get the full mock-test experience with the same real exam patterns, timing and instant scorecards — right on your Android phone.
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {["NIMCET + CUET PG", "Instant scorecards", "Free APK"].map((item) => (
              <span key={item} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--pill)", color: "var(--accent)", fontFamily: "var(--font-heading), var(--font-sans), sans-serif" }}>{item}</span>
            ))}
          </div>

          <ul className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <li className="flex items-start gap-3">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2v4l10 8L12 26" />
                <path d="M12 2v4l-10 8L12 26" />
              </svg>
              <span>Full-length timed mocks</span>
            </li>
            <li className="flex items-start gap-3">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="m8 14 4 4 4-4" />
              </svg>
              <span>Instant scorecards</span>
            </li>
            <li className="flex items-start gap-3">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <line x1={10} y1={8} x2={10} y2={12} />
                <line x1={14} y1={8} x2={14} y2={12} />
              </svg>
              <span>Same papers, same pattern</span>
            </li>
          </ul>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-end sm:px-7" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-3 text-sm font-semibold transition-colors hover:bg-[var(--pill)]"
            style={{ color: "var(--muted)" }}
          >
            Maybe later
          </button>
          <a
            href={APK_PATH}
            download
            className="cta-glow inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold shadow-lg"
            style={{ background: "var(--btn-bg)", color: "var(--btn-text)", fontFamily: "var(--font-heading), var(--font-sans), sans-serif" }}
          >
            Download Android App <span aria-hidden>↓</span>
          </a>
        </div>
      </div>
    </div>
  );
}
