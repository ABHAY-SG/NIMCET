/** @jest-environment node */

import { NextRequest } from "next/server";

const mockCreateServerClient = jest.fn();

jest.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

import { proxy } from "@/proxy";

type TestUser = {
  id: string;
  email: string;
  email_confirmed_at?: string;
  confirmed_at?: string;
};

function setSession(user: TestUser | null) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      refreshSession: jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
    },
  });
}

function request(path: string): NextRequest {
  return new NextRequest(`https://nimcet.test${path}`);
}

function location(res: Response): URL {
  return new URL(res.headers.get("location") ?? "");
}

describe("root entry routing", () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...env,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      ADMIN_EMAILS: "admin@example.com",
    };
  });

  afterAll(() => {
    process.env = env;
  });

  it("keeps the public homepage for signed-out visitors", async () => {
    setSession(null);

    const res = await proxy(request("/"));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends an authenticated student to the student dashboard", async () => {
    setSession({
      id: "student-1",
      email: "student@example.com",
      email_confirmed_at: new Date().toISOString(),
    });

    const res = await proxy(request("/"));

    expect(res.status).toBe(307);
    expect(location(res).pathname).toBe("/dashboard");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("sends an allowlisted admin to the staff dashboard", async () => {
    setSession({
      id: "admin-1",
      email: "ADMIN@example.com",
      email_confirmed_at: new Date().toISOString(),
    });

    const res = await proxy(request("/"));

    expect(res.status).toBe(307);
    expect(location(res).pathname).toBe("/admin");
  });

  it("does not treat an unlisted signed-in account as staff", async () => {
    setSession({
      id: "student-2",
      email: "someone@example.com",
      email_confirmed_at: new Date().toISOString(),
    });

    const res = await proxy(request("/"));

    expect(location(res).pathname).toBe("/dashboard");
  });

  it("still sends a signed-out dashboard visitor to login with a return target", async () => {
    setSession(null);

    const res = await proxy(request("/dashboard?view=history"));

    expect(res.status).toBe(307);
    const url = location(res);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/dashboard?view=history");
  });
});
