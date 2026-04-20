import { NotFoundException } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  AssetStatus,
  PolicyDecision,
  Prisma,
  RetirementVaultEventType,
  RetirementVaultReleaseRequestKind,
  RetirementVaultReleaseRequestStatus,
  RetirementVaultStatus,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType,
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
    releaseRequests: unknown[];
    events: unknown[];
  }> = {},
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
      chainId: 8453,
    },
    releaseRequests: overrides.releaseRequests ?? [],
    events: overrides.events ?? [],
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
  }> = {},
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
      chainId: 8453,
    },
    retirementVault: overrides.retirementVaultId
      ? {
          id: overrides.retirementVaultId,
        }
      : null,
  };
}

function buildReviewCaseRecord(
  overrides: Partial<{
    id: string;
    status: ReviewCaseStatus;
    reasonCode: string | null;
    assignedOperatorId: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "review_1",
    type: ReviewCaseType.manual_intervention,
    status: overrides.status ?? ReviewCaseStatus.open,
    reasonCode: overrides.reasonCode ?? "retirement_vault_early_release",
    assignedOperatorId: overrides.assignedOperatorId ?? null,
    updatedAt: new Date("2026-04-20T12:00:00.000Z"),
  };
}

function buildReleaseRequestRecord(
  overrides: Partial<{
    id: string;
    retirementVaultId: string;
    requestKind: RetirementVaultReleaseRequestKind;
    requestedAmount: string;
    status: RetirementVaultReleaseRequestStatus;
    reviewCaseId: string | null;
    reviewCase: ReturnType<typeof buildReviewCaseRecord> | null;
    transactionIntent: {
      id: string;
      intentType: TransactionIntentType;
      status: TransactionIntentStatus;
      policyDecision: PolicyDecision;
      requestedAmount: Prisma.Decimal;
      settledAmount: Prisma.Decimal | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    cooldownEndsAt: Date | null;
    approvedAt: Date | null;
    readyForReleaseAt: Date | null;
    executionStartedAt: Date | null;
    releasedAt: Date | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "release_1",
    retirementVaultId: overrides.retirementVaultId ?? "vault_1",
    requestKind:
      overrides.requestKind ?? RetirementVaultReleaseRequestKind.early_unlock,
    requestedAmount: new Prisma.Decimal(overrides.requestedAmount ?? "3"),
    status:
      overrides.status ?? RetirementVaultReleaseRequestStatus.review_required,
    reasonCode: "hardship",
    reasonNote: "Need emergency access.",
    evidence: { note: "supporting context" },
    requestedByActorType: "customer",
    requestedByActorId: "supabase_1",
    reviewCaseId: overrides.reviewCaseId ?? overrides.reviewCase?.id ?? null,
    transactionIntentId: overrides.transactionIntent?.id ?? null,
    reviewRequiredAt: new Date("2026-04-20T11:00:00.000Z"),
    reviewDecidedAt: null,
    cooldownEndsAt: overrides.cooldownEndsAt ?? null,
    requestedAt: new Date("2026-04-20T11:00:00.000Z"),
    cooldownStartedAt: null,
    readyForReleaseAt: overrides.readyForReleaseAt ?? null,
    approvedAt: overrides.approvedAt ?? null,
    approvedByOperatorId: null,
    approvedByOperatorRole: null,
    rejectedAt: null,
    rejectedByOperatorId: null,
    rejectedByOperatorRole: null,
    cancelledAt: null,
    cancelledByActorType: null,
    cancelledByActorId: null,
    executionStartedAt: overrides.executionStartedAt ?? null,
    executedByWorkerId: null,
    executionFailureCode: null,
    executionFailureReason: null,
    releasedAt: overrides.releasedAt ?? null,
    createdAt: new Date("2026-04-20T11:00:00.000Z"),
    updatedAt: new Date("2026-04-20T11:00:00.000Z"),
    reviewCase: overrides.reviewCase ?? null,
    transactionIntent: overrides.transactionIntent ?? null,
  };
}

function buildInternalReleaseRequestRecord(
  overrides: Partial<{
    status: RetirementVaultReleaseRequestStatus;
    requestKind: RetirementVaultReleaseRequestKind;
    cooldownEndsAt: Date | null;
    readyForReleaseAt: Date | null;
    executionStartedAt: Date | null;
    transactionIntent: ReturnType<typeof buildFundingIntentRecord> | null;
  }> = {},
) {
  const reviewCase = buildReviewCaseRecord();
  const request = buildReleaseRequestRecord({
    status: overrides.status,
    requestKind: overrides.requestKind,
    reviewCase,
    reviewCaseId: reviewCase.id,
    cooldownEndsAt: overrides.cooldownEndsAt,
    readyForReleaseAt: overrides.readyForReleaseAt,
    executionStartedAt: overrides.executionStartedAt,
    transactionIntent: overrides.transactionIntent
      ? {
          id: overrides.transactionIntent.id,
          intentType: overrides.transactionIntent.intentType,
          status: overrides.transactionIntent.status,
          policyDecision: overrides.transactionIntent.policyDecision,
          requestedAmount: overrides.transactionIntent.requestedAmount,
          settledAmount: overrides.transactionIntent.settledAmount,
          createdAt: overrides.transactionIntent.createdAt,
          updatedAt: overrides.transactionIntent.updatedAt,
        }
      : null,
  });

  return {
    ...request,
    retirementVault: {
      ...buildVaultRecord(),
      customerAccount: {
        id: "account_1",
        status: AccountLifecycleStatus.active,
        customer: {
          id: "customer_1",
          supabaseUserId: "supabase_1",
          email: "vault@example.com",
          firstName: "Ada",
          lastName: "Vault",
        },
      },
    },
  };
}

function createService() {
  const transactionClient = {
    retirementVault: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    retirementVaultEvent: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    transactionIntent: {
      create: jest.fn(),
    },
    retirementVaultReleaseRequest: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    reviewCase: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reviewCaseEvent: {
      create: jest.fn(),
    },
  };

  const prismaService = {
    customerAccount: {
      findFirst: jest.fn(),
    },
    asset: {
      findUnique: jest.fn(),
    },
    retirementVault: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    transactionIntent: {
      findUnique: jest.fn(),
    },
    retirementVaultReleaseRequest: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    retirementVaultEvent: {
      findMany: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    ),
  };

  const ledgerService = {
    fundRetirementVaultBalance: jest.fn(),
    releaseRetirementVaultBalance: jest.fn(),
  };

  const reviewCasesService = {
    openOrReuseReviewCase: jest.fn(),
  };

  const service = new RetirementVaultService(
    prismaService as never,
    ledgerService as never,
    reviewCasesService as never,
  );

  return {
    service,
    prismaService,
    transactionClient,
    ledgerService,
    reviewCasesService,
  };
}

describe("RetirementVaultService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists retirement vault snapshots for the authenticated customer", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
    });
    prismaService.retirementVault.findMany.mockResolvedValue([buildVaultRecord()]);

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
        id: "customer_1",
      },
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active,
    });
    prismaService.retirementVault.findUnique.mockResolvedValue(null);
    transactionClient.retirementVault.create.mockResolvedValue(buildVaultRecord());
    transactionClient.retirementVaultEvent.create.mockResolvedValue({
      id: "vault_event_1",
      eventType: RetirementVaultEventType.created,
    });
    transactionClient.auditEvent.create.mockResolvedValue({ id: "audit_1" });

    const result = await service.createMyRetirementVault("supabase_1", {
      assetSymbol: "usdc",
      unlockAt: "2027-01-01T00:00:00.000Z",
      strictMode: true,
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
        id: "customer_1",
      },
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active,
    });
    prismaService.retirementVault.findUnique
      .mockResolvedValueOnce(buildVaultRecord())
      .mockResolvedValueOnce(buildVaultRecord());
    prismaService.transactionIntent.findUnique.mockResolvedValue(
      buildFundingIntentRecord(),
    );

    const result = await service.fundMyRetirementVault("supabase_1", {
      idempotencyKey: "vault_fund_key_1",
      assetSymbol: "USDC",
      amount: "5",
    });

    expect(result.idempotencyReused).toBe(true);
    expect(result.intent.intentType).toBe(TransactionIntentType.vault_subscription);
  });

  it("requests an early retirement vault release and opens a review case", async () => {
    const { service, prismaService, transactionClient, reviewCasesService } =
      createService();

    const reviewCase = buildReviewCaseRecord();
    const createdRequest = buildReleaseRequestRecord({
      reviewCase: null,
      reviewCaseId: null,
    });
    const linkedRequest = buildReleaseRequestRecord({
      reviewCase,
      reviewCaseId: reviewCase.id,
    });
    const updatedVault = buildVaultRecord({
      releaseRequests: [linkedRequest],
      events: [
        {
          id: "event_1",
          eventType: RetirementVaultEventType.release_requested,
          actorType: "customer",
          actorId: "supabase_1",
          metadata: null,
          createdAt: new Date("2026-04-20T11:00:00.000Z"),
        },
      ],
    });

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: AccountLifecycleStatus.active,
      customer: {
        id: "customer_1",
      },
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active,
    });
    prismaService.retirementVault.findUnique.mockResolvedValue(buildVaultRecord());
    reviewCasesService.openOrReuseReviewCase.mockResolvedValue({
      reviewCase,
      reviewCaseReused: false,
    });
    transactionClient.retirementVaultReleaseRequest.create.mockResolvedValue(
      createdRequest,
    );
    transactionClient.retirementVaultReleaseRequest.update.mockResolvedValue(
      linkedRequest,
    );
    transactionClient.retirementVaultEvent.create.mockResolvedValue({
      id: "vault_event_1",
    });
    transactionClient.auditEvent.create.mockResolvedValue({ id: "audit_1" });
    transactionClient.retirementVault.findUnique.mockResolvedValue(updatedVault);

    const result = await service.requestMyRetirementVaultRelease("supabase_1", {
      assetSymbol: "USDC",
      amount: "3",
      reasonCode: "hardship",
      reasonNote: "Need emergency access.",
      evidenceNote: "supporting context",
    });

    expect(result.reviewCaseReused).toBe(false);
    expect(result.releaseRequest.status).toBe(
      RetirementVaultReleaseRequestStatus.review_required,
    );
    expect(result.releaseRequest.reviewCase?.id).toBe(reviewCase.id);
    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalledTimes(1);
  });

  it("sweeps ready retirement vault release requests into released state", async () => {
    const { service, prismaService, transactionClient, ledgerService } =
      createService();
    const readyRequest = buildInternalReleaseRequestRecord({
      status: RetirementVaultReleaseRequestStatus.ready_for_release,
      requestKind: RetirementVaultReleaseRequestKind.scheduled_unlock,
      readyForReleaseAt: new Date("2026-04-20T12:00:00.000Z"),
    });
    const executingRequest = buildInternalReleaseRequestRecord({
      status: RetirementVaultReleaseRequestStatus.executing,
      requestKind: RetirementVaultReleaseRequestKind.scheduled_unlock,
      executionStartedAt: new Date("2026-04-20T12:01:00.000Z"),
    });

    prismaService.retirementVaultReleaseRequest.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([readyRequest]);
    prismaService.retirementVaultReleaseRequest.updateMany.mockResolvedValue({
      count: 1,
    });
    transactionClient.retirementVaultReleaseRequest.findUnique.mockResolvedValue(
      executingRequest,
    );
    transactionClient.transactionIntent.create.mockResolvedValue({
      id: "intent_release_1",
    });
    ledgerService.releaseRetirementVaultBalance.mockResolvedValue({
      ledgerJournalId: "journal_release_1",
      availableBalance: "8",
      lockedBalance: "0",
    });
    transactionClient.retirementVault.update.mockResolvedValue({
      id: "vault_1",
      status: RetirementVaultStatus.released,
    });
    transactionClient.retirementVaultReleaseRequest.update.mockResolvedValue({
      id: "release_1",
    });
    transactionClient.retirementVaultEvent.create.mockResolvedValue({
      id: "event_release_1",
    });
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_release_1",
    });

    const result = await service.sweepReleaseRequests("worker_1", 10);

    expect(result.releasedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.processedReleaseRequestIds).toEqual(["release_1"]);
    expect(ledgerService.releaseRetirementVaultBalance).toHaveBeenCalledTimes(1);
  });

  it("rejects funding when the vault does not exist", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      status: AccountLifecycleStatus.active,
      customer: {
        id: "customer_1",
      },
    });
    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "USDC",
      status: AssetStatus.active,
    });
    prismaService.retirementVault.findUnique.mockResolvedValue(null);

    await expect(
      service.fundMyRetirementVault("supabase_1", {
        idempotencyKey: "vault_fund_key_3",
        assetSymbol: "USDC",
        amount: "5",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
