"use client";

export type DashView = "home" | "mock" | "history" | "contact" | "pricing" | "feedback";

type Item = { label: string; icon: string; view?: DashView; href?: string; soon?: boolean };

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "Practice",
    items: [
      { label: "Start mock", icon: "▶", view: "mock" },
      { label: "Test history", icon: "🕘", view: "history" },
      { label: "My profile", icon: "👤", href: "/dashboard/profile" },
    ],
  },
  {
    title: "Library",
    items: [
      { label: "Courses", icon: "🎬", soon: true },
      { label: "Roadmap", icon: "🗺", soon: true },
      { label: "Study Materials", icon: "📖", soon: true },
    ],
  },
  {
    title: "Help",
    items: [
      { label: "Contact", icon: "✉", view: "contact" },
      { label: "Pricing", icon: "$", view: "pricing" },
      { label: "Feedback", icon: "💬", view: "feedback" },
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
  const cls = `flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold ${
    active ? "text-white" : ""
  }`;
  const activeStyle = active
    ? { background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }
    : undefined;
  const inner = (
    <>
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: "var(--pill)" }}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
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
      <button
        type="button"
        onClick={() => { onSelect(item.view as DashView); onClose(); }}
        className={`${cls} cursor-pointer transition-transform hover:-translate-y-px`}
        style={activeStyle}
      >
        {inner}
      </button>
    );
  }
  return (
    <a href={item.href} className={`${cls} transition-transform hover:-translate-y-px`}>
      {inner}
    </a>
  );
}

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
          className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-extrabold transition-transform hover:-translate-y-px ${
            view === "home" ? "text-white" : ""
          }`}
          style={
            view === "home"
              ? { background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #7c3aed))" }
              : { border: "1px solid var(--border)" }
          }
        >
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: "rgba(255,255,255,0.16)" }}>
            ⌂
          </span>
          Home
        </button>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="px-3.5 pb-1.5 text-[13px] font-extrabold" style={{ color: "var(--text)" }}>
            {g.title}
          </div>
          <div className="grid gap-0.5">
            {g.items.map((it) => (
              <Row key={it.label} item={it} active={it.view !== undefined && it.view === view} onSelect={onSelect} onClose={onClose} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <aside
        className="fixed bottom-4 left-4 top-20 z-40 hidden w-64 overflow-hidden rounded-[22px] md:block"
        style={{ background: "color-mix(in srgb, var(--nav-bg) 70%, transparent)", border: "1px solid var(--border)" }}
      >
        {body}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 cursor-default" style={{ background: "rgba(0,0,0,0.45)" }} />
          <aside
            className="absolute bottom-0 left-0 top-0 w-72 max-w-[85vw] overflow-hidden rounded-r-[22px]"
            style={{ background: "var(--bg)", borderRight: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between p-4 pb-0">
              <span className="text-sm font-extrabold">Menu</span>
              <button type="button" onClick={onClose} aria-label="Close menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-base"
                style={{ border: "1px solid var(--border)" }}>✕</button>
            </div>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
