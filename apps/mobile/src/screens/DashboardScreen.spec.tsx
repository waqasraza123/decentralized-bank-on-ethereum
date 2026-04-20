import { fireEvent } from "@testing-library/react-native";
import { DashboardScreen } from "./DashboardScreen";
import { renderMobile } from "../test/test-utils";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate
  })
}));

jest.mock("../hooks/use-customer-queries", () => ({
  useBalancesQuery: jest.fn(),
  useRetirementVaultsQuery: jest.fn(),
  useTransactionHistoryQuery: jest.fn()
}));

const {
  useBalancesQuery,
  useRetirementVaultsQuery,
  useTransactionHistoryQuery
} = jest.requireMock("../hooks/use-customer-queries") as {
  useBalancesQuery: jest.Mock;
  useRetirementVaultsQuery: jest.Mock;
  useTransactionHistoryQuery: jest.Mock;
};

describe("DashboardScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useBalancesQuery.mockReturnValue({
      data: {
        balances: [
          {
            asset: {
              id: "eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            availableBalance: "2.5",
            pendingBalance: "0.2",
            updatedAt: "2026-04-15T12:00:00.000Z"
          }
        ]
      },
      isError: false
    });
    useTransactionHistoryQuery.mockReturnValue({
      data: {
        intents: [
          {
            id: "intent-1",
            asset: {
              id: "eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            sourceWalletAddress: null,
            destinationWalletAddress: "0x1111111111111111111111111111111111111111",
            externalAddress: null,
            intentType: "deposit",
            status: "review_required",
            policyDecision: "review_required",
            requestedAmount: "1.25",
            settledAmount: null,
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-14T12:00:00.000Z",
            updatedAt: "2026-04-15T12:00:00.000Z",
            latestBlockchainTransaction: null
          }
        ]
      },
      isError: false
    });
    useRetirementVaultsQuery.mockReturnValue({
      data: {
        vaults: [
          {
            id: "vault-1",
            customerAccountId: "account-1",
            asset: {
              id: "eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            status: "active",
            strictMode: true,
            unlockAt: "2036-04-15T12:00:00.000Z",
            lockedBalance: "0.75",
            fundedAt: "2026-04-15T12:00:00.000Z",
            lastFundedAt: "2026-04-15T12:00:00.000Z",
            createdAt: "2026-04-15T10:00:00.000Z",
            updatedAt: "2026-04-15T12:00:00.000Z"
          }
        ]
      },
      isError: false,
      isLoading: false
    });
  });

  it("renders stale operational data notice and opens direct actions", () => {
    const screen = renderMobile(<DashboardScreen />, {
      user: {
        id: 1,
        email: "user@example.com",
        firstName: "Mobile",
        lastName: "Customer",
        supabaseUserId: "supabase-user",
        ethereumAddress: "0x1234567890123456789012345678901234567890"
      }
    });

    expect(
      screen.getByText(
        "The latest operational snapshot is older than expected. Review pending money movement or refresh if the delay continues."
      )
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("dashboard-action-deposit"));

    expect(mockNavigate).toHaveBeenCalledWith("Wallet", { focus: "deposit" });

    fireEvent.press(screen.getByText("Open Retirement Vault"));

    expect(mockNavigate).toHaveBeenCalledWith("RetirementVault", {
      focus: "fund"
    });
  });
});
