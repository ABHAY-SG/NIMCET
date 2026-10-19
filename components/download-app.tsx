import Reveal from "@/components/reveal";

// The signed release APK is committed under public/downloads and served straight
// from this site — there is no Play Store listing, so the link points at the file
// itself. Keeping the path in one place stops the button and the notes drifting.
const APK_PATH = "/downloads/NimCuet.apk";
const APK_SHA256_PATH = "/downloads/NimCuet.apk.sha256";

const POINTS: Array<[string, string]> = [
  ["Mobile-first", "a purpose-built Android UI, not the website shrunk down to a phone."],
  ["Same papers", "timed full-length mocks with real negative marking and instant scorecards."],
  ["Same account", "sign in with your existing NimCuet email and password — nothing to re-register."],
];

export default function DownloadApp() {
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

      <Reveal delay={0.08} className="mt-6">
        <div className="premium-card mx-auto flex max-w-3xl flex-col gap-6 rounded-[22px] p-6 sm:p-8 md:flex-row md:items-center md:gap-8">
          <ul className="flex-1 space-y-2.5 text-sm leading-6" style={{ color: "var(--muted)" }}>
            {POINTS.map(([title, body]) => (
              <li key={title} className="flex gap-2.5">
                <span aria-hidden style={{ color: "var(--accent)" }}>
                  ✓
                </span>
                <span>
                  <span className="font-bold" style={{ color: "var(--text)" }}>
                    {title}:
                  </span>{" "}
                  {body}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-center gap-2.5 md:w-64 md:shrink-0">
            <a
              href={APK_PATH}
              download
              className="cta-glow w-full rounded-full px-6 py-3.5 text-center text-sm font-bold"
              style={{ background: "var(--btn-bg)", color: "var(--btn-text)", boxShadow: "var(--shadow-1)" }}
            >
              Download NimCuet Android App
            </a>
            <p className="text-center text-[11px] leading-4" style={{ color: "var(--muted)" }}>
              Android 7.0+ • under 4 MB • free
            </p>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-2xl text-center text-xs leading-5" style={{ color: "var(--muted)" }}>
          <p>
            NimCuet for Android is distributed here as a{" "}
            <span className="font-bold" style={{ color: "var(--text)" }}>
              direct APK download
            </span>
            , not through the Play Store. Your browser may block the first attempt:
            open <span className="font-bold" style={{ color: "var(--text)" }}>Settings → Install unknown apps</span>,
            allow it for the browser you are using, then tap the button again and choose{" "}
            <span className="font-bold" style={{ color: "var(--text)" }}>Install</span>.
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
