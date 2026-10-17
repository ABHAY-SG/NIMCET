import { useSyncExternalStore } from "react";

// Single source for the site theme: the same five modes everywhere.
// Persisted across reloads via localStorage, applied via data-theme.
export const THEMES = [
  { id: "light", name: "Light", dot: "#ffffff", icon: "#f59e0b" },
  { id: "midnight", name: "Midnight", dot: "#1e293b", icon: "#1e293b" },
  { id: "ocean", name: "Ocean", dot: "#0369a1", icon: "#0369a1" },
  { id: "forest", name: "Forest", dot: "#059669", icon: "#059669" },
  { id: "sunset", name: "Sunset", dot: "#c2410c", icon: "#c2410c" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function readTheme(): ThemeId {
  try {
    const saved = localStorage.getItem("mcamock-theme");
    if (isThemeId(saved)) return saved;
  } catch {}
  return "light";
}

export function applyTheme(t: ThemeId) {
  try {
    document.documentElement.dataset.theme = t;
    localStorage.setItem("mcamock-theme", t);
    // Notify in-page listeners (admin shell / settings picker) so every open
    // component re-renders with the new theme immediately.
    window.dispatchEvent(new CustomEvent("mcamock-theme", { detail: t }));
  } catch {}
}

function subscribeTheme(onChange: () => void) {
  const on = () => onChange();
  window.addEventListener("mcamock-theme", on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener("mcamock-theme", on);
    window.removeEventListener("storage", on);
  };
}

// The current theme as an external store: the server (and the first
// hydration pass) renders "light", then React syncs to the stored value —
// no effect setState, no hydration mismatch.
export function useTheme(): ThemeId {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "light" as ThemeId);
}
