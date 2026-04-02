import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

function buildIntent(
  overrides: {
    status?: TransactionIntentStatus;
    blockchainStatus?: BlockchainTransactionStatus;
    settledAmount?: Prisma.Decimal | null;
  } = {}
) {
  const blockchainStatus =
    overrides.blockchainStatus ?? BlockchainTransactionStatus.confirmed;

  return {
    id: "intent_1",
    customerAccountId: "account_1",
    assetId: "asset_1",
    sourceWalletId: "wallet_1",
    destinationWalletId: null,
    externalAddress: "0x0000000000000000000000000000000000000abc",
    chainId: 8453,
    intentType: TransactionIntentType.withdrawal,
    status: overrides.status ?? TransactionIntentStatus.broadcast,
    policyDecision: PolicyDecision.approved,
    requestedAmount: new Prisma.Decimal("30"),
    settledAmount: overrides.settledAmount ?? null,
    idempotencyKey: "withdraw_req_1",
    failureCode: null,
    failureReason: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
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
        status: blockchainStatus,
        fromAddress: "0x0000000000000000000000000000000000000def",
        toAddress: "0x0000000000000000000000000000000000000abc",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        confirmedAt:
          blockchainStatus === BlockchainTransactionStatus.confirmed
            ? new Date("2026-04-01T00:05:00.000Z")
            : null
      }
    ]
  };
}

function createService() {
  const prismaService = {
    transactionIntent: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    blockchainTransaction: {
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    ledgerJournal: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const ledgerService = {
    settleConfirmedWithdrawal: jest.fn()
  } as unknown as LedgerService;

  const service = new WithdrawalIntentsService(prismaService, ledgerService);

  return {
    service,
    prismaService,
    ledgerService
  };
}

describe("WithdrawalIntentsService replay methods", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("replays confirm with operator audit metadata", async () => {
    const { service, prismaService } = createService();

    const existingIntent = buildIntent({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    const transaction = {
      transactionIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingIntent)
          .mockResolvedValueOnce(
            buildIntent({
              status: TransactionIntentStatus.confirmed,
              blockchainStatus: BlockchainTransactionStatus.confirmed
            })
          ),
        update: jest.fn().mockResolvedValue(undefined)
      },
      blockchainTransaction: {
        update: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    await service.replayConfirmWithdrawalIntent(
      "intent_1",
      "ops_1",
      "Replay missed confirm."
    );

    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "transaction_intent.withdrawal.confirmed",
        metadata: expect.objectContaining({
          reconciliationReplay: true,
          replayReason: "withdrawal_settlement_reconciliation",
          note: "Replay missed confirm."
        })
      })
    });
  });

  it("replays settlement with operator audit metadata", async () => {
    const { service, prismaService, ledgerService } = createService();

    const existingIntent = buildIntent({
      status: TransactionIntentStatus.confirmed,
      blockchainStatus: BlockchainTransactionStatus.confirmed
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    (prismaService.ledgerJournal.findUnique as jest.Mock).mockResolvedValue(null);

    const transaction = {
      transactionIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingIntent)
          .mockResolvedValueOnce(
            buildIntent({
              status: TransactionIntentStatus.settled,
              blockchainStatus: BlockchainTransactionStatus.confirmed,
              settledAmount: new Prisma.Decimal("30")
            })
          ),
        update: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (ledgerService.settleConfirmedWithdrawal as jest.Mock).mockResolvedValue({
      ledgerJournalId: "journal_1",
      debitLedgerAccountId: "liability_account_1",
      creditLedgerAccountId: "outbound_account_1",
      availableBalance: "70",
      pendingBalance: "0"
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    await service.replaySettleConfirmedWithdrawalIntent(
      "intent_1",
      "ops_1",
      "Replay missed settle."
    );

    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "transaction_intent.withdrawal.settled",
        metadata: expect.objectContaining({
          reconciliationReplay: true,
          replayReason: "withdrawal_settlement_reconciliation",
          note: "Replay missed settle."
        })
      })
    });
  });
});
