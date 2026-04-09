import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import useAuth from "@/hooks/auth/useAuth";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import App from "@/App";
import { useUserStore } from "@/stores/userStore";

const mockUseMyBalances = vi.mocked(useMyBalances);
const mockUseMyTransactionHistory = vi.mocked(useMyTransactionHistory);
const mockUseAuth = vi.mocked(useAuth);

vi.mock("@/hooks/balances/useMyBalances", () => ({
  useMyBalances: vi.fn(),
}));

vi.mock("@/hooks/transactions/useMyTransactionHistory", () => ({
  useMyTransactionHistory: vi.fn(),
}));

vi.mock("@/hooks/auth/useAuth", () => ({
  default: vi.fn(),
}));

describe("app routing", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");

    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      loading: false,
      error: null,
    });

    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 5,
        intents: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useMyTransactionHistory>);
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated protected traffic to the sign-in route", async () => {
    useUserStore.setState({ user: null, token: null });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /sign in to managed digital banking/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders the lazy dashboard route for authenticated users", async () => {
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
      },
    });

    render(<App />);

    expect(
      (await screen.findAllByRole("heading", { name: "Dashboard" })).length,
    ).toBeGreaterThan(0);
  });
});
