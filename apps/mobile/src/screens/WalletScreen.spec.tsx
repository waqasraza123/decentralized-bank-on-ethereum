import { Alert } from "react-native";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { WalletScreen } from "./WalletScreen";
import { renderMobile } from "../test/test-utils";

jest.mock("../hooks/use-customer-queries", () => ({
  useSupportedAssetsQuery: jest.fn(),
  useBalancesQuery: jest.fn(),
  useCreateDepositIntentMutation: jest.fn(),
  useCreateWithdrawalIntentMutation: jest.fn()
}));

const {
  useSupportedAssetsQuery,
  useBalancesQuery,
  useCreateDepositIntentMutation,
  useCreateWithdrawalIntentMutation
} = jest.requireMock("../hooks/use-customer-queries") as {
  useSupportedAssetsQuery: jest.Mock;
  useBalancesQuery: jest.Mock;
  useCreateDepositIntentMutation: jest.Mock;
  useCreateWithdrawalIntentMutation: jest.Mock;
};

describe("WalletScreen", () => {
  const depositMutateAsync = jest.fn();
  const withdrawalMutateAsync = jest.fn();

  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    depositMutateAsync.mockReset();
    withdrawalMutateAsync.mockReset();
    useSupportedAssetsQuery.mockReturnValue({
      data: {
        assets: [
          {
            id: "eth",
            symbol: "ETH",
            displayName: "Ether",
            decimals: 18,
            chainId: 1,
            assetType: "native",
            contractAddress: null
          }
        ]
      },
      isError: false
    });
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
            availableBalance: "5",
            pendingBalance: "1",
            updatedAt: "2026-04-18T08:00:00.000Z"
          }
        ]
      },
      isError: false
    });
    useCreateDepositIntentMutation.mockReturnValue({
      mutateAsync: depositMutateAsync,
      isPending: false
    });
    useCreateWithdrawalIntentMutation.mockReturnValue({
      mutateAsync: withdrawalMutateAsync,
      isPending: false
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("submits a deposit request and renders the latest request card", async () => {
    depositMutateAsync.mockResolvedValueOnce({
      idempotencyReused: false,
      intent: {
        id: "deposit-1",
        customerAccountId: "acct-1",
        asset: {
          id: "eth",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 1
        },
        destinationWalletAddress: "0x1234567890123456789012345678901234567890",
        intentType: "deposit",
        status: "review_required",
        policyDecision: "review_required",
        requestedAmount: "1.5",
        createdAt: "2026-04-18T08:00:00.000Z",
        updatedAt: "2026-04-18T08:00:00.000Z"
      }
    });

    const screen = renderMobile(<WalletScreen />, {
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
        "Deposits are credited only after managed wallet detection, chain confirmation, and policy-safe settlement. Larger or anomalous deposits may pause for operator review."
      )
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Amount"), "1.5");
    fireEvent.press(screen.getByText("Create deposit request"));

    await waitFor(() => {
      expect(depositMutateAsync).toHaveBeenCalledWith({
        idempotencyKey: expect.any(String),
        assetSymbol: "ETH",
        amount: "1.5"
      });
    });

    expect(screen.getByText("Latest deposit request")).toBeTruthy();
    expect(screen.getByText("Reference: deposit-1")).toBeTruthy();
    expect(
      screen.getByText(
        "This deposit is paused for operator review before custody execution or final settlement continues."
      )
    ).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Deposit",
      "Deposit request recorded and routed for operator review."
    );
  });

  it("rejects self-directed withdrawals before calling the mutation", async () => {
    const screen = renderMobile(<WalletScreen />, {
      user: {
        id: 1,
        email: "user@example.com",
        firstName: "Mobile",
        lastName: "Customer",
        supabaseUserId: "supabase-user",
        ethereumAddress: "0x1234567890123456789012345678901234567890"
      }
    });

    fireEvent.press(screen.getByTestId("wallet-action-withdraw"));
    fireEvent.changeText(
      screen.getByLabelText("Destination address"),
      "0x1234567890123456789012345678901234567890"
    );
    fireEvent.changeText(screen.getByLabelText("Amount"), "1.2");
    fireEvent.press(screen.getByText("Create withdrawal request"));

    await waitFor(() => {
      expect(withdrawalMutateAsync).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        "Withdraw",
        "Destination address must be different from your managed wallet address."
      );
    });
  });
});
