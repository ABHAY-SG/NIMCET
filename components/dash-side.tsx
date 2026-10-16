"use client";

export type DashView = "home" | "mock" | "history" | "contact" | "pricing" | "feedback";

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
};

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "Practice",
    items: [
      { label: "Start mock", icon: ICONS.play, view: "mock" },
      { label: "Test history", icon: ICONS.history, view: "history" },
      { label: "My profile", icon: ICONS.user, href: "/dashboard/profile" },
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
  const cls = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-all hover:-translate-y-px ${
    active ? "" : "hover:bg-white/10"
  }`;
  const style = active
    ? { background: "#ffffff", color: "#1e2952", boxShadow: "0 12px 28px -12px rgba(0,0,0,0.5)" }
    : { color: "rgba(255,255,255,0.82)" };
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={active ? { background: "rgba(30,41,82,0.08)" } : { background: "rgba(255,255,255,0.1)" }}
      >
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.soon && (
        <span className="mono rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
          SOON
        </span>
      )}
    </>
  );
  if (item.soon) {
    return (
      <span aria-disabled className={`${cls} cursor-default opacity-70`} style={style} title="Coming soon">
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
  background: "linear-gradient(180deg, #141b34 0%, #1c2450 60%, #232c63 100%)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 32px 70px -30px rgba(10, 15, 35, 0.8)",
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
  const body = (
    <div className="noscroll flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div>
        <button
          type="button"
          onClick={() => { onSelect("home"); onClose(); }}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold transition-transform hover:-translate-y-px ${
            view === "home" ? "" : "hover:bg-white/10"
          }`}
          style={
            view === "home"
              ? { background: "#ffffff", color: "#1e2952", boxShadow: "0 12px 28px -12px rgba(0,0,0,0.5)" }
              : { color: "rgba(255,255,255,0.85)" }
          }
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={view === "home" ? { background: "rgba(30,41,82,0.08)" } : { background: "rgba(255,255,255,0.1)" }}
          >
            {ICONS.home}
          </span>
          Home
        </button>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1.5 text-[11px] font-extrabold uppercase" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.18em" }}>
            {g.title}
          </div>
          <div className="grid gap-0.5">
            {g.items.map((it) => (
              <Row key={it.label} item={it} active={it.view !== undefined && it.view === view} onSelect={onSelect} onClose={onClose} />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-auto rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
        <div className="text-sm font-extrabold text-white">Keep the streak alive 🔥</div>
        <p className="mt-1 text-xs leading-5" style={{ color: "rgba(255,255,255,0.7)" }}>
          One mock a day keeps the flame burning.
        </p>
        <button
          type="button"
          onClick={() => { onSelect("mock"); onClose(); }}
          className="mt-3 w-full cursor-pointer rounded-xl bg-white py-2.5 text-[13px] font-extrabold transition-transform hover:-translate-y-px"
          style={{ color: "#1e2952" }}
        >
          Practice now →
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed bottom-4 left-4 top-20 z-40 hidden w-64 overflow-hidden rounded-[22px] md:block" style={PANEL_STYLE}>
        {body}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 cursor-default" style={{ background: "rgba(0,0,0,0.45)" }} />
          <aside className="absolute bottom-0 left-0 top-0 w-72 max-w-[85vw] overflow-hidden" style={PANEL_STYLE}>
            <div className="flex items-center justify-between p-4 pb-0">
              <span className="text-sm font-extrabold text-white">Menu</span>
              <button type="button" onClick={onClose} aria-label="Close menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-base text-white"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }}>✕</button>
            </div>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
