"use client";

import { useState } from "react";
import AndroidAppModal from "@/components/android-app-modal";

/**
 * The section CTA opens the same dialog the hero orb does, instead of firing the
 * APK download on the first tap. One flow, one place to explain the sideload
 * step before the browser starts a file transfer.
 */
export default function ApkDownloadCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="cta-glow apk-download"
      >
        <svg
          width={17}
          height={17}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          focusable="false"
        >
          <path d="M12 3v11" />
          <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
          <path d="M4 18.5v.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.5" />
        </svg>
        Download for Android
      </button>
      <AndroidAppModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
