import {
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import {
  AccountLifecycleStatus,
  AssetStatus,
  PolicyDecision,
  Prisma,
  RetirementVaultEventType,
  RetirementVaultStatus,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { RetirementVaultService } from "./retirement-vault.service";

function buildVaultRecord(
  overrides: Partial<{
    id: string;
    customerAccountId: string;
    assetId: string;
    assetSymbol: string;
    strictMode: boolean;
    unlockAt: Date;
    lockedBalance: string;
    status: RetirementVaultStatus;
  }> = {}
) {
  return {
    id: overrides.id ?? "vault_1",
    customerAccountId: overrides.customerAccountId ?? "account_1",
    assetId: overrides.assetId ?? "asset_1",
    status: overrides.status ?? RetirementVaultStatus.active,
    strictMode: overrides.strictMode ?? true,
    unlockAt: overrides.unlockAt ?? new Date("2027-01-01T00:00:00.000Z"),
    lockedBalance: new Prisma.Decimal(overrides.lockedBalance ?? "10"),
    fundedAt: new Date("2026-04-20T10:00:00.000Z"),
    lastFundedAt: new Date("2026-04-20T10:00:00.000Z"),
    createdAt: new Date("2026-04-20T09:00:00.000Z"),
    updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    asset: {
      id: overrides.assetId ?? "asset_1",
      symbol: overrides.assetSymbol ?? "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    }
  };
}

function buildFundingIntentRecord(
  overrides: Partial<{
    id: string;
    retirementVaultId: string | null;
    assetId: string;
    assetSymbol: string;
    requestedAmount: string;
    settledAmount: string;
    idempotencyKey: string;
  }> = {}
) {
  return {
    id: overrides.id ?? "intent_1",
    customerAccountId: "account_1",
    retirementVaultId: overrides.retirementVaultId ?? "vault_1",
    assetId: overrides.assetId ?? "asset_1",
    chainId: 8453,
    intentType: TransactionIntentType.vault_subscription,
    status: TransactionIntentStatus.settled,
    policyDecision: PolicyDecision.approved,
    requestedAmount: new Prisma.Decimal(overrides.requestedAmount ?? "5"),
    settledAmount: new Prisma.Decimal(overrides.settledAmount ?? "5"),
    idempotencyKey: overrides.idempotencyKey ?? "vault_fund_key_1",
    createdAt: new Date("2026-04-20T10:00:00.000Z"),
    updatedAt: new Date("2026-04-20T10:01:00.000Z"),
    asset: {
      id: overrides.assetId ?? "asset_1",
      symbol: overrides.assetSymbol ?? "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    retirementVault: overrides.retirementVaultId
      ? {
          id: overrides.retirementVaultId
        }
      : null
  };
}

function createService() {
  const transactionClient = {
    retirementVault: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    retirementVaultEvent: {
      create: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    transactionIntent: {
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
    retirementVault: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    transactionIntent: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    )
  };

  const ledgerService = {
    fundRetirementVaultBalance: jest.fn()
  };

  const service = new RetirementVaultService(
    prismaService as never,
    ledgerService as never
  );

  return {
    service,
    prismaService,
    transactionClient,
    ledgerService
  };
}

describe("RetirementVaultService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists retirement vault snapshots for the authenticated customer", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1"
    });
    prismaService.retirementVault.findMany.mockResolvedValue([
      buildVaultRecord()
    ]);

    const result = await service.listMyRetirementVaults("supabase_1");

    expect(result.customerAccountId).toBe("account_1");
    expect(result.vaults).toHaveLength(1);
    expect(result.vaults[0].lockedBalance).toBe("10");
  });

  it("creates a retirement vault with audit and event records", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: AccountLifecycleStatus.active,
      customer: {
        id: "customer_1"
      }
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active
    });
    prismaService.retirementVault.findUnique.mockResolvedValue(null);
    transactionClient.retirementVault.create.mockResolvedValue(buildVaultRecord());
    transactionClient.retirementVaultEvent.create.mockResolvedValue({
      id: "vault_event_1",
      eventType: RetirementVaultEventType.created
    });
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_1"
    });

    const result = await service.createMyRetirementVault("supabase_1", {
      assetSymbol: "usdc",
      unlockAt: "2027-01-01T00:00:00.000Z",
      strictMode: true
    });

    expect(result.created).toBe(true);
    expect(result.vault.asset.symbol).toBe("USDC");
    expect(transactionClient.retirementVaultEvent.create).toHaveBeenCalledTimes(1);
    expect(transactionClient.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("reuses an idempotent retirement vault funding request", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: AccountLifecycleStatus.active,
      customer: {
        id: "customer_1"
      }
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active
    });
    prismaService.retirementVault.findUnique
      .mockResolvedValueOnce(buildVaultRecord())
      .mockResolvedValueOnce(buildVaultRecord());
    prismaService.transactionIntent.findUnique.mockResolvedValue(
      buildFundingIntentRecord()
    );

    const result = await service.fundMyRetirementVault("supabase_1", {
      idempotencyKey: "vault_fund_key_1",
      assetSymbol: "USDC",
      amount: "5"
    });

    expect(result.idempotencyReused).toBe(true);
    expect(result.intent.intentType).toBe(TransactionIntentType.vault_subscription);
  });

  it("creates a settled vault funding intent and moves balance through the ledger", async () => {
    const { service, prismaService, transactionClient, ledgerService } =
      createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: AccountLifecycleStatus.active,
      customer: {
        id: "customer_1"
      }
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active
    });
    prismaService.retirementVault.findUnique.mockResolvedValue(buildVaultRecord());
    prismaService.transactionIntent.findUnique.mockResolvedValue(null);
    transactionClient.transactionIntent.create.mockResolvedValue(
      buildFundingIntentRecord()
    );
    ledgerService.fundRetirementVaultBalance.mockResolvedValue({
      ledgerJournalId: "ledger_journal_1",
      availableBalance: "15",
      lockedBalance: "10"
    });
    transactionClient.retirementVaultEvent.create.mockResolvedValue({
      id: "vault_event_1",
      eventType: RetirementVaultEventType.funded
    });
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_1"
    });
    transactionClient.retirementVault.findUnique.mockResolvedValue(
      buildVaultRecord({
        lockedBalance: "10"
      })
    );

    const result = await service.fundMyRetirementVault("supabase_1", {
      idempotencyKey: "vault_fund_key_2",
      assetSymbol: "USDC",
      amount: "5"
    });

    expect(result.idempotencyReused).toBe(false);
    expect(result.intent.status).toBe(TransactionIntentStatus.settled);
    expect(ledgerService.fundRetirementVaultBalance).toHaveBeenCalledTimes(1);
    expect(transactionClient.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("rejects funding when the vault does not exist", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: AccountLifecycleStatus.active,
      customer: {
        id: "customer_1"
      }
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active
    });
    prismaService.retirementVault.findUnique.mockResolvedValue(null);

    await expect(
      service.fundMyRetirementVault("supabase_1", {
        idempotencyKey: "vault_fund_key_3",
        assetSymbol: "USDC",
        amount: "5"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects mismatched idempotent funding reuse", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: AccountLifecycleStatus.active,
      customer: {
        id: "customer_1"
      }
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active
    });
    prismaService.retirementVault.findUnique.mockResolvedValue(buildVaultRecord());
    prismaService.transactionIntent.findUnique.mockResolvedValue(
      buildFundingIntentRecord({
        requestedAmount: "7"
      })
    );

    await expect(
      service.fundMyRetirementVault("supabase_1", {
        idempotencyKey: "vault_fund_key_1",
        assetSymbol: "USDC",
        amount: "5"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
