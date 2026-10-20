"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FlaskConical,
  Flame,
  History,
  Home,
  Mail,
  MessageSquare,
  PlayCircle,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import AndroidAppModal from "@/components/android-app-modal";

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

type Item = {
  label: string;
  description?: string;
  icon: React.ReactNode;
  view?: DashView;
  href?: string;
};

function NavIcon({ children }: { children: React.ReactNode }) {
  return <span className="dash-nav-icon">{children}</span>;
}

const HOME_ITEM: Item = {
  label: "Overview",
  description: "Your preparation at a glance",
  icon: <NavIcon><Home size={17} strokeWidth={1.9} /></NavIcon>,
  view: "home",
};

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "Practice",
    items: [
      { label: "NIMCET mocks", icon: <NavIcon><PlayCircle size={17} strokeWidth={1.9} /></NavIcon>, view: "mock" },
      { label: "NIMCET previous years", icon: <NavIcon><BookOpen size={17} strokeWidth={1.9} /></NavIcon>, view: "nimcet-pyq" },
      { label: "CUET PG mocks", icon: <NavIcon><PlayCircle size={17} strokeWidth={1.9} /></NavIcon>, view: "cuet-mock" },
      { label: "CUET PG previous years", icon: <NavIcon><BookOpen size={17} strokeWidth={1.9} /></NavIcon>, view: "cuet-pyq" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Custom mock", icon: <NavIcon><FlaskConical size={17} strokeWidth={1.9} /></NavIcon>, view: "builder" },
      { label: "Test history", icon: <NavIcon><History size={17} strokeWidth={1.9} /></NavIcon>, view: "history" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Profile & settings", icon: <NavIcon><UserRound size={17} strokeWidth={1.9} /></NavIcon>, href: "/dashboard/profile" },
      { label: "Plans", icon: <NavIcon><Tag size={17} strokeWidth={1.9} /></NavIcon>, view: "pricing" },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Contact", icon: <NavIcon><Mail size={17} strokeWidth={1.9} /></NavIcon>, view: "contact" },
      { label: "Feedback", icon: <NavIcon><MessageSquare size={17} strokeWidth={1.9} /></NavIcon>, view: "feedback" },
    ],
  },
];

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
  const shared = {
    className: `dash-nav-item ${collapsed ? "justify-center !px-0" : ""}`,
    "data-active": active ? "true" : "false",
    title: collapsed ? item.label : undefined,
    "aria-label": collapsed ? item.label : undefined,
  };
  const inner = (
    <>
      {item.icon}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && active && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />}
    </>
  );

  if (item.href) {
    return (
      <a href={item.href} {...shared} onClick={onClose}>
        {inner}
      </a>
    );
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
  return <span {...shared}>{inner}</span>;
}

function SideBody({
  collapsed,
  view,
  profileActive,
  onSelect,
  onClose,
  onOpenApp,
  streak,
}: {
  collapsed: boolean;
  view: DashView;
  profileActive: boolean;
  onSelect: (v: DashView) => void;
  onClose: () => void;
  onOpenApp: () => void;
  streak?: { current: number; best: number };
}) {
  return (
    <>
      <div className="noscroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
        <Row
          item={HOME_ITEM}
          active={!profileActive && view === "home"}
          collapsed={collapsed}
          onSelect={onSelect}
          onClose={onClose}
        />

        {GROUPS.map((group) => (
          <div key={group.title}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-7" style={{ background: "var(--dash-line)" }} />
            ) : (
              <div className="mb-1.5 flex items-center gap-2 px-2">
                <span className="dash-eyebrow" style={{ fontSize: 9.5, letterSpacing: ".16em" }}>{group.title}</span>
                <span className="h-px flex-1" style={{ background: "var(--dash-line)" }} />
              </div>
            )}
            <div className="grid gap-0.5">
              {group.items.map((item) => (
                <Row
                  key={item.label}
                  item={item}
                  active={
                    item.href === "/dashboard/profile"
                      ? profileActive
                      : !profileActive && item.view !== undefined && item.view === view
                  }
                  collapsed={collapsed}
                  onSelect={onSelect}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`shrink-0 border-t px-3 py-3 ${collapsed ? "space-y-2" : "space-y-2.5"}`} style={{ borderColor: "var(--dash-line)" }}>
        {streak && (
          <div
            className={`rounded-[var(--dash-radius-sm)] border px-2.5 py-2 ${collapsed ? "flex justify-center" : "flex items-center gap-2.5"}`}
            style={{ borderColor: "var(--dash-line)", background: "var(--dash-surface-muted)" }}
            title={collapsed ? `${streak.current} day streak` : undefined}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: "var(--dash-warning-soft)", color: "var(--dash-warning)" }}>
              <Flame size={15} strokeWidth={2} />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-bold" style={{ color: "var(--text)" }}>
                  {streak.current > 0 ? `${streak.current} day streak` : "Start a streak"}
                </span>
                <span className="block truncate text-[10px]" style={{ color: "var(--muted)" }}>
                  {streak.best > 0 ? `Best ${streak.best} days` : "Attempt a mock today"}
                </span>
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            // Keep the trigger focused so the dialog can hand focus back to it
            // (Safari does not focus buttons on click).
            e.currentTarget.focus();
            onOpenApp();
          }}
          className={`dash-nav-item cursor-pointer ${collapsed ? "justify-center !px-0" : ""}`}
          title={collapsed ? "Get the Android app" : undefined}
          aria-label="Get the NimCuet Android app"
          aria-haspopup="dialog"
          style={{ minHeight: 38 }}
        >
          <NavIcon><Download size={16} strokeWidth={1.9} /></NavIcon>
          {!collapsed && <span className="flex-1 truncate">Get the app</span>}
        </button>
      </div>
    </>
  );
}

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
  const pathname = usePathname();
  const profileActive = pathname === "/dashboard/profile";
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [appOpen, setAppOpen] = useState(false);

  // Escape closes the mobile drawer and focus lands on the first control.
  // The page behind is locked while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // The Android app dialog sits above the drawer and owns Escape/Tab while open.
      if (document.querySelector("[data-app-modal]")) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [mobileOpen, onClose]);

  const brand = (compact: boolean) => (
    <a
      href="/dashboard"
      onClick={onClose}
      className={`flex min-w-0 items-center rounded-lg focus-visible:outline-offset-4 ${compact ? "justify-center" : ""}`}
      aria-label="NimCuet exam workspace"
      title={compact ? "NimCuet exam workspace" : undefined}
    >
      {compact ? (
        <img src="/logo.png" alt="" aria-hidden className="site-logo block h-auto w-12" />
      ) : (
        <span className="flex min-w-0 flex-col gap-1.5">
          <img
            src="/logo.png"
            alt=""
            aria-hidden
            className="site-logo block h-7 w-auto max-w-[10.5rem] object-contain object-left"
          />
          <span
            className="block pl-px text-[9px] font-semibold leading-none"
            style={{ color: "var(--muted)", letterSpacing: ".19em" }}
          >
            EXAM WORKSPACE
          </span>
        </span>
      )}
    </a>
  );

  return (
    <>
      <aside
        className={`fixed bottom-4 left-4 top-20 z-40 hidden flex-col overflow-hidden rounded-[var(--dash-radius)] transition-[width] duration-300 ease-out lg:flex ${
          collapsed ? "w-[4.75rem]" : "w-[16.5rem]"
        }`}
        style={{
          background: "var(--dash-surface)",
          border: "1px solid var(--dash-line)",
          boxShadow: "var(--dash-shadow)",
        }}
        aria-label="Dashboard navigation"
      >
        <div className={`flex shrink-0 items-center border-b px-3 py-3 ${collapsed ? "flex-col gap-2" : "justify-between gap-2"}`} style={{ borderColor: "var(--dash-line)" }}>
          {brand(collapsed)}
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="dash-btn dash-btn-ghost dash-btn-icon"
              style={{ width: 32, minWidth: 32, minHeight: 32, borderColor: "var(--dash-line)", border: "1px solid var(--dash-line)" }}
            >
              {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            </button>
          )}
        </div>
        <SideBody
          collapsed={collapsed}
          view={view}
          profileActive={profileActive}
          onSelect={onSelect}
          onClose={onClose}
          onOpenApp={() => setAppOpen(true)}
          streak={streak}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="absolute inset-0 cursor-default"
            style={{ background: "rgba(7, 11, 24, 0.52)", backdropFilter: "blur(3px)" }}
          />
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
            className="absolute bottom-0 left-0 top-0 flex w-[18rem] max-w-[88vw] flex-col overflow-hidden"
            style={{ background: "var(--dash-surface)", borderRight: "1px solid var(--dash-line)", boxShadow: "24px 0 70px -30px rgba(2,6,23,.55)" }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 pb-3 pt-4" style={{ borderColor: "var(--dash-line)" }}>
              {brand(false)}
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="dash-btn dash-btn-ghost dash-btn-icon"
                style={{ width: 36, minWidth: 36, minHeight: 36, border: "1px solid var(--dash-line)" }}
              >
                <X size={17} />
              </button>
            </div>
            <SideBody
              collapsed={false}
              view={view}
              profileActive={profileActive}
              onSelect={onSelect}
              onClose={onClose}
              onOpenApp={() => setAppOpen(true)}
              streak={streak}
            />
          </aside>
        </div>
      )}
      <AndroidAppModal open={appOpen} onClose={() => setAppOpen(false)} />
    </>
  );
}
