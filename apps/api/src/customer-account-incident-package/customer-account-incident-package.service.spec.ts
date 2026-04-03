import { CustomerAccountIncidentPackageService } from "./customer-account-incident-package.service";

function createService() {
  const prismaService = {
    customerAssetBalance: {
      findMany: jest.fn()
    },
    customerAccountRestriction: {
      findMany: jest.fn()
    },
    reviewCase: {
      findMany: jest.fn()
    },
    oversightIncident: {
      findMany: jest.fn()
    },
    transactionIntent: {
      findMany: jest.fn()
    }
  } as any;

  const customerAccountOperationsService = {
    listCustomerAccountTimeline: jest.fn()
  } as any;

  const service = new CustomerAccountIncidentPackageService(
    prismaService,
    customerAccountOperationsService
  );

  return {
    service,
    prismaService,
    customerAccountOperationsService
  };
}

describe("CustomerAccountIncidentPackageService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("builds a stable incident package from timeline and related sources", async () => {
    const { service, prismaService, customerAccountOperationsService } =
      createService();

    customerAccountOperationsService.listCustomerAccountTimeline.mockResolvedValue({
      summary: {
        customer: {
          customerId: "customer_1",
          customerAccountId: "account_1",
          supabaseUserId: "supabase_1",
          email: "user@example.com",
          firstName: "Waqas",
          lastName: "Raza"
        },
        accountStatus: "restricted",
        currentRestriction: {
          active: true,
          restrictedAt: "2026-04-01T01:10:00.000Z",
          restrictedFromStatus: "active",
          restrictionReasonCode: "oversight_risk_hold",
          restrictedByOperatorId: "ops_1",
          restrictedByOversightIncidentId: "incident_1",
          restrictionReleasedAt: null,
          restrictionReleasedByOperatorId: null
        },
        counts: {
          totalTransactionIntents: 5,
          manuallyResolvedTransactionIntents: 1,
          openReviewCases: 2,
          openOversightIncidents: 1,
          activeAccountHolds: 1
        }
      },
      timeline: [
        {
          id: "timeline_1",
          eventType: "account_hold.applied",
          occurredAt: "2026-04-01T01:10:00.000Z",
          actorType: "operator",
          actorId: "ops_1",
          customerAccountId: "account_1",
          transactionIntentId: null,
          reviewCaseId: "review_case_2",
          oversightIncidentId: "incident_1",
          accountRestrictionId: "restriction_1",
          metadata: {}
        }
      ]
    });

    prismaService.customerAssetBalance.findMany.mockResolvedValue([
      {
        asset: {
          id: "asset_1",
          symbol: "USDC",
          displayName: "USD Coin",
          decimals: 6,
          chainId: 8453
        },
        availableBalance: { toString: () => "70" },
        pendingBalance: { toString: () => "5" },
        updatedAt: new Date("2026-04-01T01:15:00.000Z")
      }
    ]);

    prismaService.customerAccountRestriction.findMany
      .mockResolvedValueOnce([
        {
          id: "restriction_1",
          status: "active",
          restrictionReasonCode: "oversight_risk_hold",
          appliedByOperatorId: "ops_1",
          appliedByOperatorRole: "risk_manager",
          appliedNote: "Temporary hold.",
          previousStatus: "active",
          appliedAt: new Date("2026-04-01T01:10:00.000Z"),
          releasedAt: null,
          releasedByOperatorId: null,
          releasedByOperatorRole: null,
          releaseNote: null,
          restoredStatus: null,
          releaseDecisionStatus: "pending",
          releaseRequestedAt: new Date("2026-04-01T01:20:00.000Z"),
          releaseRequestedByOperatorId: "ops_1",
          releaseRequestNote: "Please review.",
          releaseDecidedAt: null,
          releaseDecidedByOperatorId: null,
          releaseDecisionNote: null,
          releaseReviewCase: {
            id: "review_case_2",
            type: "account_review",
            status: "in_progress",
            assignedOperatorId: "ops_2",
            startedAt: new Date("2026-04-01T01:20:00.000Z"),
            resolvedAt: null,
            dismissedAt: null
          },
          oversightIncident: {
            id: "incident_1",
            incidentType: "customer_manual_resolution_spike",
            status: "in_progress",
            reasonCode: "manual_resolution_threshold_exceeded",
            assignedOperatorId: "ops_2",
            openedAt: new Date("2026-04-01T01:00:00.000Z")
          }
        }
      ])
      .mockResolvedValueOnce([]);

    prismaService.reviewCase.findMany.mockResolvedValue([
      {
        id: "review_case_1",
        type: "withdrawal_review",
        status: "resolved",
        reasonCode: "policy_denied",
        notes: "Resolved.",
        assignedOperatorId: "ops_1",
        startedAt: new Date("2026-04-01T00:10:00.000Z"),
        resolvedAt: new Date("2026-04-01T00:30:00.000Z"),
        dismissedAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:30:00.000Z"),
        transactionIntent: null
      }
    ]);

    prismaService.oversightIncident.findMany.mockResolvedValue([
      {
        id: "incident_1",
        incidentType: "customer_manual_resolution_spike",
        status: "in_progress",
        reasonCode: "manual_resolution_threshold_exceeded",
        summaryNote: "Threshold exceeded.",
        subjectOperatorId: null,
        subjectOperatorRole: null,
        assignedOperatorId: "ops_2",
        openedAt: new Date("2026-04-01T01:00:00.000Z"),
        startedAt: new Date("2026-04-01T01:05:00.000Z"),
        resolvedAt: null,
        dismissedAt: null,
        createdAt: new Date("2026-04-01T01:00:00.000Z"),
        updatedAt: new Date("2026-04-01T01:05:00.000Z")
      }
    ]);

    prismaService.transactionIntent.findMany.mockResolvedValue([
      {
        id: "intent_1",
        intentType: "withdrawal",
        status: "manually_resolved",
        policyDecision: "denied",
        requestedAmount: { toString: () => "30" },
        settledAmount: null,
        failureCode: "policy_denied",
        failureReason: "Manual review rejected.",
        manuallyResolvedAt: new Date("2026-04-01T00:30:00.000Z"),
        manualResolutionReasonCode: "support_case_closed",
        manualResolutionNote: "Handled off-platform.",
        manualResolvedByOperatorId: "ops_1",
        manualResolutionOperatorRole: "operations_admin",
        manualResolutionReviewCaseId: "review_case_1",
        sourceWallet: {
          address: "0x0000000000000000000000000000000000000def"
        },
        destinationWallet: null,
        externalAddress: "0x0000000000000000000000000000000000000abc",
        asset: {
          id: "asset_1",
          symbol: "USDC",
          displayName: "USD Coin",
          decimals: 6,
          chainId: 8453
        },
        blockchainTransactions: [],
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:30:00.000Z")
      }
    ]);

    const result = await service.buildIncidentPackage({
      customerAccountId: "account_1",
      recentLimit: 20,
      timelineLimit: 100
    });

    expect(result.customer.customerAccountId).toBe("account_1");
    expect(result.balances).toHaveLength(1);
    expect(result.activeHolds).toHaveLength(1);
    expect(result.reviewCases).toHaveLength(1);
    expect(result.oversightIncidents).toHaveLength(1);
    expect(result.recentTransactionIntents).toHaveLength(1);
    expect(result.timeline).toHaveLength(1);
    expect(result.limits.recentLimit).toBe(20);
    expect(result.limits.timelineLimit).toBe(100);
  });

  it("renders markdown with expected sections", () => {
    const { service } = createService();

    const markdown = service.renderIncidentPackageMarkdown({
      generatedAt: "2026-04-01T02:00:00.000Z",
      customer: {
        customerId: "customer_1",
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "Waqas",
        lastName: "Raza"
      },
      accountStatus: "restricted",
      currentRestriction: {
        active: true,
        restrictedAt: "2026-04-01T01:10:00.000Z",
        restrictedFromStatus: "active",
        restrictionReasonCode: "oversight_risk_hold",
        restrictedByOperatorId: "ops_1",
        restrictedByOversightIncidentId: "incident_1",
        restrictionReleasedAt: null,
        restrictionReleasedByOperatorId: null
      },
      counts: {
        totalTransactionIntents: 5,
        manuallyResolvedTransactionIntents: 1,
        openReviewCases: 2,
        openOversightIncidents: 1,
        activeAccountHolds: 1
      },
      balances: [],
      activeHolds: [],
      holdHistory: [],
      reviewCases: [],
      oversightIncidents: [],
      recentTransactionIntents: [],
      timeline: [],
      limits: {
        recentLimit: 20,
        timelineLimit: 100
      }
    });

    expect(markdown).toContain("# Customer Account Incident Package");
    expect(markdown).toContain("## Current restriction");
    expect(markdown).toContain("## Operational counts");
    expect(markdown).toContain("## Timeline");
  });
});
