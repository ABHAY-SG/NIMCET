import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogoMark } from "./brand";
import { Icon, type IconName } from "./icons";

const TABS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/dashboard", label: "Home", icon: "home" },
  { to: "/mocks", label: "Mocks", icon: "book" },
  { to: "/profile", label: "Profile", icon: "user" },
];

/**
 * The app frame: an engraved brand header, a scrollable content area and a
 * floating, thumb-reachable glass tab bar. Safe-area insets keep the chrome
 * clear of notches and gesture bars on real devices.
 */
export default function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const label = user?.email?.split("@")[0] ?? "student";
  const initial = (user?.email?.[0] ?? "N").toUpperCase();

  return (
    <div className="flex min-h-full flex-col">
      <header className="shell-header safe-top">
        <div className="shell-header-inner">
          <Link to="/dashboard" className="brand-lockup" aria-label="NimCuet home">
            <span className="flex flex-col items-start gap-1">
              <LogoMark size={28} />
              <span className="brand-tagline">Prepare smart. Perform better.</span>
            </span>
          </Link>

          <Link to="/profile" className="header-avatar" aria-label="Open profile">
            <span>{label}</span>
            <span className="avatar h-8 w-8 text-[13px]">{initial}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-nav">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <div className="tabbar-wrap">
        <nav className="tabbar" aria-label="Primary">
          {TABS.map(({ to, label: text, icon }) => (
            <NavLink key={to} to={to} className="tab">
              <Icon name={icon} size={20} />
              {text}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
