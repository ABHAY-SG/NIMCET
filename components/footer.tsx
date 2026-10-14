"use client";
import Reveal from "@/components/reveal";

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23.3 22h-6.3l-4.9-6.4L6.5 22H3.4l7.3-8.3L1 2h6.5l4.4 5.9L18.9 2zm-1.1 18h1.7L7.4 3.9H5.6L17.8 20z" /></svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" /></svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="4" /><path d="m10.5 9.8 4.5 2.2-4.5 2.2z" fill="currentColor" stroke="none" /></svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4 3 11.2l6.3 2.4L11.5 20l3.9-4.9 5.6 2.1z" /><path d="M9.3 13.6 21 4" /></svg>
  );
}

const COLS: Array<{ title: string; links: Array<[string, string]> }> = [
  { title: "Explore", links: [["Home", "/"], ["Exams", "/#exams"], ["How it works", "/#how"], ["Pricing", "/#pricing"]] },
  { title: "Company", links: [["About Us", "/#about"], ["FAQs", "/#faqs"], ["Contact Us", "/#contact"], ["Full FAQ", "/faq"]] },
  { title: "Legal", links: [["Terms & Conditions", "/terms"], ["Privacy Policy", "/privacy"]] },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--nav-bg) 80%, transparent)" }}>
      <div className="mx-auto w-full max-w-6xl px-4">
        <Reveal>
          <div className="flex flex-col items-center justify-between gap-4 py-7 sm:flex-row">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="NimCuet" className="site-logo block h-8 w-auto" />
              <p className="text-[11px] font-medium tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                Prepare smart. <span style={{ color: "var(--accent)" }}>Perform better.</span>
              </p>
            </div>
            <div className="flex gap-2">
              {[
                ["X", <XIcon key="x" />, "#000", "#fff"],
                ["Instagram", <InstagramIcon key="ig" />, "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)", "#fff"],
                ["YouTube", <YoutubeIcon key="yt" />, "#ff0000", "#fff"],
                ["Telegram", <TelegramIcon key="tg" />, "#229ed9", "#fff"],
              ].map(([label, icon, bg, fg]) => (
                <a
                  key={label as string}
                  href="#"
                  aria-label={label as string}
                  title={label as string}
                  className="soc flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: bg as string, color: fg as string }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal>
          <div className="grid gap-8 py-8 sm:grid-cols-3" style={{ borderTop: "1px solid var(--border)" }}>
            {COLS.map((c) => (
              <div key={c.title}>
                <div className="text-[12px] font-bold uppercase" style={{ letterSpacing: "0.14em" }}>{c.title}</div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {c.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="nlink">{label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
        <div
          className="flex flex-col items-center justify-between gap-2 py-4 text-xs sm:flex-row"
          style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}
        >
          <span>© 2026 NimCuet • Made in India</span>
          <span className="italic">“Consistency beats intensity — one mock at a time.”</span>
          <a href="#top" className="nlink font-bold" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
