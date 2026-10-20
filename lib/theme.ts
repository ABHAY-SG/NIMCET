import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEMES, type ThemeId } from "./theme-config";

export { DEFAULT_THEME, THEMES, type ThemeId } from "./theme-config";

// Single source for the site theme: the same five modes everywhere.
// Persisted across reloads via localStorage, applied via data-theme.
// Sunrise (warm orange) is the DEFAULT for first-time visitors; anyone can
// pick any other mode and that choice sticks.

// Modes with a dark background (used by the sun/moon quick toggles). The
// rest — sunrise, light, ocean — are light backgrounds.
const DARK_THEMES: readonly ThemeId[] = ["midnight", "forest"];

export function isDarkTheme(id: ThemeId): boolean {
  return DARK_THEMES.includes(id);
}

export function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function readTheme(): ThemeId {
  try {
    const saved = localStorage.getItem("mcamock-theme");
    if (isThemeId(saved)) return saved;
  } catch {}
  return DEFAULT_THEME;
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
// hydration pass) renders the default theme, then React syncs to the stored
// value — no effect setState, no hydration mismatch.
export function useTheme(): ThemeId {
  return useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_THEME);
}
