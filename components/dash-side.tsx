"use client";
import { useEffect } from "react";
import AndroidAppIcon from "@/components/android-app-icon";
import { APK_PATH } from "@/lib/android-app";

export type DashView =
  | "home"
  | "mock"
  | "nimcet-pyq"
  | "cuet-mock"
  | "cuet-pyq"
  | "builder"
  | "history"
  | "contact"
  | "pricing"
  | "feedback";

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

const HOME_ITEM: Item = { label: "Home", icon: ICONS.home, view: "home" };

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "NIMCET",
    items: [
      { label: "NIMCET Mock", icon: ICONS.play, view: "mock" },
      { label: "NIMCET PYQ", icon: ICONS.book, view: "nimcet-pyq" },
    ],
  },
  {
    title: "CUET",
    items: [
      { label: "CUET Mock", icon: ICONS.play, view: "cuet-mock" },
      { label: "CUET PYQ", icon: ICONS.book, view: "cuet-pyq" },
    ],
  },
  {
    title: "Test Builder",
    items: [
      { label: "Create Custom Mock", icon: ICONS.flask, view: "builder" },
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

// The coloured app-tile mark from the Android promo, so the sidebar keeps the
// same visual language as the install card on the landing page.
function AppTilesIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <rect x="4.5" y="2.5" width="23" height="27" rx="5.5" fill="#6b4a9e" />
      <rect x="8" y="6" width="16" height="20" rx="2" fill="#f8f5ff" />
      <rect x="9.5" y="8" width="13" height="3.2" rx="0.8" fill="#3b82f6" />
      <rect x="9.5" y="12.4" width="3.2" height="3.2" rx="0.8" fill="#f59e0b" />
      <rect x="14.4" y="12.4" width="3.2" height="3.2" rx="0.8" fill="#ef4444" />
      <rect x="19.3" y="12.4" width="3.2" height="3.2" rx="0.8" fill="#22c55e" />
      <rect x="9.5" y="16.8" width="3.2" height="3.2" rx="0.8" fill="#8b5cf6" />
      <rect x="14.4" y="16.8" width="3.2" height="3.2" rx="0.8" fill="#06b6d4" />
      <rect x="19.3" y="16.8" width="3.2" height="3.2" rx="0.8" fill="#eab308" />
      <rect x="9.5" y="21.2" width="13" height="2.8" rx="0.8" fill="#a78bfa" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: collapsed ? "rotate(180deg)" : undefined, transition: "transform .3s ease" }}
    >
      <path d="M11 6l-6 6 6 6" />
      <path d="M19 6l-6 6 6 6" />
    </svg>
  );
}

function Row({
  item,
  active,
  collapsed,
  onSelect,
  onClose,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
  onSelect: (v: DashView) => void;
  onClose: () => void;
}) {
  const cls = `group relative flex w-full items-center rounded-2xl text-left text-[13.5px] font-bold transition-all duration-200 ${
    collapsed ? "justify-center px-0 py-1.5" : "gap-3 px-2.5 py-2"
  }`;
  const style = active
    ? {
        background: "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))",
        color: "var(--accent-fg)",
        boxShadow: "0 14px 30px -18px var(--accent)",
      }
    : { color: "var(--text)" };
  const inner = (
    <>
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${
          collapsed ? "h-10 w-10" : "h-8 w-8"
        }`}
        style={
          active
            ? { background: "color-mix(in srgb, var(--accent-fg) 20%, transparent)", color: "var(--accent-fg)" }
            : { background: "var(--pill)", color: "var(--accent)" }
        }
      >
        {item.icon}
      </span>
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.soon && (
        <span className="mono rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: "var(--pill)", color: "var(--muted)" }}>
          SOON
        </span>
      )}
      {!collapsed && active && <span aria-hidden className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent-fg)" }} />}
    </>
  );
  const shared = {
    className: `${cls} ${active ? "" : "hover:bg-[var(--pill)]"} ${item.soon ? "cursor-default opacity-70" : "cursor-pointer hover:-translate-y-px"}`,
    style,
    title: collapsed ? item.label : undefined,
    "aria-label": collapsed ? item.label : undefined,
  };
  if (item.soon) {
    return <span {...shared} aria-disabled>{inner}</span>;
  }
  if (item.view) {
    return (
      <button
        type="button"
        {...shared}
        onClick={() => {
          onSelect(item.view as DashView);
          onClose();
        }}
      >
        {inner}
      </button>
    );
  }
  return (
    <a href={item.href} {...shared}>
      {inner}
    </a>
  );
}

function AppPromo({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <a
        href={APK_PATH}
        download
        title="Get Android App"
        aria-label="Download the NimCuet Android app"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl transition-transform hover:-translate-y-0.5"
        style={{
          background: "linear-gradient(160deg, #0d5c55 0%, #083f3b 100%)",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow: "0 16px 30px -18px rgba(8,63,59,0.9)",
        }}
      >
        <AppTilesIcon size={24} />
      </a>
    );
  }
  return (
    <a
      href={APK_PATH}
      download
      className="group block rounded-[22px] px-3.5 pb-3.5 pt-4 text-center transition-transform hover:-translate-y-0.5"
      style={{
        background: "linear-gradient(160deg, #0d5c55 0%, #083f3b 100%)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 22px 42px -26px rgba(8,63,59,0.95)",
      }}
    >
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.1)" }}>
        <AppTilesIcon size={26} />
      </span>
      <span className="mt-2.5 block text-[14px] font-extrabold" style={{ color: "#ffffff" }}>
        Practice Anywhere
      </span>
      <span className="mt-1 block text-[10.5px] font-medium leading-4" style={{ color: "#a9d8d1" }}>
        Get the NimCuet Android app for daily tests &amp; push alerts
      </span>
      <span
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-extrabold transition-transform group-hover:scale-[1.02]"
        style={{ background: "#fbe7a1", color: "#0b3d38" }}
      >
        <AndroidAppIcon size={13} /> Get Android App
      </span>
    </a>
  );
}

function SideBody({
  collapsed,
  view,
  onSelect,
  onClose,
  streak,
}: {
  collapsed: boolean;
  view: DashView;
  onSelect: (v: DashView) => void;
  onClose: () => void;
  streak?: { current: number; best: number };
}) {
  return (
    <>
      <div className="noscroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-2.5 pb-2 pt-2">
        <Row item={HOME_ITEM} active={view === "home"} collapsed={collapsed} onSelect={onSelect} onClose={onClose} />
        <div className="mx-2 h-px" style={{ background: "var(--border)" }} />
        {GROUPS.map((g) => (
          <div key={g.title}>
            {collapsed ? (
              <div className="mx-auto mb-1.5 h-px w-6" style={{ background: "var(--border)" }} />
            ) : (
              <div className="flex items-center gap-2 px-2 pb-1.5">
                <span className="text-[10px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
                  {g.title}
                </span>
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>
            )}
            <div className="grid gap-1">
              {g.items.map((it) => (
                <Row
                  key={it.label}
                  item={it}
                  active={it.view !== undefined && it.view === view}
                  collapsed={collapsed}
                  onSelect={onSelect}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`shrink-0 ${collapsed ? "px-2 pb-3 pt-1" : "p-2.5 pt-1"}`}>
        <AppPromo collapsed={collapsed} />
        {collapsed && streak ? (
          <div className="mt-2 text-[10px] font-semibold text-[var(--muted)]">
            Streak: {streak.current} days
          </div>
        ) : null}
      </div>
    </>
  );
}

const PANEL_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(180deg, #0f172a 0%, #1e293b 38%, #0f172a 100%)",
  border: "1px solid var(--border)",
  boxShadow: "0 32px 70px -30px rgba(30, 41, 82, 0.38)",
};

export default function DashSide({
  mobileOpen,
  onClose,
  view,
  onSelect,
  collapsed = false,
  onToggleCollapsed,
  streak,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  view: DashView;
  onSelect: (v: DashView) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  streak?: { current: number; best: number; week: { label: string; active: boolean; isToday: boolean }[] };
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

  const brandMark = (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold"
      style={{
        background: "linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--accent-2)))",
        color: "var(--accent-fg)",
        boxShadow: "0 10px 22px -12px var(--accent)",
      }}
    >
      N
    </span>
  );

  return (
    <>
      <aside
        className={`fixed bottom-4 left-4 top-20 z-40 hidden flex-col overflow-hidden rounded-[26px] transition-[width] duration-300 ease-out md:flex ${
          collapsed ? "w-[5.5rem]" : "w-64"
        }`}
        style={PANEL_STYLE}
        data-collapsed={collapsed ? "true" : "false"}
      >
        <div className={`flex shrink-0 items-center gap-2 px-3 pb-1 pt-3 ${collapsed ? "flex-col" : "justify-between"}`}>
          <div className={`flex min-w-0 items-center gap-2.5 ${collapsed ? "" : "px-1"}`} title={collapsed ? "Study space" : undefined}>
            {brandMark}
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-extrabold" style={{ color: "var(--text)" }}>Study space</div>
                <div className="truncate text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
                  NIMCET · CUET
                </div>
              </div>
            )}
          </div>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-[var(--pill)]"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              <CollapseIcon collapsed={collapsed} />
            </button>
          )}
        </div>
        <SideBody collapsed={collapsed} view={view} onSelect={onSelect} onClose={onClose} streak={streak} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 cursor-default" style={{ background: "rgba(0,0,0,0.45)" }} />
          <aside className="absolute bottom-0 left-0 top-0 flex w-72 max-w-[85vw] flex-col overflow-hidden" style={PANEL_STYLE}>
            <div className="flex shrink-0 items-center justify-between gap-2 p-4 pb-2">
              <div className="flex items-center gap-2.5">
                {brandMark}
                <div>
                  <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>Menu</div>
                  <div className="text-[9px] font-bold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.18em" }}>
                    NIMCET · CUET
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-base"
                style={{ border: "1px solid var(--border)", color: "var(--text)" }}
              >
                ✕
              </button>
            </div>
            <SideBody collapsed={false} view={view} onSelect={onSelect} onClose={onClose} streak={streak} />
          </aside>
        </div>
      )}
    </>
  );
}
