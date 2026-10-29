// Dashboard section state lives in the URL so the browser can restore it when
// the user presses Back/Forward. Keep this list in sync with the rendered
// dashboard views and the sidebar.
export const DASH_VIEWS = [
  "home",
  "mock",
  "nimcet-pyq",
  "cuet-mock",
  "cuet-pyq",
  "builder",
  "history",
  "contact",
  "pricing",
  "feedback",
] as const;

export type DashView = (typeof DASH_VIEWS)[number];

const DASH_VIEW_SET = new Set<string>(DASH_VIEWS);

export function isDashView(value: string | null | undefined): value is DashView {
  return typeof value === "string" && DASH_VIEW_SET.has(value);
}

/** Resolve a ?view= value to a renderable section. Unknown values are home. */
export function dashboardViewFromSearch(
  search: string | URLSearchParams,
): DashView {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const requested = params.get("view");
  return isDashView(requested) ? requested : "home";
}

/** Canonical URL for a dashboard section. Home stays clean (/dashboard). */
export function dashboardViewHref(view: DashView): string {
  return view === "home" ? "/dashboard" : `/dashboard?view=${encodeURIComponent(view)}`;
}
