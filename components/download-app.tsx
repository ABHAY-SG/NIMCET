import { statSync } from "node:fs";
import path from "node:path";
import Reveal from "@/components/reveal";
import { APK_PATH, APK_SHA256_PATH } from "@/lib/android-app";

const POINTS: Array<{ title: string; body: string; icon: React.ReactNode }> = [
  {
    title: "Mobile-first",
    body: "a purpose-built Android UI, not the website shrunk down to a phone.",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
        <rect x="6" y="2.5" width="12" height="19" rx="3" />
        <path d="M10.5 18.5h3" />
      </svg>
    ),
  },
  {
    title: "Same papers",
    body: "timed full-length mocks with real negative marking and instant scorecards.",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5.4l3.4 2" />
      </svg>
    ),
  },
  {
    title: "Same account",
    body: "sign in with your existing NimCuet email and password — nothing to re-register.",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
        <path d="M12 3l7.5 3.2v5.1c0 4.5-3.1 7.9-7.5 9.7-4.4-1.8-7.5-5.2-7.5-9.7V6.2z" />
        <path d="M9 12l2.1 2.1L15.2 10" />
      </svg>
    ),
  },
];

/** Read the real APK size at build time so the note never drifts from the file. */
function apkSizeLabel() {
  try {
    const bytes = statSync(path.join(process.cwd(), "public", "downloads", "NimCuet.apk")).size;
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  } catch {
    return "4.3 MB";
  }
}

export default function DownloadApp() {
  const size = apkSizeLabel();

  return (
    <section id="download" className="mx-auto w-full scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
      <Reveal className="text-center">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
        >
          Android App
        </p>
        <h2 className="display mt-2.5 text-3xl sm:text-4xl">
          Practise on the go with <em style={{ color: "var(--accent)" }}>NimCuet for Android.</em>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6" style={{ color: "var(--muted)" }}>
          Install the app for a full-screen mock experience — no browser tabs, no
          squinting at a desktop layout.
        </p>
      </Reveal>

      <Reveal delay={0.08} className="mt-8">
        <div className="apk-panel mx-auto max-w-4xl">
          <span aria-hidden className="apk-panel-wash" />

          <div className="relative flex flex-col gap-8 p-6 sm:p-9 md:flex-row md:items-center md:gap-10">
            {/* App preview — decorative, so the real copy stays the only thing read aloud. */}
            <div aria-hidden className="apk-phone-wrap mx-auto md:mx-0">
              <div className="apk-phone">
                <span className="apk-phone-notch" />
                <div className="apk-phone-screen">
                  <img src="/logo-gold.png" alt="" className="apk-phone-logo" />
                  <p className="apk-phone-tagline">Prepare smart. Perform better.</p>
                  <ul className="apk-phone-mocks">
                    <li>
                      <span className="apk-phone-dot" />
                      NIMCET Mock 01
                      <span className="apk-phone-pill">120Q</span>
                    </li>
                    <li>
                      <span className="apk-phone-dot" />
                      CUET PG Mock 02
                      <span className="apk-phone-pill">75Q</span>
                    </li>
                    <li>
                      <span className="apk-phone-dot" />
                      PYQ · 2024
                      <span className="apk-phone-pill">120Q</span>
                    </li>
                  </ul>
                  <span className="apk-phone-cta">Start a mock</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="display text-[1.5rem] leading-tight sm:text-[1.7rem]">
                The whole practice room, in your pocket.
              </h3>

              <ul className="mt-5 space-y-3.5">
                {POINTS.map(({ title, body, icon }) => (
                  <li key={title} className="apk-point">
                    <span aria-hidden className="apk-point-icon">
                      {icon}
                    </span>
                    <span className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                      <span className="font-bold" style={{ color: "var(--text)" }}>
                        {title}.
                      </span>{" "}
                      {body}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="apk-cta-row mt-7">
                <a href={APK_PATH} download className="cta-glow apk-download">
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
                    <path d="M12 3v11" />
                    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
                    <path d="M4 18.5v.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.5" />
                  </svg>
                  Download for Android
                </a>
                <p className="apk-meta">
                  Android 7.0+ · {size} · free
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="apk-foot mx-auto mt-5 max-w-4xl">
          <p>
            <span className="font-bold" style={{ color: "var(--text)" }}>
              Direct APK
            </span>{" "}
            — NimCuet for Android is not on the Play Store. If your browser blocks the
            first attempt, allow{" "}
            <span className="font-bold" style={{ color: "var(--text)" }}>
              Install unknown apps
            </span>{" "}
            for it, then tap the button again and choose{" "}
            <span className="font-bold" style={{ color: "var(--text)" }}>
              Install
            </span>
            .
          </p>
          <p className="mt-2">
            Verify the file after downloading against our published{" "}
            <a href={APK_SHA256_PATH} className="nlink nounder font-bold" style={{ color: "var(--accent)" }}>
              SHA-256 checksum
            </a>
            .
          </p>
        </div>
      </Reveal>
    </section>
  );
}
