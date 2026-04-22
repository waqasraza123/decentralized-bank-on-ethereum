import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateBalanceTransfer,
  usePreviewBalanceTransferRecipient,
} from "@/hooks/balance-transfers/useBalanceTransfers";
import {
  useStartCustomerMfaChallenge,
  useVerifyCustomerMfaChallenge,
} from "@/hooks/auth/useCustomerMfa";
import { toast } from "@/components/ui/use-toast";
import InternalTransferCard from "@/pages/wallet/InternalTransferCard";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/hooks/balance-transfers/useBalanceTransfers", () => ({
  usePreviewBalanceTransferRecipient: vi.fn(),
  useCreateBalanceTransfer: vi.fn(),
}));

vi.mock("@/hooks/auth/useCustomerMfa", () => ({
  useStartCustomerMfaChallenge: vi.fn(),
  useVerifyCustomerMfaChallenge: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
  useToast: vi.fn(),
}));

const mockUsePreviewBalanceTransferRecipient = vi.mocked(
  usePreviewBalanceTransferRecipient
);
const mockUseCreateBalanceTransfer = vi.mocked(useCreateBalanceTransfer);
const mockUseStartCustomerMfaChallenge = vi.mocked(
  useStartCustomerMfaChallenge
);
const mockUseVerifyCustomerMfaChallenge = vi.mocked(
  useVerifyCustomerMfaChallenge
);
const mockToast = vi.mocked(toast);

const assets = [
  {
    id: "asset_usdc",
    symbol: "USDC",
    displayName: "USD Coin",
    decimals: 6,
    chainId: 8453,
    assetType: "erc20",
    contractAddress: "0x0000000000000000000000000000000000000abc",
  },
];

const balances = [
  {
    asset: {
      id: "asset_usdc",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453,
    },
    availableBalance: "100",
    pendingBalance: "10",
    updatedAt: "2026-04-22T10:00:00.000Z",
  },
];

describe("InternalTransferCard", () => {
  const previewRecipientMutateAsync = vi.fn();
  const createTransferMutateAsync = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    useUserStore.persist.clearStorage();
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
        mfa: {
          required: true,
          totpEnrolled: true,
          emailOtpEnrolled: true,
          requiresSetup: false,
          moneyMovementBlocked: false,
          stepUpFreshUntil: "2099-04-22T12:00:00.000Z",
          lockedUntil: null,
        },
        sessionSecurity: {
          currentSessionTrusted: true,
          currentSessionRequiresVerification: false,
        },
      },
    });

    previewRecipientMutateAsync.mockReset();
    createTransferMutateAsync.mockReset();
    mockToast.mockReset();

    mockUsePreviewBalanceTransferRecipient.mockReturnValue({
      mutateAsync: previewRecipientMutateAsync,
      isPending: false,
    } as ReturnType<typeof usePreviewBalanceTransferRecipient>);

    mockUseCreateBalanceTransfer.mockReturnValue({
      mutateAsync: createTransferMutateAsync,
      isPending: false,
    } as ReturnType<typeof useCreateBalanceTransfer>);

    mockUseStartCustomerMfaChallenge.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useStartCustomerMfaChallenge>);

    mockUseVerifyCustomerMfaChallenge.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as ReturnType<typeof useVerifyCustomerMfaChallenge>);
  });

  afterEach(() => {
    cleanup();
    useUserStore.persist.clearStorage();
    useUserStore.setState({ user: null, token: null });
  });

  it("shows a masked preview and review-threshold warning after recipient verification", async () => {
    const user = userEvent.setup();

    previewRecipientMutateAsync.mockResolvedValue({
      normalizedEmail: "recipient@example.com",
      available: true,
      maskedEmail: "r*******t@e****.com",
      maskedDisplay: "A*** R***",
      thresholdOutcome: "review_required",
    });

    renderWithRouter(
      <InternalTransferCard
        assets={assets}
        balances={balances}
        isAssetsLoading={false}
        isBalancesLoading={false}
        assetsErrorMessage={null}
        balancesErrorMessage={null}
      />
    );

    await user.type(
      screen.getByLabelText(/recipient email/i),
      "recipient@example.com"
    );
    await user.type(screen.getByLabelText(/^amount$/i), "25");
    await user.click(screen.getByRole("button", { name: /verify recipient/i }));

    await waitFor(() => {
      expect(previewRecipientMutateAsync).toHaveBeenCalledWith({
        email: "recipient@example.com",
        assetSymbol: "USDC",
        amount: "25",
      });
    });

    expect(screen.getByText(/recipient verified/i)).toBeInTheDocument();
    expect(screen.getByText("A*** R***")).toBeInTheDocument();
    expect(screen.getByText("r*******t@e****.com")).toBeInTheDocument();
    expect(
      screen.getByText(
        /this amount will move into pending balance immediately and wait for operator review before settlement/i
      )
    ).toBeInTheDocument();
  });

  it("submits an immediate internal transfer and shows the latest transfer summary", async () => {
    const user = userEvent.setup();

    previewRecipientMutateAsync.mockResolvedValue({
      normalizedEmail: "recipient@example.com",
      available: true,
      maskedEmail: "r*******t@e****.com",
      maskedDisplay: "A*** R***",
      thresholdOutcome: "settled_immediately",
    });
    createTransferMutateAsync.mockResolvedValue({
      idempotencyReused: false,
      thresholdOutcome: "settled_immediately",
      intent: {
        id: "intent_internal_1",
        customerAccountId: "account_1",
        recipientCustomerAccountId: "account_2",
        asset: {
          id: "asset_usdc",
          symbol: "USDC",
          displayName: "USD Coin",
          decimals: 6,
          chainId: 8453,
        },
        intentType: "internal_balance_transfer",
        status: "settled",
        policyDecision: "approved",
        requestedAmount: "25",
        settledAmount: "25",
        idempotencyKey: "internal_transfer_req_1",
        failureCode: null,
        failureReason: null,
        recipientMaskedDisplay: "A*** R***",
        recipientMaskedEmail: "r*******t@e****.com",
        createdAt: "2026-04-22T10:05:00.000Z",
        updatedAt: "2026-04-22T10:05:00.000Z",
      },
    });

    renderWithRouter(
      <InternalTransferCard
        assets={assets}
        balances={balances}
        isAssetsLoading={false}
        isBalancesLoading={false}
        assetsErrorMessage={null}
        balancesErrorMessage={null}
      />
    );

    await user.type(
      screen.getByLabelText(/recipient email/i),
      "recipient@example.com"
    );
    await user.type(screen.getByLabelText(/^amount$/i), "25");
    await user.click(screen.getByRole("button", { name: /verify recipient/i }));
    await user.click(
      screen.getByRole("button", { name: /send internal transfer/i })
    );

    await waitFor(() => {
      expect(createTransferMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          assetSymbol: "USDC",
          amount: "25",
          recipientEmail: "recipient@example.com",
          idempotencyKey: expect.any(String),
        })
      );
    });

    expect(screen.getByText(/latest internal transfer/i)).toBeInTheDocument();
    expect(screen.getAllByText(/25 USDC/i).length).toBeGreaterThan(0);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Transfer settled internally",
      })
    );
  });
});
