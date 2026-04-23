import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { loadIncidentPackageReleaseGovernanceRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  CustomerAccountIncidentPackageReleaseStatus,
  IncidentPackageExportMode,
  IncidentPackageReleaseTarget,
  Prisma
} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { CustomerAccountIncidentPackageExportGovernanceService } from "./customer-account-incident-package-export-governance.service";
import { ApproveCustomerAccountIncidentPackageReleaseDto } from "./dto/approve-customer-account-incident-package-release.dto";
import { CreateCustomerAccountIncidentPackageReleaseRequestDto } from "./dto/create-customer-account-incident-package-release-request.dto";
import { ListPendingCustomerAccountIncidentPackageReleasesDto } from "./dto/list-pending-customer-account-incident-package-releases.dto";
import { ListReleasedCustomerAccountIncidentPackageReleasesDto } from "./dto/list-released-customer-account-incident-package-releases.dto";
import { RejectCustomerAccountIncidentPackageReleaseDto } from "./dto/reject-customer-account-incident-package-release.dto";
import { ReleaseCustomerAccountIncidentPackageReleaseDto } from "./dto/release-customer-account-incident-package-release.dto";

const incidentPackageReleaseInclude = {
  customerAccount: {
    select: {
      id: true,
      status: true,
      customer: {
        select: {
          id: true,
          supabaseUserId: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  }
} satisfies Prisma.CustomerAccountIncidentPackageReleaseInclude;

type IncidentPackageReleaseRecord =
  Prisma.CustomerAccountIncidentPackageReleaseGetPayload<{
    include: typeof incidentPackageReleaseInclude;
  }>;

type IncidentPackageReleaseProjection = {
  id: string;
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    accountStatus: string;
  };
  status: CustomerAccountIncidentPackageReleaseStatus;
  exportMode: IncidentPackageExportMode;
  releaseTarget: IncidentPackageReleaseTarget;
  releaseReasonCode: string;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  releasedByOperatorId: string | null;
  releasedByOperatorRole: string | null;
  requestNote: string | null;
  approvalNote: string | null;
  rejectionNote: string | null;
  releaseNote: string | null;
  artifactChecksumSha256: string;
  artifactPayload: Prisma.JsonValue;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  releasedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateIncidentPackageReleaseRequestResult = {
  release: IncidentPackageReleaseProjection;
};

type UpdateIncidentPackageReleaseResult = {
  release: IncidentPackageReleaseProjection;
  stateReused: boolean;
};

type ListIncidentPackageReleasesResult = {
  releases: IncidentPackageReleaseProjection[];
  limit: number;
};

type GovernedIncidentPackageExportEnvelope = Awaited<
  ReturnType<
    CustomerAccountIncidentPackageExportGovernanceService["getGovernedIncidentPackageExport"]
  >
>;

@Injectable()
export class CustomerAccountIncidentPackageReleaseWorkflowService {
  private readonly approverAllowedRoles: string[];
  private readonly approvalExpiryHours: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly customerAccountIncidentPackageExportGovernanceService: CustomerAccountIncidentPackageExportGovernanceService,
    @Optional()
    private readonly notificationsService?: Pick<
      NotificationsService,
      "publishAuditEventRecord"
    >
  ) {
    const config = loadIncidentPackageReleaseGovernanceRuntimeConfig();

    this.approverAllowedRoles = [
      ...config.incidentPackageReleaseApproverAllowedOperatorRoles
    ];
    this.approvalExpiryHours = config.incidentPackageReleaseApprovalExpiryHours;
  }

  private async appendAuditEvent(args: Prisma.AuditEventCreateArgs) {
    const auditEvent = await this.prismaService.auditEvent.create(args);

    if (this.notificationsService) {
      await this.notificationsService.publishAuditEventRecord(auditEvent);
    }

    return auditEvent;
  }

  private normalizeOperatorRole(operatorRole?: string): string | null {
    const normalizedOperatorRole = operatorRole?.trim().toLowerCase() ?? null;

    return normalizedOperatorRole && normalizedOperatorRole.length > 0
      ? normalizedOperatorRole
      : null;
  }

  private assertCanApproveOrRelease(operatorRole?: string): string | null {
    const normalizedOperatorRole = this.normalizeOperatorRole(operatorRole);

    if (
      !normalizedOperatorRole ||
      !this.approverAllowedRoles.includes(normalizedOperatorRole)
    ) {
      throw new ForbiddenException(
        "Operator role is not authorized to approve or release incident package exports."
      );
    }

    return normalizedOperatorRole;
  }

  private buildExpiryDate(fromDate: Date): Date {
    return new Date(fromDate.getTime() + this.approvalExpiryHours * 60 * 60 * 1000);
  }

  private resolveCustomerAccountId(
    dto: CreateCustomerAccountIncidentPackageReleaseRequestDto,
    exportEnvelope: GovernedIncidentPackageExportEnvelope
  ): string | null {
    const requestedCustomerAccountId = dto.customerAccountId?.trim();

    if (requestedCustomerAccountId) {
      return requestedCustomerAccountId;
    }

    const packageValue = exportEnvelope.package;

    if (
      packageValue === null ||
      Array.isArray(packageValue) ||
      typeof packageValue !== "object"
    ) {
      return null;
    }

    const customerValue = (packageValue as Prisma.JsonObject).customer;

    if (
      customerValue === null ||
      customerValue === undefined ||
      Array.isArray(customerValue) ||
      typeof customerValue !== "object"
    ) {
      return null;
    }

    const customerAccountId = (customerValue as Prisma.JsonObject).customerAccountId;

    if (typeof customerAccountId !== "string") {
      return null;
    }

    const normalizedCustomerAccountId = customerAccountId.trim();

    return normalizedCustomerAccountId.length > 0 ? normalizedCustomerAccountId : null;
  }

  private mapProjection(
    release: IncidentPackageReleaseRecord
  ): IncidentPackageReleaseProjection {
    return {
      id: release.id,
      customer: {
        customerId: release.customerAccount.customer.id,
        customerAccountId: release.customerAccount.id,
        supabaseUserId: release.customerAccount.customer.supabaseUserId,
        email: release.customerAccount.customer.email,
        firstName: release.customerAccount.customer.firstName ?? "",
        lastName: release.customerAccount.customer.lastName ?? "",
        accountStatus: release.customerAccount.status
      },
      status: release.status,
      exportMode: release.exportMode,
      releaseTarget: release.releaseTarget,
      releaseReasonCode: release.releaseReasonCode,
      requestedByOperatorId: release.requestedByOperatorId,
      requestedByOperatorRole: release.requestedByOperatorRole ?? null,
      approvedByOperatorId: release.approvedByOperatorId ?? null,
      approvedByOperatorRole: release.approvedByOperatorRole ?? null,
      rejectedByOperatorId: release.rejectedByOperatorId ?? null,
      rejectedByOperatorRole: release.rejectedByOperatorRole ?? null,
      releasedByOperatorId: release.releasedByOperatorId ?? null,
      releasedByOperatorRole: release.releasedByOperatorRole ?? null,
      requestNote: release.requestNote ?? null,
      approvalNote: release.approvalNote ?? null,
      rejectionNote: release.rejectionNote ?? null,
      releaseNote: release.releaseNote ?? null,
      artifactChecksumSha256: release.artifactChecksumSha256,
      artifactPayload: release.artifactPayload,
      requestedAt: release.requestedAt.toISOString(),
      approvedAt: release.approvedAt?.toISOString() ?? null,
      rejectedAt: release.rejectedAt?.toISOString() ?? null,
      releasedAt: release.releasedAt?.toISOString() ?? null,
      expiresAt: release.expiresAt?.toISOString() ?? null,
      createdAt: release.createdAt.toISOString(),
      updatedAt: release.updatedAt.toISOString()
    };
  }

  private async findReleaseById(
    releaseId: string
  ): Promise<IncidentPackageReleaseRecord | null> {
    return this.prismaService.customerAccountIncidentPackageRelease.findUnique({
      where: {
        id: releaseId
      },
      include: incidentPackageReleaseInclude
    });
  }

  private async expireReleaseIfNeeded(
    release: IncidentPackageReleaseRecord
  ): Promise<IncidentPackageReleaseRecord> {
    if (
      release.status !== CustomerAccountIncidentPackageReleaseStatus.approved ||
      !release.expiresAt ||
      release.expiresAt > new Date()
    ) {
      return release;
    }

    const updatedRelease =
      await this.prismaService.customerAccountIncidentPackageRelease.update({
        where: {
          id: release.id
        },
        data: {
          status: CustomerAccountIncidentPackageReleaseStatus.expired
        },
        include: incidentPackageReleaseInclude
      });

    await this.appendAuditEvent({
      data: {
        customerId: release.customerAccount.customer.id,
        actorType: "system",
        actorId: null,
        action: "customer_account.incident_package_release_expired",
        targetType: "CustomerAccountIncidentPackageRelease",
        targetId: release.id,
        metadata: {
          customerAccountId: release.customerAccount.id,
          exportMode: release.exportMode,
          releaseTarget: release.releaseTarget,
          artifactChecksumSha256: release.artifactChecksumSha256,
          expiresAt: release.expiresAt.toISOString()
        } as PrismaJsonValue
      }
    });

    return updatedRelease;
  }

  async createReleaseRequest(
    dto: CreateCustomerAccountIncidentPackageReleaseRequestDto,
    operatorId: string,
    operatorRole?: string
  ): Promise<CreateIncidentPackageReleaseRequestResult> {
    const exportEnvelope =
      await this.customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExport(
        {
          customerAccountId: dto.customerAccountId,
          supabaseUserId: dto.supabaseUserId,
          mode: dto.mode,
          recentLimit: dto.recentLimit,
          timelineLimit: dto.timelineLimit,
          sinceDays: dto.sinceDays
        },
        operatorId,
        operatorRole
      );

    const customerAccountId = this.resolveCustomerAccountId(dto, exportEnvelope);

    if (!customerAccountId) {
      throw new NotFoundException(
        "Governed incident package export did not resolve a customer account id."
      );
    }

    const normalizedOperatorRole = this.normalizeOperatorRole(operatorRole);

    const createdRelease =
      await this.prismaService.customerAccountIncidentPackageRelease.create({
        data: {
          customerAccountId,
          status: CustomerAccountIncidentPackageReleaseStatus.pending_approval,
          exportMode: exportEnvelope.exportMetadata.exportMode,
          releaseTarget: dto.releaseTarget as IncidentPackageReleaseTarget,
          releaseReasonCode: dto.releaseReasonCode.trim(),
          requestedByOperatorId: operatorId,
          requestedByOperatorRole: normalizedOperatorRole,
          requestNote: dto.requestNote?.trim() ?? null,
          artifactChecksumSha256:
            exportEnvelope.exportMetadata.packageChecksumSha256,
          artifactPayload: exportEnvelope as unknown as PrismaJsonValue
        },
        include: incidentPackageReleaseInclude
      });

    await this.appendAuditEvent({
      data: {
        customerId: createdRelease.customerAccount.customer.id,
        actorType: "operator",
        actorId: operatorId,
        action: "customer_account.incident_package_release_requested",
        targetType: "CustomerAccountIncidentPackageRelease",
        targetId: createdRelease.id,
        metadata: {
          customerAccountId: createdRelease.customerAccount.id,
          exportMode: createdRelease.exportMode,
          releaseTarget: createdRelease.releaseTarget,
          releaseReasonCode: createdRelease.releaseReasonCode,
          requestNote: createdRelease.requestNote,
          artifactChecksumSha256: createdRelease.artifactChecksumSha256
        } as PrismaJsonValue
      }
    });

    return {
      release: this.mapProjection(createdRelease)
    };
  }

  async getRelease(
    releaseId: string
  ): Promise<{ release: IncidentPackageReleaseProjection }> {
    const release = await this.findReleaseById(releaseId);

    if (!release) {
      throw new NotFoundException("Incident package release not found.");
    }

    const resolvedRelease = await this.expireReleaseIfNeeded(release);

    return {
      release: this.mapProjection(resolvedRelease)
    };
  }

  async listPendingReleases(
    query: ListPendingCustomerAccountIncidentPackageReleasesDto
  ): Promise<ListIncidentPackageReleasesResult> {
    const limit = query.limit ?? 20;

    const releases =
      await this.prismaService.customerAccountIncidentPackageRelease.findMany({
        where: {
          status: CustomerAccountIncidentPackageReleaseStatus.pending_approval,
          customerAccountId: query.customerAccountId?.trim() || undefined,
          requestedByOperatorId: query.requestedByOperatorId?.trim() || undefined,
          exportMode: (query.mode as IncidentPackageExportMode | undefined) ?? undefined,
          releaseTarget:
            (query.releaseTarget as IncidentPackageReleaseTarget | undefined) ??
            undefined
        },
        orderBy: {
          requestedAt: "desc"
        },
        take: limit,
        include: incidentPackageReleaseInclude
      });

    return {
      releases: releases.map((release) => this.mapProjection(release)),
      limit
    };
  }

  async listReleasedReleases(
    query: ListReleasedCustomerAccountIncidentPackageReleasesDto
  ): Promise<ListIncidentPackageReleasesResult> {
    const limit = query.limit ?? 20;
    const where: Prisma.CustomerAccountIncidentPackageReleaseWhereInput = {
      status: CustomerAccountIncidentPackageReleaseStatus.released
    };

    if (query.customerAccountId?.trim()) {
      where.customerAccountId = query.customerAccountId.trim();
    }

    if (query.releasedByOperatorId?.trim()) {
      where.releasedByOperatorId = query.releasedByOperatorId.trim();
    }

    if (query.mode) {
      where.exportMode = query.mode as IncidentPackageExportMode;
    }

    if (query.releaseTarget) {
      where.releaseTarget = query.releaseTarget as IncidentPackageReleaseTarget;
    }

    if (query.sinceDays) {
      const sinceDate = new Date();
      sinceDate.setUTCDate(sinceDate.getUTCDate() - query.sinceDays);
      where.releasedAt = {
        gte: sinceDate
      };
    }

    const releases =
      await this.prismaService.customerAccountIncidentPackageRelease.findMany({
        where,
        orderBy: {
          releasedAt: "desc"
        },
        take: limit,
        include: incidentPackageReleaseInclude
      });

    return {
      releases: releases.map((release) => this.mapProjection(release)),
      limit
    };
  }

  async approveRelease(
    releaseId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: ApproveCustomerAccountIncidentPackageReleaseDto
  ): Promise<UpdateIncidentPackageReleaseResult> {
    const normalizedOperatorRole =
      this.assertCanApproveOrRelease(operatorRole);
    const release = await this.findReleaseById(releaseId);

    if (!release) {
      throw new NotFoundException("Incident package release not found.");
    }

    const resolvedRelease = await this.expireReleaseIfNeeded(release);

    if (
      resolvedRelease.status === CustomerAccountIncidentPackageReleaseStatus.approved
    ) {
      return {
        release: this.mapProjection(resolvedRelease),
        stateReused: true
      };
    }

    if (
      resolvedRelease.status !==
      CustomerAccountIncidentPackageReleaseStatus.pending_approval
    ) {
      throw new ConflictException(
        "Incident package release is not pending approval."
      );
    }

    if (resolvedRelease.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "The release requester cannot approve their own release request."
      );
    }

    const approvedAt = new Date();
    const expiresAt = this.buildExpiryDate(approvedAt);

    const updatedRelease =
      await this.prismaService.customerAccountIncidentPackageRelease.update({
        where: {
          id: resolvedRelease.id
        },
        data: {
          status: CustomerAccountIncidentPackageReleaseStatus.approved,
          approvedAt,
          approvedByOperatorId: operatorId,
          approvedByOperatorRole: normalizedOperatorRole,
          approvalNote: dto.approvalNote?.trim() ?? null,
          expiresAt
        },
        include: incidentPackageReleaseInclude
      });

    await this.appendAuditEvent({
      data: {
        customerId: updatedRelease.customerAccount.customer.id,
        actorType: "operator",
        actorId: operatorId,
        action: "customer_account.incident_package_release_approved",
        targetType: "CustomerAccountIncidentPackageRelease",
        targetId: updatedRelease.id,
        metadata: {
          customerAccountId: updatedRelease.customerAccount.id,
          exportMode: updatedRelease.exportMode,
          releaseTarget: updatedRelease.releaseTarget,
          approvalNote: updatedRelease.approvalNote,
          approvedAt: approvedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          artifactChecksumSha256: updatedRelease.artifactChecksumSha256
        } as PrismaJsonValue
      }
    });

    return {
      release: this.mapProjection(updatedRelease),
      stateReused: false
    };
  }

  async rejectRelease(
    releaseId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: RejectCustomerAccountIncidentPackageReleaseDto
  ): Promise<UpdateIncidentPackageReleaseResult> {
    const normalizedOperatorRole =
      this.assertCanApproveOrRelease(operatorRole);
    const release = await this.findReleaseById(releaseId);

    if (!release) {
      throw new NotFoundException("Incident package release not found.");
    }

    const resolvedRelease = await this.expireReleaseIfNeeded(release);

    if (
      resolvedRelease.status === CustomerAccountIncidentPackageReleaseStatus.rejected
    ) {
      return {
        release: this.mapProjection(resolvedRelease),
        stateReused: true
      };
    }

    if (
      resolvedRelease.status !==
      CustomerAccountIncidentPackageReleaseStatus.pending_approval
    ) {
      throw new ConflictException(
        "Incident package release is not pending approval."
      );
    }

    if (resolvedRelease.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "The release requester cannot reject their own release request."
      );
    }

    const rejectedAt = new Date();

    const updatedRelease =
      await this.prismaService.customerAccountIncidentPackageRelease.update({
        where: {
          id: resolvedRelease.id
        },
        data: {
          status: CustomerAccountIncidentPackageReleaseStatus.rejected,
          rejectedAt,
          rejectedByOperatorId: operatorId,
          rejectedByOperatorRole: normalizedOperatorRole,
          rejectionNote: dto.rejectionNote?.trim() ?? null,
          expiresAt: null
        },
        include: incidentPackageReleaseInclude
      });

    await this.appendAuditEvent({
      data: {
        customerId: updatedRelease.customerAccount.customer.id,
        actorType: "operator",
        actorId: operatorId,
        action: "customer_account.incident_package_release_rejected",
        targetType: "CustomerAccountIncidentPackageRelease",
        targetId: updatedRelease.id,
        metadata: {
          customerAccountId: updatedRelease.customerAccount.id,
          exportMode: updatedRelease.exportMode,
          releaseTarget: updatedRelease.releaseTarget,
          rejectionNote: updatedRelease.rejectionNote,
          rejectedAt: rejectedAt.toISOString(),
          artifactChecksumSha256: updatedRelease.artifactChecksumSha256
        } as PrismaJsonValue
      }
    });

    return {
      release: this.mapProjection(updatedRelease),
      stateReused: false
    };
  }

  async releaseApprovedPackage(
    releaseId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: ReleaseCustomerAccountIncidentPackageReleaseDto
  ): Promise<UpdateIncidentPackageReleaseResult> {
    const normalizedOperatorRole =
      this.assertCanApproveOrRelease(operatorRole);
    const release = await this.findReleaseById(releaseId);

    if (!release) {
      throw new NotFoundException("Incident package release not found.");
    }

    const resolvedRelease = await this.expireReleaseIfNeeded(release);

    if (
      resolvedRelease.status === CustomerAccountIncidentPackageReleaseStatus.released
    ) {
      return {
        release: this.mapProjection(resolvedRelease),
        stateReused: true
      };
    }

    if (
      resolvedRelease.status !==
      CustomerAccountIncidentPackageReleaseStatus.approved
    ) {
      throw new ConflictException(
        "Incident package release is not approved for release."
      );
    }

    if (resolvedRelease.expiresAt && resolvedRelease.expiresAt <= new Date()) {
      throw new ConflictException("Approved incident package release has expired.");
    }

    const releasedAt = new Date();

    const updatedRelease =
      await this.prismaService.customerAccountIncidentPackageRelease.update({
        where: {
          id: resolvedRelease.id
        },
        data: {
          status: CustomerAccountIncidentPackageReleaseStatus.released,
          releasedAt,
          releasedByOperatorId: operatorId,
          releasedByOperatorRole: normalizedOperatorRole,
          releaseNote: dto.releaseNote?.trim() ?? null
        },
        include: incidentPackageReleaseInclude
      });

    await this.appendAuditEvent({
      data: {
        customerId: updatedRelease.customerAccount.customer.id,
        actorType: "operator",
        actorId: operatorId,
        action: "customer_account.incident_package_released",
        targetType: "CustomerAccountIncidentPackageRelease",
        targetId: updatedRelease.id,
        metadata: {
          customerAccountId: updatedRelease.customerAccount.id,
          exportMode: updatedRelease.exportMode,
          releaseTarget: updatedRelease.releaseTarget,
          releaseReasonCode: updatedRelease.releaseReasonCode,
          releasedAt: releasedAt.toISOString(),
          releaseNote: updatedRelease.releaseNote,
          artifactChecksumSha256: updatedRelease.artifactChecksumSha256
        } as PrismaJsonValue
      }
    });

    return {
      release: this.mapProjection(updatedRelease),
      stateReused: false
    };
  }
}
