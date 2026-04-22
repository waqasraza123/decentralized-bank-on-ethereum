import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionOperationsService } from "./transaction-operations.service";

function buildIntentRecord(
  overrides: Partial<{
    id: string;
    intentType: TransactionIntentType;
    status: TransactionIntentStatus;
    assetSymbol: string;
    txHash: string | null;
    customerAccountId: string;
    recipientCustomerAccountId: string | null;
    email: string;
    supabaseUserId: string;
    recipientEmail: string;
    recipientSupabaseUserId: string;
    externalAddress: string | null;
    recipientMaskedDisplay: string | null;
    recipientMaskedEmail: string | null;
  }> = {}
) {
  const resolvedIntentType =
    overrides.intentType ?? TransactionIntentType.deposit;
  const txHash =
    overrides.txHash === undefined
      ? "0x1111111111111111111111111111111111111111111111111111111111111111"
      : overrides.txHash;

  return {
    id: overrides.id ?? "intent_1",
    customerAccountId: overrides.customerAccountId ?? "account_1",
    assetId: "asset_1",
    sourceWalletId: "wallet_1",
    destinationWalletId:
      resolvedIntentType === TransactionIntentType.deposit ? "wallet_2" : null,
    recipientCustomerAccountId:
      overrides.recipientCustomerAccountId === undefined
        ? null
        : overrides.recipientCustomerAccountId,
    externalAddress:
      overrides.externalAddress === undefined ? null : overrides.externalAddress,
    recipientMaskedDisplay:
      overrides.recipientMaskedDisplay === undefined
        ? null
        : overrides.recipientMaskedDisplay,
    recipientMaskedEmail:
      overrides.recipientMaskedEmail === undefined
        ? null
        : overrides.recipientMaskedEmail,
    chainId: 8453,
    intentType: resolvedIntentType,
    status: overrides.status ?? TransactionIntentStatus.settled,
    policyDecision: PolicyDecision.approved,
    requestedAmount: new Prisma.Decimal("25"),
    settledAmount: new Prisma.Decimal("25"),
    idempotencyKey: "intent_key_1",
    failureCode: null,
    failureReason: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:10:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: overrides.assetSymbol ?? "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    sourceWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000def"
    },
    destinationWallet:
      resolvedIntentType === TransactionIntentType.deposit
        ? {
            id: "wallet_2",
            address: "0x0000000000000000000000000000000000000fed"
          }
        : null,
    customerAccount: {
      id: overrides.customerAccountId ?? "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: overrides.supabaseUserId ?? "supabase_1",
        email: overrides.email ?? "user@example.com",
        firstName: "Waqas",
        lastName: "Raza"
      }
    },
    recipientCustomerAccount:
      overrides.recipientCustomerAccountId === null
        ? null
        : {
            id: overrides.recipientCustomerAccountId ?? "account_2",
            customerId: "customer_2",
            customer: {
              id: "customer_2",
              supabaseUserId: overrides.recipientSupabaseUserId ?? "supabase_2",
              email: overrides.recipientEmail ?? "recipient@example.com",
              firstName: "Amina",
              lastName: "Rahman"
            }
          },
    blockchainTransactions: txHash
      ? [
          {
            id: "tx_1",
            txHash,
            status: BlockchainTransactionStatus.confirmed,
            fromAddress: "0x0000000000000000000000000000000000000def",
            toAddress: "0x0000000000000000000000000000000000000abc",
            createdAt: new Date("2026-04-01T00:01:00.000Z"),
            updatedAt: new Date("2026-04-01T00:05:00.000Z"),
            confirmedAt: new Date("2026-04-01T00:05:00.000Z")
          }
        ]
      : []
  };
}

function createService() {
  const prismaService = {
    customerAccount: {
      findFirst: jest.fn()
    },
    transactionIntent: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    auditEvent: {
      findMany: jest.fn()
    },
    customerAssetBalance: {
      findMany: jest.fn()
    }
  } as unknown as PrismaService;

  const service = new TransactionOperationsService(prismaService);

  return {
    service,
    prismaService
  };
}

describe("TransactionOperationsService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("lists my transaction history for the authenticated customer account", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccount.findFirst as jest.Mock).mockResolvedValue({
      id: "account_1"
    });

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildIntentRecord({
        intentType: TransactionIntentType.deposit
      }),
      buildIntentRecord({
        id: "intent_2",
        intentType: TransactionIntentType.withdrawal,
        externalAddress: "0x0000000000000000000000000000000000000abc"
      })
    ]);

    const result = await service.listMyTransactionHistory("supabase_1", {
      limit: 20
    });

    expect(result.customerAccountId).toBe("account_1");
    expect(result.intents).toHaveLength(2);
    expect(result.intents[1].intentType).toBe(TransactionIntentType.withdrawal);
  });

  it("maps inbound internal transfers as received with masked sender details", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccount.findFirst as jest.Mock).mockResolvedValue({
      id: "account_2"
    });

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildIntentRecord({
        id: "intent_internal_1",
        intentType: TransactionIntentType.internal_balance_transfer,
        customerAccountId: "account_1",
        recipientCustomerAccountId: "account_2",
        supabaseUserId: "supabase_sender",
        email: "sender@example.com",
        recipientSupabaseUserId: "supabase_2",
        recipientEmail: "recipient@example.com",
        recipientMaskedDisplay: "A*** R***",
        recipientMaskedEmail: "r*******t@e****.com",
        txHash: null
      })
    ]);

    const result = await service.listMyTransactionHistory("supabase_2", {
      limit: 20
    });

    expect(result.customerAccountId).toBe("account_2");
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].intentType).toBe(
      TransactionIntentType.internal_balance_transfer
    );
    expect(result.intents[0].transferDirection).toBe("received");
    expect(result.intents[0].counterpartyMaskedDisplay).toBe("W*** R***");
    expect(result.intents[0].counterpartyMaskedEmail).toBe(
      "s****r@e****.com"
    );
  });

  it("searches transaction operations by customer email and tx hash", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildIntentRecord({
        intentType: TransactionIntentType.withdrawal,
        externalAddress: "0x0000000000000000000000000000000000000abc"
      })
    ]);

    const result = await service.searchTransactionOperations({
      email: "user@example.com",
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111"
    });

    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].customer.email).toBe("user@example.com");
    expect(result.intents[0].latestBlockchainTransaction?.txHash).toBe(
      "0x1111111111111111111111111111111111111111111111111111111111111111"
    );
  });

  it("returns the audit timeline for a transaction intent", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findFirst as jest.Mock).mockResolvedValue({
      id: "intent_1"
    });

    (prismaService.auditEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "audit_1",
        actorType: "customer",
        actorId: "supabase_1",
        action: "transaction_intent.deposit.requested",
        targetType: "TransactionIntent",
        targetId: "intent_1",
        metadata: {
          requestedAmount: "25"
        },
        createdAt: new Date("2026-04-01T00:00:00.000Z")
      },
      {
        id: "audit_2",
        actorType: "worker",
        actorId: "worker_1",
        action: "transaction_intent.deposit.settled",
        targetType: "TransactionIntent",
        targetId: "intent_1",
        metadata: {
          settledAmount: "25"
        },
        createdAt: new Date("2026-04-01T00:10:00.000Z")
      }
    ]);

    const result = await service.getTransactionIntentAuditTimeline("intent_1");

    expect(result.intentId).toBe("intent_1");
    expect(result.auditEvents).toHaveLength(2);
    expect(result.auditEvents[0].action).toBe(
      "transaction_intent.deposit.requested"
    );
    expect(result.auditEvents[1].action).toBe(
      "transaction_intent.deposit.settled"
    );
  });

  it("returns a customer operations snapshot with balances and recent intents", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccount.findFirst as jest.Mock).mockResolvedValue({
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "Waqas",
        lastName: "Raza"
      }
    });

    (prismaService.customerAssetBalance.findMany as jest.Mock).mockResolvedValue([
      {
        asset: {
          id: "asset_1",
          symbol: "USDC",
          displayName: "USD Coin",
          decimals: 6,
          chainId: 8453
        },
        availableBalance: new Prisma.Decimal("70"),
        pendingBalance: new Prisma.Decimal("5"),
        updatedAt: new Date("2026-04-01T00:20:00.000Z")
      }
    ]);

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildIntentRecord({
        intentType: TransactionIntentType.deposit
      }),
      buildIntentRecord({
        id: "intent_2",
        intentType: TransactionIntentType.withdrawal,
        externalAddress: "0x0000000000000000000000000000000000000abc"
      })
    ]);

    const result = await service.getCustomerOperationsSnapshot({
      supabaseUserId: "supabase_1",
      recentLimit: 10
    });

    expect(result.customer.customerAccountId).toBe("account_1");
    expect(result.balances).toHaveLength(1);
    expect(result.recentIntents).toHaveLength(2);
    expect(result.recentLimit).toBe(10);
  });

  it("rejects a customer snapshot request when no lookup key is provided", async () => {
    const { service } = createService();

    await expect(
      service.getCustomerOperationsSnapshot({})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects history when the authenticated customer account does not exist", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccount.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.listMyTransactionHistory("missing_user", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
