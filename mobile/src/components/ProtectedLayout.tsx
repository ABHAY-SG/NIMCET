import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import AppShell from "./AppShell";
import { Spinner } from "./ui";

/**
 * Guards every authenticated route. Mirrors the server contract:
 *  - no session            → /login (remembering where the user was headed)
 *  - session, unverified   → /login?verify=1 (requireUser would reject anyway)
 * Unverified users are intentionally kept out of the app UI rather than shown a
 * dashboard whose API calls would all 403.
 */
export default function ProtectedLayout() {
  const { ready, session, emailVerified } = useAuth();
  const location = useLocation();

  if (!ready) return <Spinner label="Restoring your session…" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!emailVerified) return <Navigate to="/login?verify=1" replace />;

  return <AppShell />;
}

/** Auth screens share this guard-free wrapper (no chrome). */
export function BareLayout() {
  return (
    <div className="safe-top safe-bottom min-h-full px-5 py-8">
      <Outlet />
    </div>
  );
}
