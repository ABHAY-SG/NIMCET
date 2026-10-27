"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Smartphone, X } from "lucide-react";
import AndroidAppIcon from "@/components/android-app-icon";
import { APK_PATH } from "@/lib/android-app";

const BENEFITS = [
  "Practise mock tests on your Android device.",
  "Access your preparation experience on the go.",
  "Enjoy a convenient mobile-friendly study experience.",
];

export default function AndroidAppModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);

    const onKey = (event: KeyboardEvent) => {
      // The dialog owns Escape and Tab while it is open. Stopping propagation
      // keeps window-level handlers (e.g. the mobile drawer) from also acting
      // on the same key press.
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      event.stopPropagation();

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node.getAttribute("aria-hidden") !== "true");
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (current === panel || !panel.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-app-modal
      className="download-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close Android app dialog"
        onClick={() => onCloseRef.current()}
        className="download-modal-scrim fixed inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="download-modal-card relative mx-auto flex max-h-[min(92dvh,720px)] w-full max-w-[470px] flex-col overflow-hidden rounded-[20px] border outline-none"
        style={{ background: "var(--dash-surface)", borderColor: "var(--dash-line)" }}
      >
        <div
          className="relative shrink-0 border-b px-5 py-5 sm:px-6"
          style={{
            borderColor: "var(--dash-line)",
            background: "color-mix(in srgb, var(--accent) 4%, var(--dash-surface))",
          }}
        >
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] border border-white/10"
              style={{
                background: "#0b1226",
                boxShadow: "0 12px 24px -16px rgba(2,6,23,.8), inset 0 1px 0 rgba(255,255,255,.09)",
              }}
            >
              <img src="/logo-gold.png" alt="" className="block h-[18px] w-auto" />
              <span
                className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border"
                style={{
                  background: "var(--dash-surface)",
                  borderColor: "var(--dash-line)",
                  color: "var(--accent)",
                }}
              >
                <AndroidAppIcon size={10} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="dash-eyebrow">NimCuet for Android</p>
              <h2
                id={titleId}
                className="dash-display mt-1 text-[1.35rem] font-bold leading-[1.18] sm:text-[1.5rem]"
                style={{ color: "var(--text)" }}
              >
                Take NimCuet With You
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              aria-label="Close dialog"
              className="dash-btn dash-btn-ghost dash-btn-icon -mr-1 -mt-1"
              style={{ width: 36, minWidth: 36, minHeight: 36 }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <p
            id={descriptionId}
            className="text-[13px] leading-[1.75]"
            style={{ color: "var(--muted)" }}
          >
            Prepare smarter, practise anywhere, and keep your exam preparation within reach.
          </p>

          <ul className="mt-4 grid gap-2.5">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-2.5 text-[12.5px] leading-[1.55]"
                style={{ color: "var(--text)" }}
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full"
                  style={{ background: "var(--dash-accent-soft)", color: "var(--accent)" }}
                >
                  <Check size={12} strokeWidth={2.6} />
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div
            className="mt-4 flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[10.5px] leading-[1.5]"
            style={{
              borderColor: "var(--dash-line)",
              background: "var(--dash-surface-muted)",
              color: "var(--muted)",
            }}
          >
            <Smartphone size={13} className="mt-px shrink-0" style={{ color: "var(--accent)" }} />
            <span>Official Android APK. Your browser may ask you to allow installs before it opens.</span>
          </div>
        </div>

        <div
          className="flex shrink-0 flex-col gap-2 border-t px-5 py-4 sm:flex-row-reverse sm:items-center sm:justify-start sm:px-6"
          style={{ borderColor: "var(--dash-line)" }}
        >
          <a
            href={APK_PATH}
            download
            className="dash-btn dash-btn-primary w-full sm:w-auto"
          >
            <Download size={15} />
            Download Android App
          </a>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="dash-btn dash-btn-secondary w-full sm:w-auto"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
