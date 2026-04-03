import { Prisma, ReviewCaseType, TransactionIntentType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ManualResolutionReportingService } from "./manual-resolution-reporting.service";

function buildIntentRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "intent_1",
    customerAccountId: "account_1",
    intentType: TransactionIntentType.withdrawal,
    requestedAmount: new Prisma.Decimal("30"),
    settledAmount: null,
    failureCode: "policy_denied",
    failureReason: "Manual review rejected.",
    externalAddress: "0x0000000000000000000000000000000000000abc",
    manuallyResolvedAt: new Date("2026-04-01T00:30:00.000Z"),
    manualResolutionReasonCode: "support_case_closed",
    manualResolutionNote: "Handled off-platform.",
    manualResolvedByOperatorId: "ops_1",
    manualResolutionOperatorRole: "operations_admin",
    manualResolutionReviewCaseId: "review_case_1",
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
    destinationWallet: null,
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
    blockchainTransactions: [],
    ...overrides
  };
}

function createService() {
  const prismaService = {
    transactionIntent: {
      findMany: jest.fn()
    },
    reviewCase: {
      findMany: jest.fn()
    }
  } as unknown as PrismaService;

  const service = new ManualResolutionReportingService(prismaService);

  return {
    service,
    prismaService
  };
}

describe("ManualResolutionReportingService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("lists manually resolved intents", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildIntentRecord()
    ]);

    const result = await service.listManuallyResolvedIntents({
      limit: 20
    });

    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].manualResolvedByOperatorId).toBe("ops_1");
    expect(result.intents[0].manualResolutionOperatorRole).toBe(
      "operations_admin"
    );
  });

  it("lists manually resolved review cases", async () => {
    const { service, prismaService } = createService();

    (prismaService.reviewCase.findMany as jest.Mock).mockResolvedValue([
      {
        id: "review_case_1",
        type: ReviewCaseType.withdrawal_review,
        status: "resolved",
        reasonCode: "policy_denied",
        assignedOperatorId: "ops_1",
        customerAccountId: "account_1",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:30:00.000Z"),
        resolvedAt: new Date("2026-04-01T00:30:00.000Z"),
        customer: {
          id: "customer_1",
          supabaseUserId: "supabase_1",
          email: "user@example.com",
          firstName: "Waqas",
          lastName: "Raza"
        },
        transactionIntent: buildIntentRecord()
      }
    ]);

    const result = await service.listManuallyResolvedReviewCases({
      limit: 20
    });

    expect(result.reviewCases).toHaveLength(1);
    expect(result.reviewCases[0].reviewCase.id).toBe("review_case_1");
    expect(result.reviewCases[0].transactionIntent.manualResolvedByOperatorId).toBe(
      "ops_1"
    );
  });

  it("returns manual resolution summary counts", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildIntentRecord(),
      buildIntentRecord({
        id: "intent_2",
        intentType: TransactionIntentType.deposit,
        manualResolutionReasonCode: "duplicate_request_closed",
        manualResolvedByOperatorId: "ops_2",
        manualResolutionOperatorRole: "risk_manager"
      })
    ]);

    const result = await service.getManualResolutionSummary({
      sinceDays: 30
    });

    expect(result.totalIntents).toBe(2);
    expect(result.byIntentType).toHaveLength(2);
    expect(result.byReasonCode).toHaveLength(2);
    expect(result.byOperator).toHaveLength(2);
  });
});
