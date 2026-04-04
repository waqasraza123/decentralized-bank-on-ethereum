import { PrismaService } from "../prisma/prisma.service";
import { CustomerAccountIncidentPackageExportGovernanceService } from "./customer-account-incident-package-export-governance.service";
import { CustomerAccountIncidentPackageService } from "./customer-account-incident-package.service";

function buildBasePackage() {
  return {
    generatedAt: "2026-04-03T00:00:00.000Z",
    customer: {
      customerId: "customer_1",
      customerAccountId: "account_1",
      supabaseUserId: "supabase_1",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Doe"
    },
    accountStatus: "restricted",
    currentRestriction: {
      active: true,
      restrictedAt: "2026-04-01T00:00:00.000Z",
      restrictedFromStatus: "active",
      restrictionReasonCode: "manual_resolution_spike",
      restrictedByOperatorId: "ops_1",
      restrictedByOversightIncidentId: "incident_1",
      restrictionReleasedAt: null,
      restrictionReleasedByOperatorId: null
    },
    counts: {
      totalTransactionIntents: 4,
      manuallyResolvedTransactionIntents: 1,
      openReviewCases: 2,
      openOversightIncidents: 1,
      activeAccountHolds: 1
    },
    balances: [
      {
        asset: {
          id: "asset_1",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 8453
        },
        availableBalance: "10",
        pendingBalance: "1",
        updatedAt: "2026-04-02T00:00:00.000Z"
      }
    ],
    recentTransactionIntents: [
      {
        id: "intent_1",
        intentType: "withdrawal",
        status: "manually_resolved",
        policyDecision: "denied",
        requestedAmount: "5",
        settledAmount: null,
        failureCode: "policy_denied",
        failureReason: "review required",
        manuallyResolvedAt: "2026-04-02T10:00:00.000Z",
        manualResolutionReasonCode: "support_case_closed",
        manualResolutionNote: "resolved manually",
        manualResolvedByOperatorId: "ops_1",
        manualResolutionOperatorRole: "operations_admin",
        manualResolutionReviewCaseId: "review_case_1",
        sourceWalletAddress: "0x1111111111111111111111111111111111111111",
        destinationWalletAddress: null,
        externalAddress: "0x2222222222222222222222222222222222222222",
        latestBlockchainTransaction: {
          id: "btx_1",
          txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "failed",
          fromAddress: "0x1111111111111111111111111111111111111111",
          toAddress: "0x2222222222222222222222222222222222222222",
          createdAt: "2026-04-02T09:00:00.000Z",
          updatedAt: "2026-04-02T09:10:00.000Z",
          confirmedAt: null
        },
        createdAt: "2026-04-02T08:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z"
      }
    ],
    activeHolds: [
      {
        id: "restriction_1",
        status: "active",
        restrictionReasonCode: "manual_resolution_spike",
        appliedByOperatorId: "ops_1",
        appliedByOperatorRole: "risk_manager",
        appliedNote: "protective hold",
        previousStatus: "active",
        appliedAt: "2026-04-02T11:00:00.000Z",
        releasedAt: null,
        releasedByOperatorId: null,
        releasedByOperatorRole: null,
        releaseNote: null,
        restoredStatus: null,
        releaseDecisionStatus: "pending",
        releaseRequestedAt: "2026-04-02T12:00:00.000Z",
        releaseRequestedByOperatorId: "ops_2",
        releaseRequestNote: "request release",
        releaseDecidedAt: null,
        releaseDecidedByOperatorId: null,
        releaseDecisionNote: null,
        releaseReviewCase: {
          id: "review_case_2",
          type: "account_review",
          status: "in_progress",
          assignedOperatorId: "ops_2",
          startedAt: "2026-04-02T12:05:00.000Z",
          resolvedAt: null,
          dismissedAt: null
        },
        oversightIncident: {
          id: "incident_1",
          incidentType: "customer_manual_resolution_spike",
          status: "in_progress",
          reasonCode: "manual_resolution_threshold_exceeded",
          assignedOperatorId: "ops_3",
          openedAt: "2026-04-02T11:00:00.000Z"
        }
      }
    ],
    holdHistory: [
      {
        id: "restriction_1",
        status: "active",
        restrictionReasonCode: "manual_resolution_spike",
        appliedByOperatorId: "ops_1",
        appliedByOperatorRole: "risk_manager",
        appliedNote: "protective hold",
        previousStatus: "active",
        appliedAt: "2026-04-02T11:00:00.000Z",
        releasedAt: null,
        releasedByOperatorId: null,
        releasedByOperatorRole: null,
        releaseNote: null,
        restoredStatus: null,
        releaseDecisionStatus: "pending",
        releaseRequestedAt: "2026-04-02T12:00:00.000Z",
        releaseRequestedByOperatorId: "ops_2",
        releaseRequestNote: "request release",
        releaseDecidedAt: null,
        releaseDecidedByOperatorId: null,
        releaseDecisionNote: null,
        releaseReviewCase: {
          id: "review_case_2",
          type: "account_review",
          status: "in_progress",
          assignedOperatorId: "ops_2",
          startedAt: "2026-04-02T12:05:00.000Z",
          resolvedAt: null,
          dismissedAt: null
        },
        oversightIncident: {
          id: "incident_1",
          incidentType: "customer_manual_resolution_spike",
          status: "in_progress",
          reasonCode: "manual_resolution_threshold_exceeded",
          assignedOperatorId: "ops_3",
          openedAt: "2026-04-02T11:00:00.000Z"
        }
      }
    ],
    reviewCases: [
      {
        id: "review_case_1",
        type: "withdrawal_review",
        status: "resolved",
        reasonCode: "policy_denied",
        notes: "resolved",
        assignedOperatorId: "ops_1",
        startedAt: "2026-04-02T09:30:00.000Z",
        resolvedAt: "2026-04-02T10:00:00.000Z",
        dismissedAt: null,
        createdAt: "2026-04-02T09:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z"
      }
    ],
    oversightIncidents: [
      {
        id: "incident_1",
        incidentType: "customer_manual_resolution_spike",
        status: "in_progress",
        reasonCode: "manual_resolution_threshold_exceeded",
        summaryNote: "needs review",
        assignedOperatorId: "ops_3",
        subjectOperatorId: null,
        subjectOperatorRole: null,
        openedAt: "2026-04-02T11:00:00.000Z",
        startedAt: "2026-04-02T11:05:00.000Z",
        resolvedAt: null,
        dismissedAt: null,
        createdAt: "2026-04-02T11:00:00.000Z",
        updatedAt: "2026-04-02T11:05:00.000Z"
      }
    ],
    timeline: [
      {
        id: "timeline_1",
        eventType: "account_hold.applied",
        occurredAt: "2026-04-02T11:00:00.000Z",
        actorType: "operator",
        actorId: "ops_1",
        customerAccountId: "account_1",
        transactionIntentId: null,
        reviewCaseId: "review_case_2",
        oversightIncidentId: "incident_1",
        accountRestrictionId: "restriction_1",
        metadata: {
          email: "jane@example.com",
          txHash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          sourceWalletAddress: "0x1111111111111111111111111111111111111111"
        }
      },
      {
        id: "timeline_2",
        eventType: "transaction_intent.manually_resolved",
        occurredAt: "2026-04-02T10:00:00.000Z",
        actorType: "operator",
        actorId: "ops_1",
        customerAccountId: "account_1",
        transactionIntentId: "intent_1",
        reviewCaseId: "review_case_1",
        oversightIncidentId: null,
        accountRestrictionId: null,
        metadata: {
          manualResolutionReasonCode: "support_case_closed"
        }
      }
    ],
    limits: {
      recentLimit: 20,
      timelineLimit: 100
    }
  };
}

describe("CustomerAccountIncidentPackageExportGovernanceService", () => {
  const customerAccountIncidentPackageService = {
    buildIncidentPackage: jest.fn(),
    renderIncidentPackageMarkdown: jest.fn()
  } satisfies Pick<
    CustomerAccountIncidentPackageService,
    "buildIncidentPackage" | "renderIncidentPackageMarkdown"
  >;

  const prismaService = {
    auditEvent: {
      create: jest.fn()
    }
  } as unknown as PrismaService;

  const service = new CustomerAccountIncidentPackageExportGovernanceService(
    customerAccountIncidentPackageService as unknown as CustomerAccountIncidentPackageService,
    prismaService
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (
      customerAccountIncidentPackageService.buildIncidentPackage as jest.Mock
    ).mockResolvedValue(buildBasePackage());
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1"
    });
  });

  it("returns an internal full export and writes an audit event", async () => {
    const result = await service.getGovernedIncidentPackageExport(
      {
        customerAccountId: "account_1",
        mode: "internal_full",
        recentLimit: 10,
        timelineLimit: 50
      },
      "ops_9",
      "operations_admin"
    );

    expect(result.exportMetadata.exportMode).toBe("internal_full");
    expect(result.exportMetadata.redactionsApplied).toBe(false);
    expect(result.complianceSummary.openReviewCases).toBe(2);
    expect(prismaService.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("returns a redaction-ready export with masked pii and addresses", async () => {
    const result = await service.getGovernedIncidentPackageExport(
      {
        customerAccountId: "account_1",
        mode: "redaction_ready"
      },
      "ops_9",
      "compliance_lead"
    );

    const serialized = JSON.stringify(result.package);

    expect(result.exportMetadata.redactionsApplied).toBe(true);
    expect(serialized).toContain("j***@example.com");
    expect(serialized).toContain("0x1111...1111");
    expect(serialized).not.toContain("jane@example.com");
  });

  it("returns a compliance-focused export with curated compliance fields", async () => {
    const result = await service.getGovernedIncidentPackageExport(
      {
        customerAccountId: "account_1",
        mode: "compliance_focused",
        sinceDays: 30
      },
      "ops_9",
      "compliance_lead"
    );

    const payload = result.package as {
      complianceSummary: unknown;
      timeline: Array<{ eventType: string }>;
    };

    expect(result.exportMetadata.exportMode).toBe("compliance_focused");
    expect(payload.complianceSummary).toBeDefined();
    expect(payload.timeline.every((entry) => entry.eventType.length > 0)).toBe(
      true
    );
  });

  it("returns governed markdown export", async () => {
    const result = await service.getGovernedIncidentPackageExportMarkdown(
      {
        customerAccountId: "account_1",
        mode: "compliance_focused"
      },
      "ops_9",
      "compliance_lead"
    );

    expect(result.markdown).toContain(
      "# Customer Account Governed Incident Package Export"
    );
    expect(result.markdown).toContain("Mode: compliance_focused");
    expect(result.markdown).toContain("Checksum sha256:");
  });
});
