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
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pb-8 pt-[5vh]">
      {/* Background dim */}
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
        aria-labelledby={dialogId}
        aria-busy={false}
        className="relative w-full rounded-[22px] max-w-[90%] max-h-[90vh] mx-auto bg-[var(--bg)] border border-[var(--border)] shadow-xl"
        style={{ boxShadow: "0 24px 80px -24px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <h3 id={dialogId} className="truncate text-[16px] font-extrabold tracking-tight">
              NimCuet Android App
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-md hover:bg-[var(--muted)] transition-colors"
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">
            Full-length timed mocks at your fingertips — the same NIMCET + CUET PG
            papers, same clock, same negative marking, instantly scored.
          </p>

          <ul className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <li className="flex items-start gap-3">
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4l10 8L12 26" />
                <path d="M12 2v4l-10 8L12 26" />
              </svg>
              <span>Full-length timed mocks</span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m8 14 4 4 4-4" />
              </svg>
              <span>Instant scorecards</span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <line x1={10} y1={8} x2={10} y2={12} />
                <line x1={14} y1={8} x2={14} y2={12} />
              </svg>
              <span>Same papers, same pattern</span>
            </li>
          </ul>
        </div>

        <div className="flex justify-end p-5 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="mr-2 px-4 py-2 text-sm font-medium"
            style={{ color: "var(--muted)" }}
          >
            Maybe Later
          </button>
          <a
            href={APK_PATH}
            download
            className="px-4 py-2 text-sm font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            Download APK
          </a>
        </div>
      </div>
    </div>
  );
}