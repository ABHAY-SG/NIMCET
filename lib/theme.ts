// Single source for the site theme: the same five modes everywhere.
// Persisted across reloads via localStorage, applied via data-theme.
export const THEMES = [
  { id: "light", name: "Light", dot: "#ffffff", icon: "#f59e0b" },
  { id: "midnight", name: "Midnight", dot: "#1e293b", icon: "#1e293b" },
  { id: "ocean", name: "Ocean", dot: "#0284c7", icon: "#0284c7" },
  { id: "forest", name: "Forest", dot: "#059669", icon: "#059669" },
  { id: "sunset", name: "Sunset", dot: "#ea580c", icon: "#ea580c" },
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
  } catch {}
}
