import {
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import {
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { TransactionIntentsService } from "./transaction-intents.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

function createPersistedIntent(
  overrides: Partial<{
    id: string;
    customerAccountId: string | null;
    destinationWalletId: string | null;
    chainId: number;
    requestedAmount: Prisma.Decimal;
    idempotencyKey: string;
    assetSymbol: string;
    destinationWalletAddress: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "intent_1",
    customerAccountId: overrides.customerAccountId ?? "account_1",
    assetId: "asset_1",
    sourceWalletId: null,
    destinationWalletId: overrides.destinationWalletId ?? "wallet_1",
    chainId: overrides.chainId ?? 8453,
    intentType: TransactionIntentType.deposit,
    status: TransactionIntentStatus.requested,
    policyDecision: PolicyDecision.pending,
    requestedAmount:
      overrides.requestedAmount ?? new Prisma.Decimal("1.25"),
    settledAmount: null,
    idempotencyKey: overrides.idempotencyKey ?? "deposit_req_1",
    failureCode: null,
    failureReason: null,
    createdAt: new Date("2026-04-01T10:00:00.000Z"),
    updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: overrides.assetSymbol ?? "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453
    },
    destinationWallet: overrides.destinationWalletAddress
      ? {
          id: "wallet_1",
          address: overrides.destinationWalletAddress
        }
      : {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
  };
}

function createService() {
  const transactionClient = {
    transactionIntent: {
      create: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };

  const prismaService = {
    customerAccount: {
      findFirst: jest.fn()
    },
    asset: {
      findUnique: jest.fn()
    },
    transactionIntent: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
      callback(transactionClient)
    )
  };

  const service = new TransactionIntentsService(prismaService as never);

  return {
    service,
    prismaService,
    transactionClient
  };
}

describe("TransactionIntentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new deposit intent and audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      customer: {
        id: "customer_1"
      },
      wallets: [
        {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
      ]
    });

    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      status: "active"
    });

    prismaService.transactionIntent.findFirst.mockResolvedValue(null);

    const createdIntent = createPersistedIntent();

    transactionClient.transactionIntent.create.mockResolvedValue(createdIntent);
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_1"
    });

    const result = await service.createDepositIntent("supabase_1", {
      idempotencyKey: "deposit_req_1",
      assetSymbol: "eth",
      amount: "1.25"
    });

    expect(result.idempotencyReused).toBe(false);
    expect(result.intent.id).toBe("intent_1");
    expect(transactionClient.transactionIntent.create).toHaveBeenCalled();
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "customer_1",
        actorType: "customer",
        actorId: "supabase_1",
        action: "transaction_intent.deposit.requested",
        targetType: "TransactionIntent",
        targetId: "intent_1"
      })
    });
  });

  it("reuses an idempotent deposit intent when the request matches", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      customer: {
        id: "customer_1"
      },
      wallets: [
        {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
      ]
    });

    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      status: "active"
    });

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createPersistedIntent()
    );

    const result = await service.createDepositIntent("supabase_1", {
      idempotencyKey: "deposit_req_1",
      assetSymbol: "ETH",
      amount: "1.25"
    });

    expect(result.idempotencyReused).toBe(true);
    expect(result.intent.id).toBe("intent_1");
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key that already belongs to a different request", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      customer: {
        id: "customer_1"
      },
      wallets: [
        {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
      ]
    });

    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      status: "active"
    });

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createPersistedIntent({
        requestedAmount: new Prisma.Decimal("2.50")
      })
    );

    await expect(
      service.createDepositIntent("supabase_1", {
        idempotencyKey: "deposit_req_1",
        assetSymbol: "ETH",
        amount: "1.25"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("lists recent intents for the authenticated customer account", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1"
    });

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createPersistedIntent(),
      createPersistedIntent({
        id: "intent_2",
        idempotencyKey: "deposit_req_2"
      })
    ]);

    const result = await service.listMyTransactionIntents("supabase_1", {
      limit: 2
    });

    expect(result.limit).toBe(2);
    expect(result.intents).toHaveLength(2);
    expect(prismaService.transactionIntent.findMany).toHaveBeenCalledWith({
      where: {
        customerAccountId: "account_1"
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 2,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        }
      }
    });
  });

  it("fails when the authenticated user does not have a customer account projection", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.listMyTransactionIntents("missing_user", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
