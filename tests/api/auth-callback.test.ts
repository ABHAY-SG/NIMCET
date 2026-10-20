/** @jest-environment node */

jest.mock("@/lib/supabase-server", () => ({ getSupabaseServer: jest.fn() }));

import { GET } from "@/app/auth/callback/route";
import { getSupabaseServer } from "@/lib/supabase-server";
import { encodeOAuthIntent, OAUTH_INTENT_COOKIE } from "@/lib/oauth-return";
import { fakeSupabase, filterValue, type FakeQuery } from "../helpers/fake-supabase";

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "student@example.com",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
};

const getSupabaseServerMock = getSupabaseServer as jest.MockedFunction<typeof getSupabaseServer>;

function setup(options?: { registered?: boolean; exchangeError?: { message: string } | null }) {
  const registered = new Set<string>(options?.registered === false ? [] : [USER.id]);

  const { client, queries } = fakeSupabase((q: FakeQuery) => {
    if (q.table === "oauth_account_registry" && q.op === "select") {
      const id = String(filterValue(q, "user_id") ?? "");
      return { data: registered.has(id) ? { user_id: id } : null };
    }
    if (q.table === "oauth_account_registry" && q.op === "insert") {
      const row = q.values as { user_id?: string };
      if (row.user_id) registered.add(row.user_id);
      return { data: null };
    }
    return { data: null };
  });

  const auth = {
    exchangeCodeForSession: jest.fn().mockResolvedValue({
      data: { user: USER, session: {} },
      error: options?.exchangeError ?? null,
    }),
    getUser: jest.fn().mockResolvedValue({ data: { user: USER }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  };

  getSupabaseServerMock.mockResolvedValue({ ...client, auth } as never);
  return { auth, queries, registered };
}

function request(path: string, cookie?: string): Request {
  return new Request(`https://nimcet.test${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function location(res: Response): string {
  return res.headers.get("location") ?? "";
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OAuth callback", () => {
  it("lands an existing account on the dashboard", async () => {
    setup({ registered: true });
    const res = await GET(request("/auth/callback?code=abc&mode=in&provider=google"));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("https://nimcet.test/dashboard");
  });

  it("honours a validated next target", async () => {
    setup({ registered: true });
    const res = await GET(
      request("/auth/callback?code=abc&mode=in&provider=google&next=%2Fadmin%3Ftab%3Dstudents"),
    );
    expect(location(res)).toBe("https://nimcet.test/admin?tab=students");
  });

  it("rejects an external next target", async () => {
    setup({ registered: true });
    const res = await GET(
      request("/auth/callback?code=abc&mode=in&provider=google&next=%2F%2Fevil.example"),
    );
    expect(location(res)).toBe("https://nimcet.test/dashboard");
  });

  it("uses the intent cookie when Supabase dropped mode/provider/next", async () => {
    setup({ registered: false });
    const intent = encodeOAuthIntent({
      mode: "up",
      provider: "google",
      next: "/admin",
      at: Date.now(),
    });
    const res = await GET(
      request("/auth/callback?code=abc", `${OAUTH_INTENT_COOKIE}=${intent}`),
    );
    expect(location(res)).toBe("https://nimcet.test/admin");
  });

  it("treats a proxy-recovered code as OAuth", async () => {
    setup({ registered: true });
    const res = await GET(request("/auth/callback?code=abc&oauth=1"));
    expect(location(res)).toBe("https://nimcet.test/dashboard");
  });

  it("refuses a login for an unregistered OAuth identity", async () => {
    const { auth } = setup({ registered: false });
    const res = await GET(request("/auth/callback?code=abc&mode=in&provider=google"));
    expect(location(res)).toBe(
      "https://nimcet.test/login?error=no-account&provider=google",
    );
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("returns provider refusals to the login page with the next target", async () => {
    setup();
    const res = await GET(
      request(
        "/auth/callback?error=access_denied&mode=in&provider=google&next=%2Fadmin",
      ),
    );
    expect(location(res)).toBe(
      "https://nimcet.test/login?error=cancelled&provider=google&next=%2Fadmin",
    );
  });

  it("reports a missing code instead of hanging", async () => {
    setup();
    const res = await GET(request("/auth/callback"));
    expect(location(res)).toBe("https://nimcet.test/login?error=no-code");
  });
});
