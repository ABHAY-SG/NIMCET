/** @jest-environment node */

import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";
import { encodeOAuthIntent, OAUTH_INTENT_COOKIE } from "@/lib/oauth-return";

function request(url: string, cookie?: string): NextRequest {
  return new NextRequest(url, { headers: cookie ? { cookie } : undefined });
}

function location(res: Response): URL {
  return new URL(res.headers.get("location") ?? "");
}

describe("OAuth return recovery in the proxy", () => {
  it("is enabled for the public landing pages", () => {
    expect(config.matcher).toEqual(expect.arrayContaining(["/", "/login", "/signup", "/login-choice"]));
  });

  it("sends an OAuth-tagged Site URL code to the callback before the page renders", async () => {
    const res = await proxy(request("https://nimcet.test/?code=abc123&mode=in&provider=google"));
    expect(res.status).toBe(307);
    const url = location(res);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("code")).toBe("abc123");
    expect(url.searchParams.get("oauth")).toBe("1");
  });

  it("does not take over a bare code that may belong to an email link", async () => {
    const res = await proxy(request("https://nimcet.test/?code=abc123"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("restores mode/provider/next from the intent cookie", async () => {
    const intent = encodeOAuthIntent({
      mode: "up",
      provider: "google",
      next: "/admin",
      at: Date.now(),
    });
    const res = await proxy(
      request("https://nimcet.test/login?code=abc123", `${OAUTH_INTENT_COOKIE}=${intent}`),
    );
    const url = location(res);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("mode")).toBe("up");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("next")).toBe("/admin");
    expect(res.headers.get("set-cookie")).toContain(`${OAUTH_INTENT_COOKIE}=`);
  });

  it("leaves ordinary public pages alone", async () => {
    const res = await proxy(request("https://nimcet.test/login?error=cancelled"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
