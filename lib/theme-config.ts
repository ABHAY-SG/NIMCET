// Pure theme configuration shared by the server (pre-paint script) and the
// client hooks. No React or browser APIs here, so importing it from a server
// component is safe.

export const THEMES = [
  { id: "sunset", name: "Sunrise", dot: "#c2410c", icon: "#c2410c" },
  { id: "light", name: "Light", dot: "#ffffff", icon: "#f59e0b" },
  { id: "midnight", name: "Midnight", dot: "#1e293b", icon: "#1e293b" },
  { id: "ocean", name: "Ocean", dot: "#0369a1", icon: "#0369a1" },
  { id: "forest", name: "Forest", dot: "#059669", icon: "#059669" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "sunset";

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id);

/**
 * Pre-paint script: applies the saved theme before React hydrates, falling
 * back to the default when storage is empty/corrupt. Built from THEMES so a
 * new theme can never be added to the picker but forgotten here.
 */
export function themeInitScript(): string {
  const ids = JSON.stringify(THEME_IDS);
  const fallback = JSON.stringify(DEFAULT_THEME);
  return `(function(){try{var ok=${ids};var t=localStorage.getItem('mcamock-theme');if(ok.indexOf(t)<0)t=${fallback};document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme=${fallback};}})();`;
}
