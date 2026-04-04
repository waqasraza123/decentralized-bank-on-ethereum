import {
  CustomerAccountIncidentPackageReleaseStatus,
  IncidentPackageExportMode,
  IncidentPackageReleaseTarget
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerAccountIncidentPackageExportGovernanceService } from "./customer-account-incident-package-export-governance.service";
import { CustomerAccountIncidentPackageReleaseWorkflowService } from "./customer-account-incident-package-release-workflow.service";

function buildReleaseRecord(
  overrides: Partial<{
    id: string;
    status: CustomerAccountIncidentPackageReleaseStatus;
    requestedByOperatorId: string;
    requestedByOperatorRole: string | null;
    approvedByOperatorId: string | null;
    approvedByOperatorRole: string | null;
    rejectedByOperatorId: string | null;
    rejectedByOperatorRole: string | null;
    releasedByOperatorId: string | null;
    releasedByOperatorRole: string | null;
    approvalNote: string | null;
    rejectionNote: string | null;
    releaseNote: string | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    releasedAt: Date | null;
    expiresAt: Date | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "release_1",
    customerAccountId: "account_1",
    status:
      overrides.status ??
      CustomerAccountIncidentPackageReleaseStatus.pending_approval,
    exportMode: IncidentPackageExportMode.compliance_focused,
    releaseTarget: IncidentPackageReleaseTarget.compliance_handoff,
    releaseReasonCode: "compliance_review_request",
    requestedByOperatorId: overrides.requestedByOperatorId ?? "ops_requester",
    requestedByOperatorRole: overrides.requestedByOperatorRole ?? "operations_admin",
    approvedByOperatorId: overrides.approvedByOperatorId ?? null,
    approvedByOperatorRole: overrides.approvedByOperatorRole ?? null,
    rejectedByOperatorId: overrides.rejectedByOperatorId ?? null,
    rejectedByOperatorRole: overrides.rejectedByOperatorRole ?? null,
    releasedByOperatorId: overrides.releasedByOperatorId ?? null,
    releasedByOperatorRole: overrides.releasedByOperatorRole ?? null,
    requestNote: "request",
    approvalNote: overrides.approvalNote ?? null,
    rejectionNote: overrides.rejectionNote ?? null,
    releaseNote: overrides.releaseNote ?? null,
    artifactChecksumSha256: "checksum_1",
    artifactPayload: {
      exportMetadata: {
        exportMode: "compliance_focused",
        packageChecksumSha256: "checksum_1"
      }
    },
    requestedAt: new Date("2026-04-04T10:00:00.000Z"),
    approvedAt: overrides.approvedAt ?? null,
    rejectedAt: overrides.rejectedAt ?? null,
    releasedAt: overrides.releasedAt ?? null,
    expiresAt: overrides.expiresAt ?? null,
    createdAt: new Date("2026-04-04T10:00:00.000Z"),
    updatedAt: new Date("2026-04-04T10:00:00.000Z"),
    customerAccount: {
      id: "account_1",
      status: "restricted",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe"
      }
    }
  };
}

describe("CustomerAccountIncidentPackageReleaseWorkflowService", () => {
  const customerAccountIncidentPackageExportGovernanceService = {
    getGovernedIncidentPackageExport: jest.fn()
  } as unknown as CustomerAccountIncidentPackageExportGovernanceService;

  const prismaService = {
    customerAccountIncidentPackageRelease: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  } as unknown as PrismaService;

  const service = new CustomerAccountIncidentPackageReleaseWorkflowService(
    prismaService,
    customerAccountIncidentPackageExportGovernanceService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a release request from a governed export snapshot", async () => {
    (
      customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExport as jest.Mock
    ).mockResolvedValue({
      exportMetadata: {
        exportMode: "compliance_focused",
        packageChecksumSha256: "checksum_1"
      },
      complianceSummary: {},
      narrative: {},
      package: {
        customer: {
          customerAccountId: "account_1"
        }
      }
    });

    (
      prismaService.customerAccountIncidentPackageRelease.create as jest.Mock
    ).mockResolvedValue(buildReleaseRecord());

    const result = await service.createReleaseRequest(
      {
        customerAccountId: "account_1",
        mode: "compliance_focused",
        releaseTarget: "compliance_handoff",
        releaseReasonCode: "compliance_review_request"
      },
      "ops_requester",
      "operations_admin"
    );

    expect(result.release.status).toBe("pending_approval");
    expect(
      customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExport
    ).toHaveBeenCalled();
    expect(prismaService.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("blocks self-approval for dual control", async () => {
    (
      prismaService.customerAccountIncidentPackageRelease.findUnique as jest.Mock
    ).mockResolvedValue(buildReleaseRecord());

    await expect(
      service.approveRelease(
        "release_1",
        "ops_requester",
        "compliance_lead",
        {}
      )
    ).rejects.toThrow("cannot approve their own");
  });

  it("approves a pending release request", async () => {
    (
      prismaService.customerAccountIncidentPackageRelease.findUnique as jest.Mock
    ).mockResolvedValue(buildReleaseRecord());
    (
      prismaService.customerAccountIncidentPackageRelease.update as jest.Mock
    ).mockResolvedValue(
      buildReleaseRecord({
        status: CustomerAccountIncidentPackageReleaseStatus.approved,
        approvedByOperatorId: "ops_approver",
        approvedByOperatorRole: "compliance_lead",
        approvedAt: new Date("2026-04-04T11:00:00.000Z"),
        expiresAt: new Date("2026-04-07T11:00:00.000Z")
      })
    );

    const result = await service.approveRelease(
      "release_1",
      "ops_approver",
      "compliance_lead",
      {
        approvalNote: "approved"
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.release.status).toBe("approved");
  });

  it("rejects a pending release request", async () => {
    (
      prismaService.customerAccountIncidentPackageRelease.findUnique as jest.Mock
    ).mockResolvedValue(buildReleaseRecord());
    (
      prismaService.customerAccountIncidentPackageRelease.update as jest.Mock
    ).mockResolvedValue(
      buildReleaseRecord({
        status: CustomerAccountIncidentPackageReleaseStatus.rejected,
        rejectedByOperatorId: "ops_approver",
        rejectedByOperatorRole: "risk_manager",
        rejectedAt: new Date("2026-04-04T11:00:00.000Z"),
        rejectionNote: "rejected"
      })
    );

    const result = await service.rejectRelease(
      "release_1",
      "ops_approver",
      "risk_manager",
      {
        rejectionNote: "rejected"
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.release.status).toBe("rejected");
  });

  it("releases an approved package", async () => {
    (
      prismaService.customerAccountIncidentPackageRelease.findUnique as jest.Mock
    ).mockResolvedValue(
      buildReleaseRecord({
        status: CustomerAccountIncidentPackageReleaseStatus.approved,
        approvedByOperatorId: "ops_approver",
        approvedByOperatorRole: "compliance_lead",
        approvedAt: new Date("2026-04-04T11:00:00.000Z"),
        expiresAt: new Date("2099-04-07T11:00:00.000Z")
      })
    );
    (
      prismaService.customerAccountIncidentPackageRelease.update as jest.Mock
    ).mockResolvedValue(
      buildReleaseRecord({
        status: CustomerAccountIncidentPackageReleaseStatus.released,
        approvedByOperatorId: "ops_approver",
        approvedByOperatorRole: "compliance_lead",
        approvedAt: new Date("2026-04-04T11:00:00.000Z"),
        releasedByOperatorId: "ops_releaser",
        releasedByOperatorRole: "compliance_lead",
        releasedAt: new Date("2026-04-04T12:00:00.000Z"),
        expiresAt: new Date("2099-04-07T11:00:00.000Z")
      })
    );

    const result = await service.releaseApprovedPackage(
      "release_1",
      "ops_releaser",
      "compliance_lead",
      {
        releaseNote: "released"
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.release.status).toBe("released");
  });
});
