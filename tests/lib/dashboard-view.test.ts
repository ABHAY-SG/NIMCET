import {
  DASH_VIEWS,
  dashboardViewFromSearch,
  dashboardViewHref,
  isDashView,
} from "@/lib/dashboard-view";

describe("dashboard view URL state", () => {
  it("accepts every rendered dashboard section", () => {
    for (const view of DASH_VIEWS) {
      expect(isDashView(view)).toBe(true);
      expect(dashboardViewFromSearch(`?view=${view}`)).toBe(view);
      expect(dashboardViewHref(view)).toBe(
        view === "home" ? "/dashboard" : `/dashboard?view=${view}`,
      );
    }
  });

  it("falls back to home for a missing or unknown section", () => {
    expect(dashboardViewFromSearch("")).toBe("home");
    expect(dashboardViewFromSearch("?view=unknown")).toBe("home");
    expect(dashboardViewFromSearch("?view=__proto__")).toBe("home");
  });

  it("keeps unrelated query parameters out of the canonical view URL", () => {
    expect(dashboardViewHref("history")).toBe("/dashboard?view=history");
    expect(dashboardViewFromSearch(new URLSearchParams("view=history&from=email"))).toBe(
      "history",
    );
  });
});
