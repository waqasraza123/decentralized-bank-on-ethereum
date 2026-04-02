import {
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  ReviewCaseEventType,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "./review-cases.service";

function buildReviewCaseRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "review_case_1",
    customerId: "customer_1",
    customerAccountId: "account_1",
    transactionIntentId: "intent_1",
    type: ReviewCaseType.reconciliation_review,
    status: ReviewCaseStatus.open,
    reasonCode: "settled_amount_mismatch",
    notes: "Manual review is required.",
    assignedOperatorId: null,
    startedAt: null,
    resolvedAt: null,
    dismissedAt: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    customer: {
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "user@example.com",
      firstName: "Waqas",
      lastName: "Raza"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1"
    },
    transactionIntent: {
      id: "intent_1",
      intentType: TransactionIntentType.deposit,
      status: TransactionIntentStatus.settled,
      policyDecision: PolicyDecision.approved,
      requestedAmount: new Prisma.Decimal("25"),
      settledAmount: new Prisma.Decimal("20"),
      failureCode: null,
      failureReason: null,
      sourceWalletId: null,
      destinationWalletId: "wallet_1",
      externalAddress: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:10:00.000Z"),
      asset: {
        id: "asset_1",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453
      },
      sourceWallet: null,
      destinationWallet: {
        id: "wallet_1",
        address: "0x0000000000000000000000000000000000000fed"
      },
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.confirmed,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed",
          createdAt: new Date("2026-04-01T00:01:00.000Z"),
          updatedAt: new Date("2026-04-01T00:05:00.000Z"),
          confirmedAt: new Date("2026-04-01T00:05:00.000Z")
        }
      ]
    },
    ...overrides
  };
}

function createService() {
  const prismaService = {
    reviewCase: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    reviewCaseEvent: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    transactionIntent: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    customerAssetBalance: {
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const service = new ReviewCasesService(prismaService);

  return {
    service,
    prismaService
  };
}

describe("ReviewCasesService workspace workflow", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("starts a review case and assigns the operator", async () => {
    const { service, prismaService } = createService();

    jest
      .spyOn(service as any, "findReviewCaseById")
      .mockResolvedValue(buildReviewCaseRecord());

    const updatedReviewCase = buildReviewCaseRecord({
      status: ReviewCaseStatus.in_progress,
      assignedOperatorId: "ops_1",
      startedAt: new Date("2026-04-01T00:20:00.000Z")
    });

    const transaction = {
      reviewCase: {
        update: jest.fn().mockResolvedValue(updatedReviewCase)
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue({
          id: "event_1",
          reviewCaseId: "review_case_1",
          actorType: "operator",
          actorId: "ops_1",
          eventType: ReviewCaseEventType.started,
          note: "Taking ownership.",
          metadata: null,
          createdAt: new Date("2026-04-01T00:20:00.000Z")
        })
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.startReviewCase("review_case_1", "ops_1", {
      note: "Taking ownership."
    });

    expect(result.stateReused).toBe(false);
    expect(result.reviewCase.status).toBe(ReviewCaseStatus.in_progress);
    expect(result.reviewCase.assignedOperatorId).toBe("ops_1");
  });

  it("adds a review case note and writes a review case event", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord({
        status: ReviewCaseStatus.in_progress,
        assignedOperatorId: "ops_1"
      })
    );

    const updatedReviewCase = buildReviewCaseRecord({
      status: ReviewCaseStatus.in_progress,
      assignedOperatorId: "ops_1",
      notes: "Investigated tx hash mismatch."
    });

    const createdEvent = {
      id: "event_2",
      reviewCaseId: "review_case_1",
      actorType: "operator",
      actorId: "ops_1",
      eventType: ReviewCaseEventType.note_added,
      note: "Investigated tx hash mismatch.",
      metadata: {
        assignedOperatorId: "ops_1",
        status: ReviewCaseStatus.in_progress
      },
      createdAt: new Date("2026-04-01T00:25:00.000Z")
    };

    const transaction = {
      reviewCase: {
        update: jest.fn().mockResolvedValue(updatedReviewCase)
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue(createdEvent)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.addReviewCaseNote("review_case_1", "ops_1", {
      note: "Investigated tx hash mismatch."
    });

    expect(result.reviewCase.notes).toBe("Investigated tx hash mismatch.");
    expect(result.event.eventType).toBe(ReviewCaseEventType.note_added);
  });

  it("hands off a review case to another operator", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord({
        status: ReviewCaseStatus.in_progress,
        assignedOperatorId: "ops_1",
        startedAt: new Date("2026-04-01T00:20:00.000Z")
      })
    );

    const updatedReviewCase = buildReviewCaseRecord({
      status: ReviewCaseStatus.in_progress,
      assignedOperatorId: "ops_2",
      startedAt: new Date("2026-04-01T00:20:00.000Z")
    });

    const transaction = {
      reviewCase: {
        update: jest.fn().mockResolvedValue(updatedReviewCase)
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue({
          id: "event_3",
          reviewCaseId: "review_case_1",
          actorType: "operator",
          actorId: "ops_1",
          eventType: ReviewCaseEventType.handed_off,
          note: "Passing to ops_2.",
          metadata: null,
          createdAt: new Date("2026-04-01T00:30:00.000Z")
        })
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.handoffReviewCase("review_case_1", "ops_1", {
      nextOperatorId: "ops_2",
      note: "Passing to ops_2."
    });

    expect(result.stateReused).toBe(false);
    expect(result.reviewCase.assignedOperatorId).toBe("ops_2");
  });

  it("returns a full review case workspace", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord({
        status: ReviewCaseStatus.in_progress,
        assignedOperatorId: "ops_1"
      })
    );

    (prismaService.reviewCaseEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event_1",
        reviewCaseId: "review_case_1",
        actorType: "operator",
        actorId: "ops_1",
        eventType: ReviewCaseEventType.started,
        note: "Taking ownership.",
        metadata: null,
        createdAt: new Date("2026-04-01T00:20:00.000Z")
      }
    ]);

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
      }
    ]);

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
      buildReviewCaseRecord().transactionIntent
    ]);

    const result = await service.getReviewCaseWorkspace("review_case_1", {
      recentLimit: 10
    });

    expect(result.caseEvents).toHaveLength(1);
    expect(result.relatedTransactionAuditEvents).toHaveLength(1);
    expect(result.balances).toHaveLength(1);
    expect(result.recentIntents).toHaveLength(1);
    expect(result.recentLimit).toBe(10);
  });

  it("rejects start when the review case is already resolved", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord({
        status: ReviewCaseStatus.resolved
      })
    );

    await expect(
      service.startReviewCase("review_case_1", "ops_1", {})
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects workspace when the review case does not exist", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(null);

    await expect(
      service.getReviewCaseWorkspace("missing_case", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
