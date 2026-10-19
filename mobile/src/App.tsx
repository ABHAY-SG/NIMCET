import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AuthProvider } from "./lib/auth";
import LaunchSplash from "./components/LaunchSplash";
import ProtectedLayout, { BareLayout } from "./components/ProtectedLayout";
import Login from "./screens/Login";
import Signup from "./screens/Signup";
import Dashboard from "./screens/Dashboard";
import MockTests from "./screens/MockTests";
import Instructions from "./screens/Instructions";
import Runner from "./screens/Runner";
import Results from "./screens/Results";
import Profile from "./screens/Profile";

// Hardware back button → in-app history (falls through to exiting the app when
// there is nowhere left to go). No-op on the web.
function AndroidBackButton() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removed = false;
    const sub = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) navigate(-1);
      else void CapacitorApp.exitApp();
    });
    return () => {
      if (removed) return;
      removed = true;
      void sub.then((s) => s.remove());
    };
  }, [navigate]);
  return null;
}

// HashRouter: the bundled SPA is loaded from a file-like WebView origin, where
// history/path routing is unreliable. Hash routing is the safe choice for
// Capacitor.
export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <AuthProvider>
      {!splashDone ? <LaunchSplash onDone={() => setSplashDone(true)} /> : null}
      <HashRouter>
        <AndroidBackButton />
        <Routes>
          <Route element={<BareLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mocks" element={<MockTests />} />
            <Route path="/mocks/:testId/instructions" element={<Instructions />} />
            <Route path="/attempt/:sessionId" element={<Runner />} />
            <Route path="/results/:attemptId" element={<Results />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
