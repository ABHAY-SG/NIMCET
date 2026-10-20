import { cleanup, render, waitFor } from "@testing-library/react";
import OAuthCompletion from "@/components/oauth-completion";

const mockReplace = jest.fn();
const mockGetSession = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      }),
    },
  }),
}));

function setUrl(path: string) {
  window.history.replaceState({}, "", path);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
});

afterEach(() => {
  cleanup();
});

describe("OAuthCompletion", () => {
  it("finishes the navigation after a PKCE code was consumed on a public page", async () => {
    window.sessionStorage.setItem("nimcuet-oauth-pending", String(Date.now()));
    setUrl("/?code=abc123&mode=in&provider=google");

    render(<OAuthCompletion />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    expect(window.sessionStorage.getItem("nimcuet-oauth-pending")).toBeNull();
  });

  it("uses the validated stored next target", async () => {
    window.sessionStorage.setItem("nimcuet-oauth-pending", String(Date.now()));
    window.localStorage.setItem(
      "nimcuet-post-login-redirect",
      `${Date.now()}:/admin?tab=students`,
    );
    setUrl("/?code=abc123&mode=in&provider=google");

    render(<OAuthCompletion />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin?tab=students"));
  });

  it("does not rewrite a specific auth error rendered by AuthForm", async () => {
    window.sessionStorage.setItem("nimcuet-oauth-pending", String(Date.now()));
    setUrl("/login?error=no-account&provider=google");

    render(<OAuthCompletion />);

    await waitFor(() =>
      expect(window.sessionStorage.getItem("nimcuet-oauth-pending")).toBeNull(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("ignores a bare code that may belong to an email link", async () => {
    setUrl("/?code=abc123");

    render(<OAuthCompletion />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
