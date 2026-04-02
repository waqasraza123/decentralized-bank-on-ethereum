import {
  BlockchainTransactionStatus,
  PolicyDecision,
  TransactionIntentStatus
} from "@prisma/client";
import { WithdrawalSettlementReconciliationService } from "./withdrawal-settlement-reconciliation.service";

function buildRecord() {
  return {
    id: "intent_2",
    customerAccountId: "account_1",
    sourceWalletId: "wallet_1",
    externalAddress: "0x0000000000000000000000000000000000000abc",
    chainId: 8453,
    status: TransactionIntentStatus.settled,
    policyDecision: PolicyDecision.approved,
    requestedAmount: {
      toString: () => "30"
    },
    settledAmount: {
      toString: () => "20"
    },
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:10:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    sourceWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000def"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "Waqas",
        lastName: "Raza"
      }
    },
    blockchainTransactions: [
      {
        id: "tx_1",
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        status: BlockchainTransactionStatus.confirmed,
        fromAddress: "0x0000000000000000000000000000000000000def",
        toAddress: "0x0000000000000000000000000000000000000abc",
        createdAt: new Date("2026-04-01T00:01:00.000Z"),
        updatedAt: new Date("2026-04-01T00:05:00.000Z"),
        confirmedAt: new Date("2026-04-01T00:05:00.000Z")
      }
    ],
    ledgerJournal: {
      id: "journal_1",
      journalType: "withdrawal_settlement",
      postedAt: new Date("2026-04-01T00:10:00.000Z"),
      createdAt: new Date("2026-04-01T00:10:00.000Z")
    }
  };
}

describe("WithdrawalSettlementReconciliationService review-case opening", () => {
  it("opens or reuses a review case for a manual-review-required withdrawal reconciliation state", async () => {
    const prismaService = {
      transactionIntent: {
        findFirst: jest.fn().mockResolvedValue(buildRecord())
      }
    } as any;

    const withdrawalIntentsService = {} as any;

    const reviewCasesService = {
      openOrReuseReviewCase: jest.fn().mockResolvedValue({
        reviewCase: {
          id: "review_case_2"
        },
        reviewCaseReused: false
      })
    } as any;

    const service = new WithdrawalSettlementReconciliationService(
      prismaService,
      withdrawalIntentsService,
      reviewCasesService
    );

    const result = await service.openManualReviewCase("intent_2", "ops_1", {
      note: "Operator opened a manual review case."
    });

    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalled();
    expect(result.reviewCaseReused).toBe(false);
  });
});
