// Pure theme configuration shared by the server (pre-paint script) and the
// client hooks. No React or browser APIs here, so importing it from a server
// component is safe.

export const THEMES = [
  { id: "sunset", name: "Sunrise", dot: "#e9a86c", icon: "#c66b42" },
  { id: "light", name: "Lavender", dot: "#b7a4e8", icon: "#7864b5" },
  { id: "midnight", name: "Midnight", dot: "#283b45", icon: "#8fc9bf" },
  { id: "ocean", name: "Ocean", dot: "#76c5d3", icon: "#287d91" },
  { id: "forest", name: "Forest", dot: "#8cae79", icon: "#648553" },
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
