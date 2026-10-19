import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const TABS = [
  { to: "/dashboard", label: "Home", icon: HomeIcon },
  { to: "/mocks", label: "Mock Tests", icon: BookIcon },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V20h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BookIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" strokeWidth={active ? 2.2 : 1.8} stroke="currentColor">
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The app frame: a compact sticky header, a scrollable content area, and the
 * primary bottom tab bar (thumb-reachable). Safe-area insets keep it clear of
 * notches and gesture bars on real devices.
 */
export default function AppShell() {
  const { user } = useAuth();
  const label = user?.email?.split("@")[0] ?? "student";

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-nav backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-lg bg-btn text-btn-fg text-sm font-black"
            >
              N
            </span>
            <span className="text-[17px] font-extrabold tracking-tight">NimCuet</span>
          </div>
          <span className="max-w-[46%] truncate text-xs text-muted">Hi, {label}</span>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 pb-nav">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-nav backdrop-blur-md">
        <ul className="flex">
          {TABS.map(({ to, label: text, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                    isActive ? "text-accent" : "text-muted"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon active={isActive} />
                    {text}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
