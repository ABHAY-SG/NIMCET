import {
  OAUTH_INTENT_COOKIE,
  OAUTH_INTENT_TTL_MS,
  decodeOAuthIntent,
  encodeOAuthIntent,
  hasOAuthQueryTags,
  hasOAuthReturnEvidence,
  isAppAuthError,
  loginErrorPath,
  oauthErrorLoginPath,
  oauthRecoveryPath,
  parseStoredRedirect,
  postLoginPath,
  readOAuthIntentCookie,
  readOAuthReturn,
} from "@/lib/oauth-return";

const NOW = 1_800_000_000_000;

describe("OAuth return intent", () => {
  it("round-trips mode, provider and a safe next target", () => {
    const encoded = encodeOAuthIntent({
      mode: "up",
      provider: "google",
      next: "/admin?tab=students",
      at: NOW,
    });
    expect(decodeOAuthIntent(encoded, NOW + 1000)).toEqual({
      mode: "up",
      provider: "google",
      next: "/admin?tab=students",
      at: NOW,
    });
  });

  it("drops an unsafe next target", () => {
    const encoded = encodeOAuthIntent({
      mode: "in",
      provider: "github",
      next: "//evil.example/steal",
      at: NOW,
    });
    expect(decodeOAuthIntent(encoded, NOW)?.next).toBeNull();
  });

  it("ignores stale intents", () => {
    const encoded = encodeOAuthIntent({ mode: "in", provider: "google", next: null, at: NOW });
    expect(decodeOAuthIntent(encoded, NOW + OAUTH_INTENT_TTL_MS + 1)).toBeNull();
  });

  it("reads the intent from the request cookie header", () => {
    const encoded = encodeOAuthIntent({ mode: "in", provider: "google", next: "/dashboard", at: NOW });
    const header = `theme=sunrise; ${OAUTH_INTENT_COOKIE}=${encoded}; other=1`;
    expect(readOAuthIntentCookie(header, NOW)?.provider).toBe("google");
  });
});

describe("OAuth destination validation", () => {
  it("accepts same-origin paths and rejects open redirects", () => {
    expect(postLoginPath("/admin")).toBe("/admin");
    expect(postLoginPath("//evil.example")).toBe("/dashboard");
    expect(postLoginPath("https://evil.example")).toBe("/dashboard");
    expect(postLoginPath("/\\evil.example")).toBe("/dashboard");
  });

  it("does not send a signed-in user back to an auth entry page", () => {
    expect(postLoginPath("/login")).toBe("/dashboard");
    expect(postLoginPath("/auth/callback")).toBe("/dashboard");
    expect(postLoginPath("/reset-password")).toBe("/dashboard");
  });

  it("preserves next only when it is safe", () => {
    expect(loginErrorPath("exchange", { provider: "google", next: "/admin" })).toBe(
      "/login?error=exchange&provider=google&next=%2Fadmin",
    );
    expect(loginErrorPath("exchange", { next: "//evil.example" })).toBe("/login?error=exchange");
  });

  it("maps provider refusal to the cancelled message", () => {
    expect(oauthErrorLoginPath({ error: "access_denied", provider: "google" })).toBe(
      "/login?error=cancelled&provider=google",
    );
  });
});

describe("OAuth return recovery", () => {
  it("does not misroute a bare code with no OAuth context", () => {
    const search = new URLSearchParams({ code: "abc123" });
    expect(oauthRecoveryPath("/", search, null)).toBeNull();
  });

  it("recovers when Supabase kept the OAuth mode/provider tags", () => {
    const search = new URLSearchParams({ code: "abc123", mode: "in", provider: "google" });
    const path = oauthRecoveryPath("/", search, null);
    expect(path).toContain("/auth/callback?");
    const q = new URLSearchParams(path!.split("?")[1]);
    expect(q.get("code")).toBe("abc123");
    expect(q.get("oauth")).toBe("1");
    expect(q.get("mode")).toBe("in");
  });

  it("recognizes OAuth query tags without treating email links as OAuth", () => {
    expect(hasOAuthQueryTags("https://nimcet.test/?mode=in&provider=google")).toBe(true);
    expect(hasOAuthQueryTags("https://nimcet.test/?code=x")).toBe(false);
  });

  it("leaves app-rendered auth errors alone", () => {
    expect(isAppAuthError("no-account")).toBe(true);
    expect(isAppAuthError("access_denied")).toBe(false);
  });

  it("adds intent tags when Supabase dropped the query string", () => {
    const search = new URLSearchParams({ code: "abc123" });
    const intent = {
      mode: "up" as const,
      provider: "google" as const,
      next: "/dashboard",
      at: NOW,
    };
    const q = new URLSearchParams(oauthRecoveryPath("/login", search, intent)!.split("?")[1]);
    expect(q.get("mode")).toBe("up");
    expect(q.get("provider")).toBe("google");
    expect(q.get("next")).toBe("/dashboard");
  });

  it("does not hijack an unrelated error query on the homepage", () => {
    expect(oauthRecoveryPath("/", new URLSearchParams({ error: "oops" }), null)).toBeNull();
  });

  it("recognizes OAuth evidence in the query string and hash", () => {
    expect(hasOAuthReturnEvidence("https://nimcet.test/?code=abc")).toBe(true);
    expect(hasOAuthReturnEvidence("https://nimcet.test/#access_token=abc")).toBe(true);
    expect(hasOAuthReturnEvidence("https://nimcet.test/?utm_source=mail")).toBe(false);
    expect(readOAuthReturn("https://nimcet.test/?error=access_denied&provider=google").error).toBe(
      "access_denied",
    );
  });

  it("accepts a recently stored post-login target", () => {
    expect(parseStoredRedirect(`${NOW}:/admin`, NOW + 1000)).toBe("/admin");
    expect(parseStoredRedirect(`${NOW}://evil.example`, NOW + 1000)).toBeNull();
  });
});
