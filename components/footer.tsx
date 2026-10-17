"use client";
import Reveal from "@/components/reveal";

function XBadge() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="18" fill="#000" />
      <g transform="translate(9.5,9.5) scale(0.73)" fill="#fff">
        <path d="M18.9 2H22l-6.8 7.8L23.3 22h-6.3l-4.9-6.4L6.5 22H3.4l7.3-8.3L1 2h6.5l4.4 5.9L18.9 2zm-1.1 18h1.7L7.4 3.9H5.6L17.8 20z" />
      </g>
    </svg>
  );
}

function IGBadge() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <defs>
        <linearGradient id="igbg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f9ce34" />
          <stop offset="0.5" stopColor="#ee2a7b" />
          <stop offset="1" stopColor="#6228d7" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r="18" fill="url(#igbg)" />
      <g transform="translate(6,6)" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="16.9" cy="7.1" r="1.5" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}

function LIBadge() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="18" fill="#0A66C2" />
      <g transform="translate(9,9) scale(0.75)" fill="#fff">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
      </g>
    </svg>
  );
}

function GHBadge() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="18" fill="#fff" />
      <g transform="translate(6,6)" fill="#000">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </g>
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <g transform="scale(1.5)">
        <path fill="#229ED9" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </g>
    </svg>
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
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
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
                ["X", <XBadge key="x" />, "https://x.com/ABHAY_ICW"],
                ["Instagram", <IGBadge key="ig" />, "https://www.instagram.com/abh_.a.y/"],
                ["LinkedIn", <LIBadge key="li" />, "https://www.linkedin.com/in/abhay-singh-gurjar-incodingworld"],
                ["GitHub", <GHBadge key="gh" />, "https://github.com/ABHAY-SG"],
                ["Telegram", <TelegramIcon key="tg" />, "https://t.me/ABHAYSG"],
              ].map(([label, icon, href]) => (
                <a
                  key={label as string}
                  href={href as string}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label as string}
                  title={label as string}
                  className="soc block h-9 w-9"
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
          <a href="#top" className="nlink font-bold">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
