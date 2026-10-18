"use client";
import { useEffect } from "react";

export type DashView = "home" | "mock" | "builder" | "history" | "contact" | "pricing" | "feedback";

type Item = { label: string; icon: React.ReactNode; view?: DashView; href?: string; soon?: boolean };

function I({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  home: (<I><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v11h14V10" /></I>),
  play: (<I><path d="M8 5v14l11-7z" /></I>),
  history: (<I><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>),
  user: (<I><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></I>),
  film: (<I><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" /></I>),
  map: (<I><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></I>),
  book: (<I><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13" /></I>),
  mail: (<I><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></I>),
  tag: (<I><path d="M3 12V4h8l9 9-8 8-9-9z" /><circle cx="8" cy="9" r="1.5" /></I>),
  chat: (<I><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1.5-5.3A8.5 8.5 0 1 1 21 11.5z" /></I>),
  flask: (<I><path d="M9 3h6" /><path d="M10 3v6.2l-5.3 9.4A1.8 1.8 0 0 0 6.3 21h11.4a1.8 1.8 0 0 0 1.6-2.4L14 9.2V3" /><path d="M7.5 15h9" /></I>),
};

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "NIMCET",
    items: [
      { label: "NIMCET Mock", icon: ICONS.play, view: "mock" },
      { label: "NIMCET PYQ", icon: ICONS.history, soon: true },
    ],
  },
  {
    title: "Test Builder",
    items: [
      { label: "Create Custom Mock", icon: ICONS.flask, view: "builder" },
    ],
  },
  {
    title: "Library",
    items: [
      { label: "Courses", icon: ICONS.film, soon: true },
      { label: "Roadmap", icon: ICONS.map, soon: true },
      { label: "Study Materials", icon: ICONS.book, soon: true },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Contact", icon: ICONS.mail, view: "contact" },
      { label: "Pricing", icon: ICONS.tag, view: "pricing" },
      { label: "Feedback", icon: ICONS.chat, view: "feedback" },
    ],
  },
];

function Row({
  item,
  active,
  onSelect,
  onClose,
}: {
  item: Item;
  active: boolean;
  onSelect: (v: DashView) => void;
  onClose: () => void;
}) {
  const cls = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-transform hover:-translate-y-px`;
  const style = active
    ? { background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))", color: "var(--accent-fg)", boxShadow: "0 12px 28px -12px var(--accent)" }
    : undefined;
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={active ? { background: "color-mix(in srgb, var(--accent-fg) 22%, transparent)", color: "var(--accent-fg)" } : { background: "var(--pill)", color: "var(--accent)" }}
      >
        {item.icon}
      </span>
      <span className="flex-1" style={active ? undefined : { color: "var(--text)" }}>{item.label}</span>
      {item.soon && (
        <span className="mono rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: "var(--pill)", color: "var(--muted)" }}>
          SOON
        </span>
      )}
    </>
  );
  if (item.soon) {
    return (
      <span aria-disabled className={`${cls} cursor-default opacity-70`} title="Coming soon">
        {inner}
      </span>
    );
  }
  if (item.view) {
    return (
      <button type="button" onClick={() => { onSelect(item.view as DashView); onClose(); }} className={`${cls} cursor-pointer`} style={style}>
        {inner}
      </button>
    );
  }
  return (
    <a href={item.href} className={cls} style={style}>
      {inner}
    </a>
  );
}

const PANEL_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  boxShadow: "0 32px 70px -30px rgba(30, 41, 82, 0.35)",
};

export default function DashSide({
  mobileOpen,
  onClose,
  view,
  onSelect,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  view: DashView;
  onSelect: (v: DashView) => void;
}) {
  // Escape closes the mobile drawer, matching the backdrop tap.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  const homeBtn = (
    <button
      type="button"
      onClick={() => { onSelect("home"); onClose(); }}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold transition-transform hover:-translate-y-px"
      style={
        view === "home"
          ? { background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))", color: "var(--accent-fg)", boxShadow: "0 12px 28px -12px var(--accent)" }
          : { border: "1px solid var(--border)" }
      }
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={view === "home" ? { background: "color-mix(in srgb, var(--accent-fg) 22%, transparent)", color: "var(--accent-fg)" } : { background: "var(--pill)", color: "var(--accent)" }}
      >
        {ICONS.home}
      </span>
      <span style={view === "home" ? undefined : { color: "var(--text)" }}>Home</span>
    </button>
  );

  const list = (
    <div className="noscroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1.5 text-[11px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
            {g.title}
          </div>
          <div className="grid gap-0.5">
            {g.items.map((it) => (
              <Row key={it.label} item={it} active={it.view !== undefined && it.view === view} onSelect={onSelect} onClose={onClose} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-auto rounded-2xl p-4" style={{ background: "linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))", color: "var(--accent-fg)" }}>
        <div className="text-sm font-extrabold">Keep the streak alive 🔥</div>
        <p className="mt-1 text-xs leading-5" style={{ color: "color-mix(in srgb, var(--accent-fg) 85%, transparent)" }}>
          One mock a day keeps the flame burning.
        </p>
        <button
          type="button"
          onClick={() => { onSelect("mock"); onClose(); }}
          className="mt-3 w-full cursor-pointer rounded-xl py-2.5 text-[13px] font-extrabold transition-transform hover:-translate-y-px"
          style={{ background: "var(--card)", color: "var(--text)" }}
        >
          Practice now →
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed bottom-4 left-4 top-20 z-40 hidden w-64 flex-col overflow-hidden rounded-[22px] md:flex" style={PANEL_STYLE}>
        <div className="shrink-0 border-b p-4 pb-3 backdrop-blur-2xl" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card) 85%, transparent)" }}>
          {homeBtn}
        </div>
        {list}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 cursor-default" style={{ background: "rgba(0,0,0,0.45)" }} />
          <aside className="absolute bottom-0 left-0 top-0 flex w-72 max-w-[85vw] flex-col overflow-hidden" style={PANEL_STYLE}>
            <div className="flex shrink-0 items-center justify-between p-4 pb-0">
              <span className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Menu</span>
              <button type="button" onClick={onClose} aria-label="Close menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-base"
                style={{ border: "1px solid var(--border)", color: "var(--text)" }}>✕</button>
            </div>
            <div className="shrink-0 p-4 pb-3" style={{ background: "color-mix(in srgb, var(--card) 85%, transparent)" }}>
              {homeBtn}
            </div>
            {list}
          </aside>
        </div>
      )}
    </>
  );
}
