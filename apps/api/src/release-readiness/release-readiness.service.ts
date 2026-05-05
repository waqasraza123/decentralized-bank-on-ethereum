import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { loadReleaseReadinessApprovalRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  Prisma,
  ReleaseReadinessApprovalStatus,
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import {
  assertOperatorRoleAuthorized,
  normalizeOperatorRole
} from "../auth/internal-operator-role-policy";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { CreateReleaseReadinessApprovalDto } from "./dto/create-release-readiness-approval.dto";
import {
  CreateReleaseReadinessEvidenceDto,
  solvencyAnchorRegistryDeploymentEvidenceType
} from "./dto/create-release-readiness-evidence.dto";
import { GetSolvencyAnchorRegistryDeploymentProofDto } from "./dto/get-solvency-anchor-registry-deployment-proof.dto";
import { ListReleaseLaunchClosurePacksDto } from "./dto/list-release-launch-closure-packs.dto";
import { ListReleaseReadinessApprovalLineageIncidentsDto } from "./dto/list-release-readiness-approval-lineage-incidents.dto";
import { ListReleaseReadinessApprovalsDto } from "./dto/list-release-readiness-approvals.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";
import {
  releaseReadinessChecklistSections,
  requiredReleaseReadinessChecks
} from "./release-readiness-checks";
import {
  describeReleaseReadinessEvidenceMetadataRequirements,
  describeReleaseReadinessEvidencePayloadRequirements,
  validateReleaseReadinessEvidenceMetadata,
  validateReleaseReadinessEvidencePayload
} from "./release-readiness-evidence-requirements";
import {
  ApproveReleaseReadinessApprovalDto,
  RejectReleaseReadinessApprovalDto
} from "./dto/release-readiness-approval.dto";
import {
  buildLaunchClosureArtifactManifest,
  previewLaunchClosurePack,
  renderLaunchClosureStatusSummary,
  renderLaunchClosureValidationSummary,
  validateLaunchClosureManifest,
  type LaunchClosureArtifactManifest,
  type LaunchClosureArtifactManifestFile,
  type LaunchClosureManifest,
  type LaunchClosurePackFile
} from "./launch-closure-pack";

type ReleaseReadinessEvidenceRecord =
  Prisma.ReleaseReadinessEvidenceGetPayload<{}>;
type ReleaseReadinessApprovalRecord =
  Prisma.ReleaseReadinessApprovalGetPayload<{}>;
type ReleaseLaunchClosurePackRecord =
  Prisma.ReleaseLaunchClosurePackGetPayload<{}>;
type AuditEventRecord = Prisma.AuditEventGetPayload<{}>;
type ContractDeploymentManifestRecord =
  Prisma.ContractDeploymentManifestGetPayload<{}>;

type SolvencyAnchorRegistryEvidencePayload = {
  chainId: number;
  contractAddress: string;
  deploymentTxHash: string;
  governanceOwner: string;
  authorizedAnchorer: string;
  abiChecksumSha256: string;
  onchainVerification?: {
    chainId?: number;
    contractAddress?: string;
    deploymentTxHash?: string;
    owner?: string;
    authorizedAnchorer?: string;
    bytecodePresent?: boolean;
    deploymentBlockNumber?: number | null;
    rpcUrlHost?: string;
  };
};

type RollbackDeploymentArtifactRecord = {
  releaseId: string;
  service: "api" | "worker";
  environment: ReleaseReadinessEnvironment;
  artifactKind: string;
  artifactUri: string;
  artifactDigestSha256: string;
  sourceCommitSha: string;
  runtime: string;
};

type RollbackDeploymentArtifactEvidencePayload = {
  proofKind: "deployment_artifact_manifest";
  service: "api" | "worker";
  approvalRollbackReleaseIdentifier: string;
  currentArtifact: RollbackDeploymentArtifactRecord;
  rollbackArtifact: RollbackDeploymentArtifactRecord;
  artifactManifestPath: "payloads/release-artifacts.json";
};

type SolvencyAnchorRegistryDeploymentProofStatus = {
  generatedAt: string;
  evidenceType: "solvency_anchor_registry_deployment";
  environment: ReleaseReadinessEnvironment;
  chainId: number;
  ready: boolean;
  blockers: string[];
  requiredOperatorInputs: string[];
  recordEvidenceEndpoint: "/release-readiness/internal/evidence";
  registryContract: {
    id: string;
    productSurface: "solvency_report_anchor_registry_v1";
    contractVersion: string;
    contractAddress: string;
    abiChecksumSha256: string;
    deploymentTxHash: string | null;
    governanceOwner: string | null;
    authorizedAnchorer: string | null;
    blockExplorerUrl: string | null;
    anchoredSmokeTxHash: string | null;
    manifestStatus: string;
    legacyPath: boolean;
    updatedAt: string;
  } | null;
  governedSigner: {
    id: string;
    signerScope: "solvency_anchor_execution";
    backendKind: string;
    keyReferenceSha256: string;
    signerAddress: string;
    allowedMethods: string[];
    manifestVersion: string | null;
    environmentBinding: string | null;
    active: boolean;
    updatedAt: string;
  } | null;
  governanceAuthority: {
    id: string;
    authorityType: "governance_safe";
    address: string;
    ownerLabel: string | null;
    manifestStatus: string;
    updatedAt: string;
  } | null;
  evidenceRequestDraft: {
    recordable: boolean;
    body: {
      evidenceType: "solvency_anchor_registry_deployment";
      environment: ReleaseReadinessEnvironment;
      status: "passed";
      releaseIdentifier: string;
      summary: string;
      runbookPath: string;
      evidencePayload: {
        proofKind: "manual_attestation";
        networkName: string;
        chainId: number;
        contractProductSurface: "solvency_report_anchor_registry_v1";
        signerScope: "solvency_anchor_execution";
        contractAddress: string;
        deploymentTxHash: string;
        governanceOwner: string;
        authorizedAnchorer: string;
        abiChecksumSha256: string;
        manifestPath: string;
        manifestCommitSha: string;
      };
    } | null;
  };
};

type ReleaseReadinessEvidenceProjection = {
  id: string;
  evidenceType: ReleaseReadinessEvidenceType;
  environment: ReleaseReadinessEnvironment;
  status: ReleaseReadinessEvidenceStatus;
  releaseIdentifier: string | null;
  rollbackReleaseIdentifier: string | null;
  backupReference: string | null;
  summary: string;
  note: string | null;
  operatorId: string;
  operatorRole: string | null;
  runbookPath: string | null;
  evidenceLinks: string[];
  evidencePayload: Prisma.JsonValue | null;
  startedAt: string | null;
  completedAt: string | null;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
};

type ReleaseReadinessEvidenceMutationResult = {
  evidence: ReleaseReadinessEvidenceProjection;
};

type ReleaseReadinessEvidenceList = {
  evidence: ReleaseReadinessEvidenceProjection[];
  limit: number;
  totalCount: number;
};

type ReleaseReadinessSummary = {
  generatedAt: string;
  releaseIdentifier: string | null;
  environment: ReleaseReadinessEnvironment | null;
  approvalPolicy: {
    requestAllowedOperatorRoles: string[];
    approverAllowedOperatorRoles: string[];
    maximumEvidenceAgeHours: number;
    currentOperator: {
      operatorId: string | null;
      operatorRole: string | null;
      canRequestApproval: boolean;
      canApproveOrReject: boolean;
    };
  };
  overallStatus: "healthy" | "warning" | "critical";
  summary: {
    requiredCheckCount: number;
    passedCheckCount: number;
    failedCheckCount: number;
    pendingCheckCount: number;
  };
  requiredChecks: Array<{
    evidenceType: ReleaseReadinessEvidenceType;
    label: string;
    description: string;
    runbookPath: string;
    acceptedEnvironments: ReleaseReadinessEnvironment[];
    status: "passed" | "failed" | "pending";
    latestEvidence: ReleaseReadinessEvidenceProjection | null;
  }>;
  recentEvidence: ReleaseReadinessEvidenceProjection[];
};

type ReleaseReadinessSummaryScope = {
  releaseIdentifier?: string | null;
  environment?: ReleaseReadinessEnvironment | null;
};

type ReleaseReadinessApprovalChecklist = {
  securityConfigurationComplete: boolean;
  accessAndGovernanceComplete: boolean;
  dataAndRecoveryComplete: boolean;
  platformHealthComplete: boolean;
  functionalProofComplete: boolean;
  contractAndChainProofComplete: boolean;
  finalSignoffComplete: boolean;
  unresolvedRisksAccepted: boolean;
  openBlockers: string[];
  residualRiskNote: string | null;
};

type ReleaseReadinessApprovalEvidenceSnapshot = {
  generatedAt: string;
  overallStatus: ReleaseReadinessSummary["overallStatus"];
  summary: ReleaseReadinessSummary["summary"];
  requiredChecks: Array<{
    evidenceType: ReleaseReadinessEvidenceType;
    status: "passed" | "failed" | "pending";
    latestEvidenceObservedAt: string | null;
    latestEvidenceEnvironment: ReleaseReadinessEnvironment | null;
    latestEvidenceStatus: ReleaseReadinessEvidenceStatus | null;
    latestEvidenceReleaseIdentifier: string | null;
    latestEvidenceRollbackReleaseIdentifier: string | null;
    latestEvidenceBackupReference: string | null;
  }>;
};

type ReleaseReadinessApprovalMetadataMismatch = {
  evidenceType: ReleaseReadinessEvidenceType;
  reason: string;
};

type ReleaseReadinessApprovalGate = {
  overallStatus: "ready" | "blocked" | "approved" | "rejected";
  approvalEligible: boolean;
  missingChecklistItems: string[];
  missingEvidenceTypes: ReleaseReadinessEvidenceType[];
  failedEvidenceTypes: ReleaseReadinessEvidenceType[];
  staleEvidenceTypes: ReleaseReadinessEvidenceType[];
  metadataMismatches: ReleaseReadinessApprovalMetadataMismatch[];
  maximumEvidenceAgeHours: number;
  openBlockers: string[];
  generatedAt: string;
};

type ReleaseReadinessApprovalProjection = {
  id: string;
  supersedesApprovalId: string | null;
  supersededByApprovalId: string | null;
  releaseIdentifier: string;
  environment: ReleaseReadinessEnvironment;
  launchClosurePack: {
    id: string;
    version: number;
    artifactChecksumSha256: string;
    manifestChecksumSha256: string | null;
  } | null;
  rollbackReleaseIdentifier: string | null;
  status: ReleaseReadinessApprovalStatus;
  summary: string;
  requestNote: string | null;
  approvalNote: string | null;
  rejectionNote: string | null;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  supersededByOperatorId: string | null;
  supersededByOperatorRole: string | null;
  checklist: ReleaseReadinessApprovalChecklist;
  evidenceSnapshot: ReleaseReadinessApprovalEvidenceSnapshot;
  gate: ReleaseReadinessApprovalGate;
  launchClosureDrift: {
    changed: boolean;
    critical: boolean;
    blockingReasons: string[];
    currentOverallStatus: LaunchClosureStatusProjection["overallStatus"];
    summaryDelta: {
      passedCheckCount: number;
      failedCheckCount: number;
      pendingCheckCount: number;
    };
    missingEvidenceTypesAdded: ReleaseReadinessEvidenceType[];
    missingEvidenceTypesResolved: ReleaseReadinessEvidenceType[];
    failedEvidenceTypesAdded: ReleaseReadinessEvidenceType[];
    failedEvidenceTypesResolved: ReleaseReadinessEvidenceType[];
    staleEvidenceTypesAdded: ReleaseReadinessEvidenceType[];
    staleEvidenceTypesResolved: ReleaseReadinessEvidenceType[];
    openBlockersAdded: string[];
    openBlockersResolved: string[];
    newerPackAvailable: boolean;
    latestPack: {
      id: string;
      version: number;
      artifactChecksumSha256: string;
      manifestChecksumSha256: string | null;
    } | null;
  } | null;
  lineageSummary: {
    status: "healthy" | "warning" | "critical";
    issueCount: number;
    actionableApprovalId: string | null;
    isActionable: boolean;
  } | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReleaseReadinessApprovalMutationResult = {
  approval: ReleaseReadinessApprovalProjection;
};

type ReleaseReadinessApprovalList = {
  approvals: ReleaseReadinessApprovalProjection[];
  limit: number;
  totalCount: number;
};

type ReleaseReadinessApprovalLineageIncidentList = {
  incidents: ReleaseReadinessApprovalProjection[];
  limit: number;
  totalCount: number;
};

type ReleaseReadinessApprovalLineageIssue = {
  code:
    | "missing_previous_approval"
    | "missing_next_approval"
    | "cycle_detected"
    | "broken_backward_link"
    | "broken_forward_link"
    | "scope_mismatch"
    | "multiple_pending_approvals"
    | "superseded_head";
  approvalId: string;
  relatedApprovalId: string | null;
  description: string;
};

type ReleaseReadinessApprovalLineageIntegrity = {
  status: "healthy" | "warning" | "critical";
  issues: ReleaseReadinessApprovalLineageIssue[];
  headApprovalId: string | null;
  tailApprovalId: string | null;
  actionableApprovalId: string | null;
};

type ReleaseReadinessApprovalLineageResult = {
  approval: ReleaseReadinessApprovalProjection;
  lineage: ReleaseReadinessApprovalProjection[];
  currentMutationToken: string;
  integrity: ReleaseReadinessApprovalLineageIntegrity;
};

type ReleaseReadinessApprovalRecoveryTargetResult = {
  selectedApprovalId: string;
  actionableApproval: ReleaseReadinessApprovalProjection | null;
  currentMutationToken: string | null;
  integrity: ReleaseReadinessApprovalLineageIntegrity;
};

type ReleaseReadinessApprovalDecisionReceiptAuditEvent = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

type ReleaseReadinessApprovalDecisionReceipt = {
  receiptVersion: "release-readiness-approval-decision/v1";
  generatedAt: string;
  receiptChecksumSha256: string;
  releaseIdentifier: string;
  environment: ReleaseReadinessEnvironment;
  finalDecision: boolean;
  launchReady: boolean;
  blockers: string[];
  decision: {
    status: ReleaseReadinessApprovalStatus;
    decidedAt: string | null;
    decidedByOperatorId: string | null;
    decidedByOperatorRole: string | null;
    note: string | null;
  };
  approval: ReleaseReadinessApprovalProjection;
  launchClosurePack: {
    snapshotMatchesApproval: boolean;
    record: ReleaseLaunchClosurePackProjection | null;
    integrity: ReleaseLaunchClosurePackIntegrityResult | null;
  };
  lineage: ReleaseReadinessApprovalLineageIntegrity;
  auditTrail: ReleaseReadinessApprovalDecisionReceiptAuditEvent[];
};

type ReleaseReadinessApprovalLookupClient = {
  releaseReadinessApproval: {
    findUnique(args: Prisma.ReleaseReadinessApprovalFindUniqueArgs): Promise<ReleaseReadinessApprovalRecord | null>;
  };
  auditEvent?: {
    create(args: Prisma.AuditEventCreateArgs): Promise<unknown>;
  };
};

type ReleaseLaunchClosurePackProjection = {
  id: string;
  releaseIdentifier: string;
  environment: ReleaseReadinessEnvironment;
  version: number;
  generatedByOperatorId: string;
  generatedByOperatorRole: string | null;
  artifactChecksumSha256: string;
  manifestChecksumSha256: string | null;
  artifactManifest: LaunchClosureArtifactManifest | null;
  artifactPayload: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

type ReleaseLaunchClosurePackMutationResult = {
  pack: ReleaseLaunchClosurePackProjection;
};

type ReleaseLaunchClosurePackList = {
  packs: ReleaseLaunchClosurePackProjection[];
  limit: number;
  totalCount: number;
};

type ReleaseLaunchClosurePackIntegrityIssue = {
  code:
    | "artifact_payload_invalid"
    | "artifact_checksum_mismatch"
    | "artifact_manifest_missing"
    | "file_missing"
    | "file_unexpected"
    | "byte_length_mismatch"
    | "content_checksum_mismatch"
    | "manifest_checksum_mismatch"
    | "file_count_mismatch";
  relativePath: string | null;
  expected: string | number | null;
  actual: string | number | null;
  message: string;
};

type ReleaseLaunchClosurePackIntegrityResult = {
  pack: ReleaseLaunchClosurePackProjection;
  valid: boolean;
  artifactChecksumSha256: string;
  recomputedArtifactChecksumSha256: string;
  artifactChecksumMatches: boolean;
  manifestChecksumSha256: string | null;
  expectedFileCount: number | null;
  checkedFileCount: number;
  issues: ReleaseLaunchClosurePackIntegrityIssue[];
};

type StoredLaunchClosurePackResult = {
  validation: {
    errors: string[];
    warnings: string[];
  };
  summaryMarkdown: string;
  outputSubpath: string;
  files: Array<{
    relativePath: string;
    content: string;
  }>;
  pack: ReleaseLaunchClosurePackProjection;
};

type LaunchClosureOperationalCheck = {
  evidenceType: ReleaseReadinessEvidenceType;
  label: string;
  status: "passed" | "failed" | "pending" | "stale";
  acceptedEnvironments: ReleaseReadinessEnvironment[];
  latestEvidence: ReleaseReadinessEvidenceProjection | null;
};

type LaunchClosureStatusProjection = {
  generatedAt: string;
  releaseIdentifier: string | null;
  environment: ReleaseReadinessEnvironment | null;
  overallStatus: "ready" | "blocked" | "approved" | "rejected" | "in_progress";
  maximumEvidenceAgeHours: number;
  externalChecks: LaunchClosureOperationalCheck[];
  latestApproval: ReleaseReadinessApprovalProjection | null;
  summaryMarkdown: string;
};

const rollbackScopedEvidenceTypes = new Set<ReleaseReadinessEvidenceType>([
  ReleaseReadinessEvidenceType.api_rollback_drill,
  ReleaseReadinessEvidenceType.worker_rollback_drill
]);
const deploymentArtifactChecksumPattern = /^(sha256:)?[a-fA-F0-9]{64}$/;
const deploymentArtifactCommitShaPattern = /^[a-fA-F0-9]{7,40}$/;
const onchainVerifiedSolvencyAnchorEvidenceEnvironments =
  new Set<ReleaseReadinessEnvironment>([
    ReleaseReadinessEnvironment.production_like,
    ReleaseReadinessEnvironment.production
  ]);

@Injectable()
export class ReleaseReadinessService {
  private readonly requestAllowedOperatorRoles: string[];
  private readonly approvalAllowedOperatorRoles: string[];
  private readonly maxEvidenceAgeHours: number;

  constructor(
    private readonly prismaService: PrismaService,
    @Optional()
    private readonly notificationsService?: Pick<
      NotificationsService,
      "publishAuditEventRecord"
    >
  ) {
    const config = loadReleaseReadinessApprovalRuntimeConfig();
    this.requestAllowedOperatorRoles = [
      ...config.releaseReadinessApprovalRequestAllowedOperatorRoles
    ];
    this.approvalAllowedOperatorRoles = [
      ...config.releaseReadinessApprovalApproverAllowedOperatorRoles
    ];
    this.maxEvidenceAgeHours = config.releaseReadinessApprovalMaxEvidenceAgeHours;
  }

  private async appendAuditEvent(
    client: Prisma.TransactionClient | PrismaService,
    args: Prisma.AuditEventCreateArgs
  ) {
    const auditEvent = await client.auditEvent.create(args);

    if (this.notificationsService) {
      await this.notificationsService.publishAuditEventRecord(
        auditEvent,
        client === this.prismaService
          ? undefined
          : (client as Prisma.TransactionClient)
      );
    }

    return auditEvent;
  }

  private normalizeOptionalString(value?: string | null): string | null {
    const normalizedValue = value?.trim() ?? null;
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeOptionalDate(value?: string): Date | null {
    const normalizedValue = this.normalizeOptionalString(value);
    return normalizedValue ? new Date(normalizedValue) : null;
  }

  private normalizeEvidenceLinks(evidenceLinks?: string[]): string[] {
    if (!evidenceLinks) {
      return [];
    }

    return [...new Set(evidenceLinks.map((link) => link.trim()).filter(Boolean))];
  }

  private normalizeStringArray(values?: string[]): string[] {
    if (!values) {
      return [];
    }

    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private assertCanRequest(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.requestAllowedOperatorRoles,
      "Operator role is not authorized to request launch readiness approval."
    );
  }

  private assertCanApprove(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.approvalAllowedOperatorRoles,
      "Operator role is not authorized to approve or reject launch readiness."
    );
  }

  private isOperatorRoleAllowed(
    operatorRole: string | undefined | null,
    allowedOperatorRoles: readonly string[]
  ): boolean {
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);

    return Boolean(
      normalizedOperatorRole &&
        allowedOperatorRoles.includes(normalizedOperatorRole)
    );
  }

  private buildApprovalPolicy(
    operatorId?: string | null,
    operatorRole?: string | null
  ): ReleaseReadinessSummary["approvalPolicy"] {
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);

    return {
      requestAllowedOperatorRoles: [...this.requestAllowedOperatorRoles],
      approverAllowedOperatorRoles: [...this.approvalAllowedOperatorRoles],
      maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
      currentOperator: {
        operatorId: operatorId?.trim() || null,
        operatorRole: normalizedOperatorRole,
        canRequestApproval: this.isOperatorRoleAllowed(
          normalizedOperatorRole,
          this.requestAllowedOperatorRoles
        ),
        canApproveOrReject: this.isOperatorRoleAllowed(
          normalizedOperatorRole,
          this.approvalAllowedOperatorRoles
        )
      }
    };
  }

  private mapEvidenceProjection(
    record: ReleaseReadinessEvidenceRecord
  ): ReleaseReadinessEvidenceProjection {
    return {
      id: record.id,
      evidenceType: record.evidenceType,
      environment: record.environment,
      status: record.status,
      releaseIdentifier: record.releaseIdentifier ?? null,
      rollbackReleaseIdentifier: record.rollbackReleaseIdentifier ?? null,
      backupReference: record.backupReference ?? null,
      summary: record.summary,
      note: record.note ?? null,
      operatorId: record.operatorId,
      operatorRole: record.operatorRole ?? null,
      runbookPath: record.runbookPath ?? null,
      evidenceLinks: [...record.evidenceLinks],
      evidencePayload: record.evidencePayload ?? null,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      observedAt: record.observedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapDecisionReceiptAuditEvent(
    record: AuditEventRecord
  ): ReleaseReadinessApprovalDecisionReceiptAuditEvent {
    return {
      id: record.id,
      actorType: record.actorType,
      actorId: record.actorId ?? null,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId ?? null,
      metadata: record.metadata ?? null,
      createdAt: record.createdAt.toISOString()
    };
  }

  private buildEvidenceWhere(
    query: ListReleaseReadinessEvidenceDto
  ): Prisma.ReleaseReadinessEvidenceWhereInput {
    const where: Prisma.ReleaseReadinessEvidenceWhereInput = {};

    if (query.evidenceType) {
      where.evidenceType = query.evidenceType;
    }

    if (query.environment) {
      where.environment = query.environment;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.releaseIdentifier) {
      where.releaseIdentifier = {
        equals: query.releaseIdentifier.trim(),
        mode: Prisma.QueryMode.insensitive
      };
    }

    if (query.sinceDays) {
      where.observedAt = {
        gte: new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000)
      };
    }

    return where;
  }

  private normalizeSummaryScope(
    scope?: ReleaseReadinessSummaryScope
  ): ReleaseReadinessSummaryScope {
    return {
      releaseIdentifier: this.normalizeOptionalString(scope?.releaseIdentifier),
      environment: scope?.environment ?? null
    };
  }

  private buildSummaryEvidenceWhere(
    scope?: ReleaseReadinessSummaryScope
  ): Prisma.ReleaseReadinessEvidenceWhereInput {
    const normalizedScope = this.normalizeSummaryScope(scope);
    const where: Prisma.ReleaseReadinessEvidenceWhereInput = {
      evidenceType: {
        in: requiredReleaseReadinessChecks.map((check) => check.evidenceType)
      }
    };

    if (normalizedScope.releaseIdentifier) {
      where.releaseIdentifier = normalizedScope.releaseIdentifier;
    }

    if (normalizedScope.environment) {
      where.environment = normalizedScope.environment;
    }

    return where;
  }

  private buildRecentEvidenceWhere(
    scope?: ReleaseReadinessSummaryScope
  ): Prisma.ReleaseReadinessEvidenceWhereInput {
    const normalizedScope = this.normalizeSummaryScope(scope);
    const where: Prisma.ReleaseReadinessEvidenceWhereInput = {};

    if (normalizedScope.releaseIdentifier) {
      where.releaseIdentifier = normalizedScope.releaseIdentifier;
    }

    if (normalizedScope.environment) {
      where.environment = normalizedScope.environment;
    }

    return where;
  }

  private buildApprovalWhere(
    query: ListReleaseReadinessApprovalsDto
  ): Prisma.ReleaseReadinessApprovalWhereInput {
    const where: Prisma.ReleaseReadinessApprovalWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.environment) {
      where.environment = query.environment;
    }

    if (query.releaseIdentifier) {
      where.releaseIdentifier = {
        equals: query.releaseIdentifier.trim(),
        mode: Prisma.QueryMode.insensitive
      };
    }

    if (query.sinceDays) {
      where.requestedAt = {
        gte: new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000)
      };
    }

    return where;
  }

  private buildApprovalChecklist(
    dto: CreateReleaseReadinessApprovalDto
  ): ReleaseReadinessApprovalChecklist {
    return {
      securityConfigurationComplete: dto.securityConfigurationComplete,
      accessAndGovernanceComplete: dto.accessAndGovernanceComplete,
      dataAndRecoveryComplete: dto.dataAndRecoveryComplete,
      platformHealthComplete: dto.platformHealthComplete,
      functionalProofComplete: dto.functionalProofComplete,
      contractAndChainProofComplete: dto.contractAndChainProofComplete,
      finalSignoffComplete: dto.finalSignoffComplete,
      unresolvedRisksAccepted: dto.unresolvedRisksAccepted,
      openBlockers: this.normalizeStringArray(dto.openBlockers),
      residualRiskNote: this.normalizeOptionalString(dto.residualRiskNote)
    };
  }

  private mapApprovalChecklist(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalChecklist {
    return {
      securityConfigurationComplete: record.securityConfigurationComplete,
      accessAndGovernanceComplete: record.accessAndGovernanceComplete,
      dataAndRecoveryComplete: record.dataAndRecoveryComplete,
      platformHealthComplete: record.platformHealthComplete,
      functionalProofComplete: record.functionalProofComplete,
      contractAndChainProofComplete: record.contractAndChainProofComplete,
      finalSignoffComplete: record.finalSignoffComplete,
      unresolvedRisksAccepted: record.unresolvedRisksAccepted,
      openBlockers: [...record.openBlockers],
      residualRiskNote: record.residualRiskNote ?? null
    };
  }

  private buildApprovalEvidenceSnapshot(
    summary: ReleaseReadinessSummary
  ): ReleaseReadinessApprovalEvidenceSnapshot {
    return {
      generatedAt: summary.generatedAt,
      overallStatus: summary.overallStatus,
      summary: {
        ...summary.summary
      },
      requiredChecks: summary.requiredChecks.map((check) => ({
        evidenceType: check.evidenceType,
        status: check.status,
        latestEvidenceObservedAt: check.latestEvidence?.observedAt ?? null,
        latestEvidenceEnvironment: check.latestEvidence?.environment ?? null,
        latestEvidenceStatus: check.latestEvidence?.status ?? null,
        latestEvidenceReleaseIdentifier: check.latestEvidence?.releaseIdentifier ?? null,
        latestEvidenceRollbackReleaseIdentifier:
          check.latestEvidence?.rollbackReleaseIdentifier ?? null,
        latestEvidenceBackupReference: check.latestEvidence?.backupReference ?? null
      }))
    };
  }

  private buildApprovalMetadataMismatches(
    summary: ReleaseReadinessSummary,
    rollbackReleaseIdentifier: string | null
  ): ReleaseReadinessApprovalMetadataMismatch[] {
    const mismatches: ReleaseReadinessApprovalMetadataMismatch[] = [];

    for (const check of summary.requiredChecks) {
      const latestEvidence = check.latestEvidence;

      if (!latestEvidence) {
        continue;
      }

      const missingMetadata = validateReleaseReadinessEvidenceMetadata({
        evidenceType: check.evidenceType,
        releaseIdentifier: latestEvidence.releaseIdentifier,
        rollbackReleaseIdentifier: latestEvidence.rollbackReleaseIdentifier,
        backupReference: latestEvidence.backupReference
      });

      if (missingMetadata.length > 0) {
        mismatches.push({
          evidenceType: check.evidenceType,
          reason: `Latest ${check.evidenceType} evidence is missing ${describeReleaseReadinessEvidenceMetadataRequirements(
            check.evidenceType
          ).join(", ")}.`
        });
        continue;
      }

      const missingPayloadFields = validateReleaseReadinessEvidencePayload({
        evidenceType: check.evidenceType,
        evidencePayload: latestEvidence.evidencePayload
      });

      if (missingPayloadFields.length > 0) {
        mismatches.push({
          evidenceType: check.evidenceType,
          reason: `Latest ${check.evidenceType} evidence is missing valid payload fields: ${describeReleaseReadinessEvidencePayloadRequirements(
            check.evidenceType
          ).join(", ")}.`
        });
        continue;
      }

      if (
        rollbackScopedEvidenceTypes.has(check.evidenceType) &&
        !rollbackReleaseIdentifier
      ) {
        mismatches.push({
          evidenceType: check.evidenceType,
          reason: `Approval is missing rollback release identifier required for ${check.evidenceType}.`
        });
        continue;
      }

      if (rollbackScopedEvidenceTypes.has(check.evidenceType)) {
        try {
          this.assertRollbackDrillEvidenceArtifactBinding(
            check.evidenceType,
            latestEvidence.environment,
            rollbackReleaseIdentifier,
            (latestEvidence.evidencePayload ?? undefined) as
              | PrismaJsonValue
              | undefined
          );
        } catch (error) {
          mismatches.push({
            evidenceType: check.evidenceType,
            reason:
              error instanceof Error
                ? error.message
                : "Latest rollback drill evidence artifact binding is invalid."
          });
          continue;
        }
      }

      if (
        rollbackScopedEvidenceTypes.has(check.evidenceType) &&
        latestEvidence.rollbackReleaseIdentifier !== rollbackReleaseIdentifier
      ) {
        mismatches.push({
          evidenceType: check.evidenceType,
          reason: `Latest ${check.evidenceType} evidence targets rollback release ${
            latestEvidence.rollbackReleaseIdentifier ?? "none"
          } instead of ${rollbackReleaseIdentifier}.`
        });
      }
    }

    return mismatches;
  }

  private evaluateApprovalGate(
    summary: ReleaseReadinessSummary,
    checklist: ReleaseReadinessApprovalChecklist,
    status: ReleaseReadinessApprovalStatus,
    rollbackReleaseIdentifier: string | null
  ): ReleaseReadinessApprovalGate {
    const missingChecklistItems = releaseReadinessChecklistSections
      .filter((section) => !checklist[section.key])
      .map((section) => section.label);
    const missingEvidenceTypes = summary.requiredChecks
      .filter((check) => check.status === "pending")
      .map((check) => check.evidenceType);
    const failedEvidenceTypes = summary.requiredChecks
      .filter((check) => check.status === "failed")
      .map((check) => check.evidenceType);
    const staleEvidenceTypes = summary.requiredChecks
      .filter((check) => {
        if (check.status !== "passed" || !check.latestEvidence?.observedAt) {
          return false;
        }

        const observedAt = new Date(check.latestEvidence.observedAt);

        return (
          Date.now() - observedAt.getTime() >
          this.maxEvidenceAgeHours * 60 * 60 * 1000
        );
      })
      .map((check) => check.evidenceType);
    const metadataMismatches = this.buildApprovalMetadataMismatches(
      summary,
      rollbackReleaseIdentifier
    );
    const openBlockers = [...checklist.openBlockers];
    const approvalEligible =
      missingChecklistItems.length === 0 &&
      missingEvidenceTypes.length === 0 &&
      failedEvidenceTypes.length === 0 &&
      metadataMismatches.length === 0 &&
      staleEvidenceTypes.length === 0 &&
      openBlockers.length === 0;

    const overallStatus =
      status === ReleaseReadinessApprovalStatus.approved
        ? "approved"
        : status === ReleaseReadinessApprovalStatus.rejected
          ? "rejected"
          : approvalEligible
            ? "ready"
            : "blocked";

    return {
      overallStatus,
      approvalEligible: status === ReleaseReadinessApprovalStatus.approved
        ? true
        : status === ReleaseReadinessApprovalStatus.rejected
          ? false
          : approvalEligible,
      missingChecklistItems,
      missingEvidenceTypes,
      failedEvidenceTypes,
      staleEvidenceTypes,
      metadataMismatches,
      maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
      openBlockers,
      generatedAt: summary.generatedAt
    };
  }

  private mapStoredApprovalEvidenceSnapshot(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalEvidenceSnapshot {
    const snapshot =
      record.evidenceSnapshot as unknown as Partial<ReleaseReadinessApprovalEvidenceSnapshot>;

    return {
      generatedAt: snapshot.generatedAt ?? record.updatedAt.toISOString(),
      overallStatus: snapshot.overallStatus ?? "warning",
      summary: snapshot.summary ?? {
        requiredCheckCount: 0,
        passedCheckCount: 0,
        failedCheckCount: 0,
        pendingCheckCount: 0
      },
      requiredChecks: (snapshot.requiredChecks ?? []).map((check) => ({
        evidenceType: check.evidenceType,
        status: check.status,
        latestEvidenceObservedAt: check.latestEvidenceObservedAt ?? null,
        latestEvidenceEnvironment: check.latestEvidenceEnvironment ?? null,
        latestEvidenceStatus: check.latestEvidenceStatus ?? null,
        latestEvidenceReleaseIdentifier: check.latestEvidenceReleaseIdentifier ?? null,
        latestEvidenceRollbackReleaseIdentifier:
          check.latestEvidenceRollbackReleaseIdentifier ?? null,
        latestEvidenceBackupReference: check.latestEvidenceBackupReference ?? null
      }))
    };
  }

  private mapStoredApprovalGate(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalGate {
    const gate =
      record.blockerSnapshot as unknown as Partial<ReleaseReadinessApprovalGate>;

    return {
      overallStatus: gate.overallStatus ?? "blocked",
      approvalEligible: gate.approvalEligible ?? false,
      missingChecklistItems: gate.missingChecklistItems ?? [],
      missingEvidenceTypes: gate.missingEvidenceTypes ?? [],
      failedEvidenceTypes: gate.failedEvidenceTypes ?? [],
      staleEvidenceTypes: gate.staleEvidenceTypes ?? [],
      metadataMismatches: gate.metadataMismatches ?? [],
      maximumEvidenceAgeHours:
        gate.maximumEvidenceAgeHours ?? this.maxEvidenceAgeHours,
      openBlockers: gate.openBlockers ?? [],
      generatedAt: gate.generatedAt ?? record.updatedAt.toISOString()
    };
  }

  private mapStoredLaunchClosureDrift(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalProjection["launchClosureDrift"] {
    const drift =
      record.decisionDriftSnapshot as unknown as Partial<
        NonNullable<ReleaseReadinessApprovalProjection["launchClosureDrift"]>
      > | null;

    if (!drift) {
      return null;
    }

    return {
      changed: drift.changed ?? false,
      critical: drift.critical ?? false,
      blockingReasons: drift.blockingReasons ?? [],
      currentOverallStatus: drift.currentOverallStatus ?? "blocked",
      summaryDelta: {
        passedCheckCount: drift.summaryDelta?.passedCheckCount ?? 0,
        failedCheckCount: drift.summaryDelta?.failedCheckCount ?? 0,
        pendingCheckCount: drift.summaryDelta?.pendingCheckCount ?? 0
      },
      missingEvidenceTypesAdded: drift.missingEvidenceTypesAdded ?? [],
      missingEvidenceTypesResolved: drift.missingEvidenceTypesResolved ?? [],
      failedEvidenceTypesAdded: drift.failedEvidenceTypesAdded ?? [],
      failedEvidenceTypesResolved: drift.failedEvidenceTypesResolved ?? [],
      staleEvidenceTypesAdded: drift.staleEvidenceTypesAdded ?? [],
      staleEvidenceTypesResolved: drift.staleEvidenceTypesResolved ?? [],
      openBlockersAdded: drift.openBlockersAdded ?? [],
      openBlockersResolved: drift.openBlockersResolved ?? [],
      newerPackAvailable: drift.newerPackAvailable ?? false,
      latestPack: drift.latestPack ?? null
    };
  }

  private listAddedItems<T extends string>(baseline: T[], current: T[]): T[] {
    const baselineSet = new Set(baseline);

    return [...new Set(current.filter((item) => !baselineSet.has(item)))];
  }

  private listResolvedItems<T extends string>(baseline: T[], current: T[]): T[] {
    const currentSet = new Set(current);

    return [...new Set(baseline.filter((item) => !currentSet.has(item)))];
  }

  private buildLaunchClosureDrift(
    record: ReleaseReadinessApprovalRecord,
    currentSummary?: ReleaseReadinessSummary,
    latestPack?: ReleaseLaunchClosurePackRecord | null
  ): ReleaseReadinessApprovalProjection["launchClosureDrift"] {
    if (!currentSummary) {
      return null;
    }

    const storedSnapshot = this.mapStoredApprovalEvidenceSnapshot(record);
    const storedGate = this.mapStoredApprovalGate(record);
    const checklist = this.mapApprovalChecklist(record);
    const currentGate = this.evaluateApprovalGate(
      currentSummary,
      checklist,
      record.status === ReleaseReadinessApprovalStatus.pending_approval
        ? ReleaseReadinessApprovalStatus.pending_approval
        : record.status,
      record.rollbackReleaseIdentifier ?? null
    );
    const currentOverallStatus: LaunchClosureStatusProjection["overallStatus"] =
      record.status === ReleaseReadinessApprovalStatus.approved
        ? "approved"
        : record.status === ReleaseReadinessApprovalStatus.rejected
          ? "rejected"
          : currentGate.approvalEligible
            ? "ready"
            : "blocked";
    const latestPackProjection =
      latestPack && latestPack.id !== record.launchClosurePackId
        ? {
            id: latestPack.id,
            version: latestPack.version,
            artifactChecksumSha256: latestPack.artifactChecksumSha256,
            manifestChecksumSha256:
              this.readLaunchClosureArtifactManifest(latestPack.artifactPayload)
                ?.manifestChecksumSha256 ?? null
          }
        : latestPack &&
            latestPack.version !== record.launchClosurePackVersion
          ? {
              id: latestPack.id,
              version: latestPack.version,
              artifactChecksumSha256: latestPack.artifactChecksumSha256,
              manifestChecksumSha256:
                this.readLaunchClosureArtifactManifest(latestPack.artifactPayload)
                  ?.manifestChecksumSha256 ?? null
            }
          : latestPack &&
              latestPack.artifactChecksumSha256 !==
                record.launchClosurePackChecksumSha256
            ? {
                id: latestPack.id,
                version: latestPack.version,
                artifactChecksumSha256: latestPack.artifactChecksumSha256,
                manifestChecksumSha256:
                  this.readLaunchClosureArtifactManifest(
                    latestPack.artifactPayload
                  )?.manifestChecksumSha256 ?? null
              }
            : null;
    const summaryDelta = {
      passedCheckCount:
        currentSummary.summary.passedCheckCount -
        storedSnapshot.summary.passedCheckCount,
      failedCheckCount:
        currentSummary.summary.failedCheckCount -
        storedSnapshot.summary.failedCheckCount,
      pendingCheckCount:
        currentSummary.summary.pendingCheckCount -
        storedSnapshot.summary.pendingCheckCount
    };
    const missingEvidenceTypesAdded = this.listAddedItems(
      storedGate.missingEvidenceTypes,
      currentGate.missingEvidenceTypes
    );
    const missingEvidenceTypesResolved = this.listResolvedItems(
      storedGate.missingEvidenceTypes,
      currentGate.missingEvidenceTypes
    );
    const failedEvidenceTypesAdded = this.listAddedItems(
      storedGate.failedEvidenceTypes,
      currentGate.failedEvidenceTypes
    );
    const failedEvidenceTypesResolved = this.listResolvedItems(
      storedGate.failedEvidenceTypes,
      currentGate.failedEvidenceTypes
    );
    const staleEvidenceTypesAdded = this.listAddedItems(
      storedGate.staleEvidenceTypes,
      currentGate.staleEvidenceTypes
    );
    const staleEvidenceTypesResolved = this.listResolvedItems(
      storedGate.staleEvidenceTypes,
      currentGate.staleEvidenceTypes
    );
    const openBlockersAdded = this.listAddedItems(
      storedGate.openBlockers,
      currentGate.openBlockers
    );
    const openBlockersResolved = this.listResolvedItems(
      storedGate.openBlockers,
      currentGate.openBlockers
    );
    const changed =
      summaryDelta.passedCheckCount !== 0 ||
      summaryDelta.failedCheckCount !== 0 ||
      summaryDelta.pendingCheckCount !== 0 ||
      missingEvidenceTypesAdded.length > 0 ||
      missingEvidenceTypesResolved.length > 0 ||
      failedEvidenceTypesAdded.length > 0 ||
      failedEvidenceTypesResolved.length > 0 ||
      staleEvidenceTypesAdded.length > 0 ||
      staleEvidenceTypesResolved.length > 0 ||
      openBlockersAdded.length > 0 ||
      openBlockersResolved.length > 0 ||
      latestPackProjection !== null ||
      currentOverallStatus !== storedGate.overallStatus;
    const blockingReasons = [
      ...(latestPackProjection
        ? [
            `A newer launch-closure pack (${latestPackProjection.id}) is available for this release scope.`
          ]
        : []),
      ...missingEvidenceTypesAdded.map(
        (evidenceType) => `Missing evidence was introduced for ${evidenceType}.`
      ),
      ...failedEvidenceTypesAdded.map(
        (evidenceType) => `Failed evidence is now present for ${evidenceType}.`
      ),
      ...staleEvidenceTypesAdded.map(
        (evidenceType) => `Evidence became stale for ${evidenceType}.`
      ),
      ...openBlockersAdded.map(
        (blocker) => `A new open blocker was introduced: ${blocker}.`
      ),
      ...(currentOverallStatus === "blocked"
        ? [
            "Current live launch-closure posture is blocked and no longer matches the bound approval artifact."
          ]
        : [])
    ];
    const critical = blockingReasons.length > 0;

    return {
      changed,
      critical,
      blockingReasons,
      currentOverallStatus,
      summaryDelta,
      missingEvidenceTypesAdded,
      missingEvidenceTypesResolved,
      failedEvidenceTypesAdded,
      failedEvidenceTypesResolved,
      staleEvidenceTypesAdded,
      staleEvidenceTypesResolved,
      openBlockersAdded,
      openBlockersResolved,
      newerPackAvailable: latestPackProjection !== null,
      latestPack: latestPackProjection
    };
  }

  private assertApprovalDriftDoesNotBlock(
    drift: ReleaseReadinessApprovalProjection["launchClosureDrift"]
  ): void {
    if (!drift?.critical) {
      return;
    }

    throw new ConflictException(
      `Launch approval is blocked until the bound launch-closure pack is refreshed for current live posture. ${drift.blockingReasons.join(
        " "
      )}`
    );
  }

  private mapApprovalProjection(
    record: ReleaseReadinessApprovalRecord,
    currentSummary?: ReleaseReadinessSummary,
    latestPack?: ReleaseLaunchClosurePackRecord | null,
    lineageSummary?: ReleaseReadinessApprovalProjection["lineageSummary"]
  ): ReleaseReadinessApprovalProjection {
    const boundLaunchClosurePackManifestChecksum =
      latestPack &&
      latestPack.id === record.launchClosurePackId &&
      latestPack.version === record.launchClosurePackVersion &&
      latestPack.artifactChecksumSha256 ===
        record.launchClosurePackChecksumSha256
        ? this.readLaunchClosureArtifactManifest(latestPack.artifactPayload)
            ?.manifestChecksumSha256 ?? null
        : null;
    const checklist = this.mapApprovalChecklist(record);
    const evidenceSnapshot =
      record.status === ReleaseReadinessApprovalStatus.pending_approval &&
      currentSummary
        ? this.buildApprovalEvidenceSnapshot(currentSummary)
        : this.mapStoredApprovalEvidenceSnapshot(record);
    const gate =
      record.status === ReleaseReadinessApprovalStatus.pending_approval &&
      currentSummary
        ? this.evaluateApprovalGate(
            currentSummary,
            checklist,
            record.status,
            record.rollbackReleaseIdentifier ?? null
          )
        : this.mapStoredApprovalGate(record);

    return {
      id: record.id,
      supersedesApprovalId: record.supersedesApprovalId ?? null,
      supersededByApprovalId: record.supersededByApprovalId ?? null,
      releaseIdentifier: record.releaseIdentifier,
      environment: record.environment,
      launchClosurePack: record.launchClosurePackId &&
        record.launchClosurePackVersion !== null &&
        record.launchClosurePackChecksumSha256
        ? {
            id: record.launchClosurePackId,
            version: record.launchClosurePackVersion,
            artifactChecksumSha256: record.launchClosurePackChecksumSha256,
            manifestChecksumSha256: boundLaunchClosurePackManifestChecksum
          }
        : null,
      rollbackReleaseIdentifier: record.rollbackReleaseIdentifier ?? null,
      status: record.status,
      summary: record.summary,
      requestNote: record.requestNote ?? null,
      approvalNote: record.approvalNote ?? null,
      rejectionNote: record.rejectionNote ?? null,
      requestedByOperatorId: record.requestedByOperatorId,
      requestedByOperatorRole: record.requestedByOperatorRole ?? null,
      approvedByOperatorId: record.approvedByOperatorId ?? null,
      approvedByOperatorRole: record.approvedByOperatorRole ?? null,
      rejectedByOperatorId: record.rejectedByOperatorId ?? null,
      rejectedByOperatorRole: record.rejectedByOperatorRole ?? null,
      supersededByOperatorId: record.supersededByOperatorId ?? null,
      supersededByOperatorRole: record.supersededByOperatorRole ?? null,
      checklist,
      evidenceSnapshot,
      gate,
      launchClosureDrift:
        record.status === ReleaseReadinessApprovalStatus.pending_approval
          ? this.buildLaunchClosureDrift(record, currentSummary, latestPack)
          : this.mapStoredLaunchClosureDrift(record),
      lineageSummary: lineageSummary ?? null,
      requestedAt: record.requestedAt.toISOString(),
      approvedAt: record.approvedAt?.toISOString() ?? null,
      rejectedAt: record.rejectedAt?.toISOString() ?? null,
      supersededAt: record.supersededAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildChecksum(value: Prisma.JsonValue): string {
    return createHash("sha256")
      .update(JSON.stringify(value))
      .digest("hex");
  }

  private readLaunchClosureArtifactManifest(
    artifactPayload: Prisma.JsonValue
  ): LaunchClosureArtifactManifest | null {
    if (
      !artifactPayload ||
      Array.isArray(artifactPayload) ||
      typeof artifactPayload !== "object"
    ) {
      return null;
    }

    const payload = artifactPayload as Record<string, unknown>;
    const artifactManifest = payload.artifactManifest;

    if (
      !artifactManifest ||
      Array.isArray(artifactManifest) ||
      typeof artifactManifest !== "object"
    ) {
      return null;
    }

    const manifest = artifactManifest as Record<string, unknown>;
    const files = Array.isArray(manifest.files)
      ? manifest.files
          .filter(
            (file): file is LaunchClosureArtifactManifestFile =>
              Boolean(file) &&
              !Array.isArray(file) &&
              typeof file === "object" &&
              typeof (file as Record<string, unknown>).relativePath ===
                "string" &&
              typeof (file as Record<string, unknown>).byteLength ===
                "number" &&
              typeof (file as Record<string, unknown>).contentSha256 ===
                "string"
          )
          .map((file) => ({
            relativePath: file.relativePath,
            byteLength: file.byteLength,
            contentSha256: file.contentSha256
          }))
      : [];

    return {
      manifestChecksumSha256:
        typeof manifest.manifestChecksumSha256 === "string"
          ? manifest.manifestChecksumSha256
          : null,
      fileCount:
        typeof manifest.fileCount === "number"
          ? manifest.fileCount
          : files.length,
      files
    };
  }

  private readLaunchClosurePackFiles(
    artifactPayload: Prisma.JsonValue
  ): LaunchClosurePackFile[] | null {
    if (
      !artifactPayload ||
      Array.isArray(artifactPayload) ||
      typeof artifactPayload !== "object"
    ) {
      return null;
    }

    const payload = artifactPayload as Record<string, unknown>;

    if (!Array.isArray(payload.files)) {
      return null;
    }

    const files: LaunchClosurePackFile[] = [];

    for (const file of payload.files) {
      if (
        !file ||
        Array.isArray(file) ||
        typeof file !== "object" ||
        typeof (file as Record<string, unknown>).relativePath !== "string" ||
        typeof (file as Record<string, unknown>).content !== "string"
      ) {
        return null;
      }

      files.push({
        relativePath: (file as Record<string, unknown>).relativePath as string,
        content: (file as Record<string, unknown>).content as string
      });
    }

    return files;
  }

  private verifyStoredLaunchClosurePackIntegrity(
    record: ReleaseLaunchClosurePackRecord
  ): ReleaseLaunchClosurePackIntegrityResult {
    const issues: ReleaseLaunchClosurePackIntegrityIssue[] = [];
    const pack = this.mapLaunchClosurePackProjection(record);
    const recomputedArtifactChecksumSha256 = this.buildChecksum(
      record.artifactPayload
    );
    const artifactChecksumMatches =
      recomputedArtifactChecksumSha256 === record.artifactChecksumSha256;

    if (!artifactChecksumMatches) {
      issues.push({
        code: "artifact_checksum_mismatch",
        relativePath: null,
        expected: record.artifactChecksumSha256,
        actual: recomputedArtifactChecksumSha256,
        message:
          "Stored launch-closure pack checksum does not match its persisted artifact payload."
      });
    }

    const artifactManifest = this.readLaunchClosureArtifactManifest(
      record.artifactPayload
    );
    const files = this.readLaunchClosurePackFiles(record.artifactPayload);

    if (!artifactManifest) {
      issues.push({
        code: "artifact_manifest_missing",
        relativePath: null,
        expected: "artifactManifest",
        actual: null,
        message:
          "Stored launch-closure pack payload does not include an artifact manifest."
      });
    }

    if (!files) {
      issues.push({
        code: "artifact_payload_invalid",
        relativePath: null,
        expected: "files[] with relativePath and content",
        actual: null,
        message:
          "Stored launch-closure pack payload does not include a valid generated files array."
      });
    }

    if (!artifactManifest || !files) {
      return {
        pack,
        valid: false,
        artifactChecksumSha256: record.artifactChecksumSha256,
        recomputedArtifactChecksumSha256,
        artifactChecksumMatches,
        manifestChecksumSha256: artifactManifest?.manifestChecksumSha256 ?? null,
        expectedFileCount: artifactManifest?.fileCount ?? null,
        checkedFileCount: files?.length ?? 0,
        issues
      };
    }

    const actualManifest = buildLaunchClosureArtifactManifest(files);
    const actualFiles = new Map(
      actualManifest.files.map((file) => [file.relativePath, file])
    );
    const expectedFiles = new Map(
      artifactManifest.files.map((file) => [file.relativePath, file])
    );

    for (const expectedFile of artifactManifest.files) {
      const actualFile = actualFiles.get(expectedFile.relativePath);

      if (!actualFile) {
        issues.push({
          code: "file_missing",
          relativePath: expectedFile.relativePath,
          expected: expectedFile.relativePath,
          actual: null,
          message: `Stored launch-closure pack payload is missing generated file ${expectedFile.relativePath}.`
        });
        continue;
      }

      if (actualFile.byteLength !== expectedFile.byteLength) {
        issues.push({
          code: "byte_length_mismatch",
          relativePath: expectedFile.relativePath,
          expected: expectedFile.byteLength,
          actual: actualFile.byteLength,
          message: `Stored generated file byte length differs for ${expectedFile.relativePath}.`
        });
      }

      if (actualFile.contentSha256 !== expectedFile.contentSha256) {
        issues.push({
          code: "content_checksum_mismatch",
          relativePath: expectedFile.relativePath,
          expected: expectedFile.contentSha256,
          actual: actualFile.contentSha256,
          message: `Stored generated file SHA-256 checksum differs for ${expectedFile.relativePath}.`
        });
      }
    }

    for (const actualFile of actualManifest.files) {
      if (!expectedFiles.has(actualFile.relativePath)) {
        issues.push({
          code: "file_unexpected",
          relativePath: actualFile.relativePath,
          expected: null,
          actual: actualFile.relativePath,
          message: `Stored launch-closure pack payload contains an unlisted generated file ${actualFile.relativePath}.`
        });
      }
    }

    if (artifactManifest.fileCount !== artifactManifest.files.length) {
      issues.push({
        code: "file_count_mismatch",
        relativePath: null,
        expected: artifactManifest.fileCount,
        actual: artifactManifest.files.length,
        message:
          "Stored artifact manifest fileCount does not match its listed file count."
      });
    }

    if (
      artifactManifest.manifestChecksumSha256 !==
      actualManifest.manifestChecksumSha256
    ) {
      issues.push({
        code: "manifest_checksum_mismatch",
        relativePath: "manifest.json",
        expected: artifactManifest.manifestChecksumSha256,
        actual: actualManifest.manifestChecksumSha256,
        message:
          "Stored artifact manifest checksum does not match the generated manifest.json content."
      });
    }

    return {
      pack,
      valid: issues.length === 0,
      artifactChecksumSha256: record.artifactChecksumSha256,
      recomputedArtifactChecksumSha256,
      artifactChecksumMatches,
      manifestChecksumSha256: artifactManifest.manifestChecksumSha256,
      expectedFileCount: artifactManifest.fileCount,
      checkedFileCount: actualManifest.files.length,
      issues
    };
  }

  private assertLaunchClosurePackIntegrityDoesNotBlock(
    integrity: ReleaseLaunchClosurePackIntegrityResult
  ): void {
    if (integrity.valid) {
      return;
    }

    const issueSummary = integrity.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new ConflictException(
      [
        "Launch approval is blocked until the bound launch-closure pack integrity is repaired or regenerated.",
        issueSummary
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  private assertLaunchClosurePackMatchesApprovalSnapshot(
    pack: ReleaseLaunchClosurePackRecord | null,
    approval: ReleaseReadinessApprovalRecord
  ): ReleaseLaunchClosurePackRecord {
    if (!pack) {
      throw new ConflictException(
        "Launch approval is blocked because the bound launch-closure pack could not be found."
      );
    }

    if (
      pack.id !== approval.launchClosurePackId ||
      pack.releaseIdentifier !== approval.releaseIdentifier ||
      pack.environment !== approval.environment ||
      pack.version !== approval.launchClosurePackVersion ||
      pack.artifactChecksumSha256 !== approval.launchClosurePackChecksumSha256
    ) {
      throw new ConflictException(
        "Launch approval is blocked because the bound launch-closure pack no longer matches the approval snapshot."
      );
    }

    return pack;
  }

  private launchClosurePackMatchesApprovalSnapshot(
    pack: ReleaseLaunchClosurePackRecord | null,
    approval: ReleaseReadinessApprovalRecord
  ): boolean {
    return Boolean(
      pack &&
        pack.id === approval.launchClosurePackId &&
        pack.releaseIdentifier === approval.releaseIdentifier &&
        pack.environment === approval.environment &&
        pack.version === approval.launchClosurePackVersion &&
        pack.artifactChecksumSha256 === approval.launchClosurePackChecksumSha256
    );
  }

  private assertExpectedApprovalVersion(
    approval: ReleaseReadinessApprovalRecord,
    expectedUpdatedAt: string
  ) {
    if (approval.updatedAt.toISOString() !== expectedUpdatedAt) {
      throw new ConflictException(
        "Launch approval changed after it was loaded. Refresh approval data and retry."
      );
    }
  }

  private async collectApprovalLineageRecords(
    client: ReleaseReadinessApprovalLookupClient,
    approval: ReleaseReadinessApprovalRecord
  ): Promise<{
    lineageRecords: ReleaseReadinessApprovalRecord[];
    issues: ReleaseReadinessApprovalLineageIssue[];
  }> {
    const lineageRecords: ReleaseReadinessApprovalRecord[] = [approval];
    const seenIds = new Set<string>([approval.id]);
    const issues: ReleaseReadinessApprovalLineageIssue[] = [];

    let cursor = approval;
    while (cursor.supersedesApprovalId) {
      const previous = await client.releaseReadinessApproval.findUnique({
        where: {
          id: cursor.supersedesApprovalId
        }
      });

      if (!previous) {
        issues.push({
          code: "missing_previous_approval",
          approvalId: cursor.id,
          relatedApprovalId: cursor.supersedesApprovalId,
          description: `Approval ${cursor.id} references missing previous approval ${cursor.supersedesApprovalId}.`
        });
        break;
      }

      if (seenIds.has(previous.id)) {
        issues.push({
          code: "cycle_detected",
          approvalId: cursor.id,
          relatedApprovalId: previous.id,
          description: `Approval lineage cycles back to ${previous.id}.`
        });
        break;
      }

      if (previous.supersededByApprovalId !== cursor.id) {
        issues.push({
          code: "broken_forward_link",
          approvalId: previous.id,
          relatedApprovalId: cursor.id,
          description: `Approval ${previous.id} does not point forward to ${cursor.id}.`
        });
      }

      lineageRecords.unshift(previous);
      seenIds.add(previous.id);
      cursor = previous;
    }

    cursor = approval;
    while (cursor.supersededByApprovalId) {
      const next = await client.releaseReadinessApproval.findUnique({
        where: {
          id: cursor.supersededByApprovalId
        }
      });

      if (!next) {
        issues.push({
          code: "missing_next_approval",
          approvalId: cursor.id,
          relatedApprovalId: cursor.supersededByApprovalId,
          description: `Approval ${cursor.id} references missing replacement approval ${cursor.supersededByApprovalId}.`
        });
        break;
      }

      if (seenIds.has(next.id)) {
        issues.push({
          code: "cycle_detected",
          approvalId: cursor.id,
          relatedApprovalId: next.id,
          description: `Approval lineage cycles forward to ${next.id}.`
        });
        break;
      }

      if (next.supersedesApprovalId !== cursor.id) {
        issues.push({
          code: "broken_backward_link",
          approvalId: next.id,
          relatedApprovalId: cursor.id,
          description: `Approval ${next.id} does not point back to ${cursor.id}.`
        });
      }

      lineageRecords.push(next);
      seenIds.add(next.id);
      cursor = next;
    }

    return {
      lineageRecords,
      issues
    };
  }

  private buildApprovalLineageIntegrityFromRecords(
    lineage: ReleaseReadinessApprovalRecord[],
    seededIssues: ReleaseReadinessApprovalLineageIssue[]
  ): ReleaseReadinessApprovalLineageIntegrity {
    const issues = [...seededIssues];
    const head = lineage[lineage.length - 1] ?? null;
    const tail = lineage[0] ?? null;
    const scopeKey =
      lineage.length > 0
        ? `${lineage[0]!.releaseIdentifier}:${lineage[0]!.environment}`
        : null;
    const pendingApprovals = lineage.filter(
      (approval) => approval.status === ReleaseReadinessApprovalStatus.pending_approval
    );

    for (const approval of lineage) {
      if (
        scopeKey &&
        `${approval.releaseIdentifier}:${approval.environment}` !== scopeKey
      ) {
        issues.push({
          code: "scope_mismatch",
          approvalId: approval.id,
          relatedApprovalId: null,
          description: `Approval ${approval.id} belongs to ${approval.releaseIdentifier}/${approval.environment}, which does not match the lineage scope ${lineage[0]!.releaseIdentifier}/${lineage[0]!.environment}.`
        });
      }
    }

    if (pendingApprovals.length > 1) {
      for (const approval of pendingApprovals) {
        issues.push({
          code: "multiple_pending_approvals",
          approvalId: approval.id,
          relatedApprovalId: null,
          description: `Approval ${approval.id} is pending while another approval in the same lineage is also pending.`
        });
      }
    }

    if (head?.status === ReleaseReadinessApprovalStatus.superseded) {
      issues.push({
        code: "superseded_head",
        approvalId: head.id,
        relatedApprovalId: head.supersededByApprovalId,
        description: `Latest approval ${head.id} is superseded but has no valid replacement in the loaded lineage.`
      });
    }

    const uniqueIssues = issues.filter(
      (issue, index, collection) =>
        collection.findIndex(
          (candidate) =>
            candidate.code === issue.code &&
            candidate.approvalId === issue.approvalId &&
            candidate.relatedApprovalId === issue.relatedApprovalId
        ) === index
    );

    return {
      status: uniqueIssues.length > 0 ? "critical" : "healthy",
      issues: uniqueIssues,
      headApprovalId: head?.id ?? null,
      tailApprovalId: tail?.id ?? null,
      actionableApprovalId:
        pendingApprovals.length === 1 ? pendingApprovals[0]!.id : null
    };
  }

  private async recordBlockedApprovalLineageMutation(
    client: ReleaseReadinessApprovalLookupClient,
    approval: ReleaseReadinessApprovalRecord,
    operatorId: string,
    operatorRole: string | undefined,
    attemptedAction:
      | "approve"
      | "reject"
      | "rebind_pack",
    integrity: ReleaseReadinessApprovalLineageIntegrity,
    reason:
      | "lineage_integrity_unhealthy"
      | "selected_approval_not_actionable"
  ) {
    await client.auditEvent?.create({
      data: {
        actorType: "operator",
        actorId: operatorId,
        action: "release_readiness.approval_mutation_blocked",
        targetType: "ReleaseReadinessApproval",
        targetId: approval.id,
        metadata: {
          releaseIdentifier: approval.releaseIdentifier,
          environment: approval.environment,
          attemptedAction,
          operatorRole: normalizeOperatorRole(operatorRole),
          reason,
          actionableApprovalId: integrity.actionableApprovalId,
          headApprovalId: integrity.headApprovalId,
          tailApprovalId: integrity.tailApprovalId,
          integrityStatus: integrity.status,
          integrityIssues: integrity.issues,
          selectedApprovalId: approval.id
        } as PrismaJsonValue
      }
    });
  }

  private async assertApprovalActionableInLineage(
    client: ReleaseReadinessApprovalLookupClient,
    approval: ReleaseReadinessApprovalRecord,
    context: {
      operatorId: string;
      operatorRole: string | undefined;
      attemptedAction: "approve" | "reject" | "rebind_pack";
    }
  ) {
    const { lineageRecords, issues } = await this.collectApprovalLineageRecords(
      client,
      approval
    );
    const integrity = this.buildApprovalLineageIntegrityFromRecords(
      lineageRecords,
      issues
    );

    if (integrity.status !== "healthy") {
      if (
        integrity.actionableApprovalId &&
        integrity.actionableApprovalId !== approval.id
      ) {
        await this.recordBlockedApprovalLineageMutation(
          client,
          approval,
          context.operatorId,
          context.operatorRole,
          context.attemptedAction,
          integrity,
          "selected_approval_not_actionable"
        );
        throw new ConflictException(
          `Selected launch approval is no longer actionable. Refresh and continue with ${integrity.actionableApprovalId}.`
        );
      }

      await this.recordBlockedApprovalLineageMutation(
        client,
        approval,
        context.operatorId,
        context.operatorRole,
        context.attemptedAction,
        integrity,
        "lineage_integrity_unhealthy"
      );
      throw new ConflictException(
        "Launch approval lineage integrity must be healthy before this action can proceed. Refresh approval data and resolve lineage issues."
      );
    }

    if (integrity.actionableApprovalId !== approval.id) {
      await this.recordBlockedApprovalLineageMutation(
        client,
        approval,
        context.operatorId,
        context.operatorRole,
        context.attemptedAction,
        integrity,
        "selected_approval_not_actionable"
      );
      throw new ConflictException(
        `Selected launch approval is no longer actionable. Refresh and continue with ${integrity.actionableApprovalId}.`
      );
    }
  }

  private mapLaunchClosurePackProjection(
    record: ReleaseLaunchClosurePackRecord
  ): ReleaseLaunchClosurePackProjection {
    const artifactManifest = this.readLaunchClosureArtifactManifest(
      record.artifactPayload
    );

    return {
      id: record.id,
      releaseIdentifier: record.releaseIdentifier,
      environment: record.environment,
      version: record.version,
      generatedByOperatorId: record.generatedByOperatorId,
      generatedByOperatorRole: record.generatedByOperatorRole ?? null,
      artifactChecksumSha256: record.artifactChecksumSha256,
      manifestChecksumSha256: artifactManifest?.manifestChecksumSha256 ?? null,
      artifactManifest,
      artifactPayload: record.artifactPayload,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildLaunchClosurePackWhere(
    query: ListReleaseLaunchClosurePacksDto
  ): Prisma.ReleaseLaunchClosurePackWhereInput {
    const where: Prisma.ReleaseLaunchClosurePackWhereInput = {};

    if (query.releaseIdentifier) {
      where.releaseIdentifier = {
        equals: query.releaseIdentifier.trim(),
        mode: Prisma.QueryMode.insensitive
      };
    }

    if (query.environment) {
      where.environment = query.environment;
    }

    if (query.sinceDays) {
      where.createdAt = {
        gte: new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000)
      };
    }

    return where;
  }

  private async getLatestLaunchClosurePackForScope(
    releaseIdentifier: string,
    environment: ReleaseReadinessEnvironment
  ): Promise<ReleaseLaunchClosurePackRecord | null> {
    return this.prismaService.releaseLaunchClosurePack.findFirst({
      where: {
        releaseIdentifier,
        environment
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }]
    });
  }

  private normalizeHex(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeChecksum(value: string): string {
    return value.trim().toLowerCase().replace(/^sha256:/, "");
  }

  private fingerprintString(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private readRollbackDeploymentArtifactRecord(
    value: unknown
  ): RollbackDeploymentArtifactRecord | null {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      return null;
    }

    const artifact = value as Record<string, unknown>;
    const releaseId = artifact.releaseId;
    const service = artifact.service;
    const environment = artifact.environment;
    const artifactKind = artifact.artifactKind;
    const artifactUri = artifact.artifactUri;
    const artifactDigestSha256 = artifact.artifactDigestSha256;
    const sourceCommitSha = artifact.sourceCommitSha;
    const runtime = artifact.runtime;

    if (
      typeof releaseId !== "string" ||
      (service !== "api" && service !== "worker") ||
      (environment !== ReleaseReadinessEnvironment.staging &&
        environment !== ReleaseReadinessEnvironment.production_like &&
        environment !== ReleaseReadinessEnvironment.production) ||
      typeof artifactKind !== "string" ||
      typeof artifactUri !== "string" ||
      typeof artifactDigestSha256 !== "string" ||
      typeof sourceCommitSha !== "string" ||
      typeof runtime !== "string"
    ) {
      return null;
    }

    return {
      releaseId,
      service,
      environment,
      artifactKind,
      artifactUri,
      artifactDigestSha256,
      sourceCommitSha,
      runtime
    };
  }

  private readRollbackDeploymentArtifactEvidencePayload(
    evidencePayload: PrismaJsonValue | undefined
  ): RollbackDeploymentArtifactEvidencePayload | null {
    if (
      !evidencePayload ||
      Array.isArray(evidencePayload) ||
      typeof evidencePayload !== "object"
    ) {
      return null;
    }

    const payload = evidencePayload as Record<string, unknown>;
    const currentArtifact = this.readRollbackDeploymentArtifactRecord(
      payload.currentArtifact
    );
    const rollbackArtifact = this.readRollbackDeploymentArtifactRecord(
      payload.rollbackArtifact
    );

    if (
      payload.proofKind !== "deployment_artifact_manifest" ||
      (payload.service !== "api" && payload.service !== "worker") ||
      typeof payload.approvalRollbackReleaseIdentifier !== "string" ||
      payload.artifactManifestPath !== "payloads/release-artifacts.json" ||
      !currentArtifact ||
      !rollbackArtifact
    ) {
      return null;
    }

    return {
      proofKind: "deployment_artifact_manifest",
      service: payload.service,
      approvalRollbackReleaseIdentifier:
        payload.approvalRollbackReleaseIdentifier,
      currentArtifact,
      rollbackArtifact,
      artifactManifestPath: "payloads/release-artifacts.json"
    };
  }

  private assertRollbackDeploymentArtifactRecord(
    artifact: RollbackDeploymentArtifactRecord,
    key: string,
    expectedService: "api" | "worker",
    expectedEnvironment: ReleaseReadinessEnvironment
  ): string[] {
    const mismatches: string[] = [];

    if (artifact.service !== expectedService) {
      mismatches.push(`${key}.service`);
    }

    if (artifact.environment !== expectedEnvironment) {
      mismatches.push(`${key}.environment`);
    }

    if (artifact.releaseId.trim().length === 0) {
      mismatches.push(`${key}.releaseId`);
    }

    if (artifact.artifactKind.trim().length === 0) {
      mismatches.push(`${key}.artifactKind`);
    }

    if (artifact.artifactUri.trim().length === 0) {
      mismatches.push(`${key}.artifactUri`);
    }

    if (
      !deploymentArtifactChecksumPattern.test(
        artifact.artifactDigestSha256.trim()
      )
    ) {
      mismatches.push(`${key}.artifactDigestSha256`);
    }

    if (
      !deploymentArtifactCommitShaPattern.test(artifact.sourceCommitSha.trim())
    ) {
      mismatches.push(`${key}.sourceCommitSha`);
    }

    if (artifact.runtime.trim().length === 0) {
      mismatches.push(`${key}.runtime`);
    }

    return mismatches;
  }

  private assertRollbackDrillEvidenceArtifactBinding(
    evidenceType: ReleaseReadinessEvidenceType,
    environment: ReleaseReadinessEnvironment,
    rollbackReleaseIdentifier: string | null,
    evidencePayload: PrismaJsonValue | undefined
  ): void {
    if (!rollbackScopedEvidenceTypes.has(evidenceType)) {
      return;
    }

    const expectedService =
      evidenceType === ReleaseReadinessEvidenceType.api_rollback_drill
        ? "api"
        : "worker";
    const payload =
      this.readRollbackDeploymentArtifactEvidencePayload(evidencePayload);

    if (!payload) {
      throw new BadRequestException(
        `Release readiness evidence for ${evidenceType} requires a deployment_artifact_manifest payload from payloads/release-artifacts.json.`
      );
    }

    const mismatches = [
      ...this.assertRollbackDeploymentArtifactRecord(
        payload.currentArtifact,
        "currentArtifact",
        expectedService,
        environment
      ),
      ...this.assertRollbackDeploymentArtifactRecord(
        payload.rollbackArtifact,
        "rollbackArtifact",
        expectedService,
        environment
      )
    ];

    if (payload.service !== expectedService) {
      mismatches.push("service");
    }

    if (
      payload.approvalRollbackReleaseIdentifier !== rollbackReleaseIdentifier
    ) {
      mismatches.push("approvalRollbackReleaseIdentifier");
    }

    if (
      payload.currentArtifact.releaseId === payload.rollbackArtifact.releaseId
    ) {
      mismatches.push("artifact release ids must differ");
    }

    if (
      this.normalizeChecksum(payload.currentArtifact.artifactDigestSha256) ===
      this.normalizeChecksum(payload.rollbackArtifact.artifactDigestSha256)
    ) {
      mismatches.push("artifact digests must differ");
    }

    if (mismatches.length > 0) {
      throw new BadRequestException(
        `Rollback drill evidence artifact binding is invalid: ${mismatches.join(
          ", "
        )}.`
      );
    }
  }

  private buildSolvencyAnchorRegistryEvidenceDraft(
    query: GetSolvencyAnchorRegistryDeploymentProofDto,
    manifest: ContractDeploymentManifestRecord | null,
    ready: boolean,
    requiredOperatorInputs: string[]
  ): SolvencyAnchorRegistryDeploymentProofStatus["evidenceRequestDraft"] {
    const networkName =
      this.normalizeOptionalString(query.networkName) ?? "<networkName>";
    const manifestPath =
      this.normalizeOptionalString(query.manifestPath) ??
      "<deploymentManifestPath>";
    const manifestCommitSha =
      this.normalizeOptionalString(query.manifestCommitSha) ??
      "<manifestCommitSha>";
    const releaseIdentifier =
      this.normalizeOptionalString(query.releaseIdentifier) ??
      "<releaseIdentifier>";

    if (
      !manifest ||
      !manifest.deploymentTxHash ||
      !manifest.governanceOwner ||
      !manifest.authorizedAnchorer
    ) {
      return {
        recordable: false,
        body: null
      };
    }

    return {
      recordable: ready && requiredOperatorInputs.length === 0,
      body: {
        evidenceType: "solvency_anchor_registry_deployment",
        environment: query.environment,
        status: "passed",
        releaseIdentifier,
        summary:
          "Solvency report anchor registry deployment is active, governed, and bound to the authorized anchor signer.",
        runbookPath:
          "docs/runbooks/solvency-anchor-registry-deployment-proof.md",
        evidencePayload: {
          proofKind: "manual_attestation",
          networkName,
          chainId: query.chainId,
          contractProductSurface: "solvency_report_anchor_registry_v1",
          signerScope: "solvency_anchor_execution",
          contractAddress: manifest.contractAddress,
          deploymentTxHash: manifest.deploymentTxHash,
          governanceOwner: manifest.governanceOwner,
          authorizedAnchorer: manifest.authorizedAnchorer,
          abiChecksumSha256: manifest.abiChecksumSha256,
          manifestPath,
          manifestCommitSha
        }
      }
    };
  }

  async getSolvencyAnchorRegistryDeploymentProof(
    query: GetSolvencyAnchorRegistryDeploymentProofDto
  ): Promise<SolvencyAnchorRegistryDeploymentProofStatus> {
    const manifest =
      await this.prismaService.contractDeploymentManifest.findFirst({
        where: {
          environment: query.environment,
          chainId: query.chainId,
          productSurface: "solvency_report_anchor_registry_v1",
          manifestStatus: "active"
        },
        orderBy: [{ updatedAt: "desc" }]
      });
    const governedSigner = manifest?.authorizedAnchorer
      ? await this.prismaService.governedSignerInventory.findFirst({
          where: {
            environment: query.environment,
            chainId: query.chainId,
            signerScope: "solvency_anchor_execution",
            signerAddress: {
              equals: manifest.authorizedAnchorer,
              mode: Prisma.QueryMode.insensitive
            },
            active: true
          },
          orderBy: [{ updatedAt: "desc" }]
        })
      : await this.prismaService.governedSignerInventory.findFirst({
          where: {
            environment: query.environment,
            chainId: query.chainId,
            signerScope: "solvency_anchor_execution",
            active: true
          },
          orderBy: [{ updatedAt: "desc" }]
        });
    const governanceAuthority = manifest?.governanceOwner
      ? await this.prismaService.governanceAuthorityManifest.findFirst({
          where: {
            environment: query.environment,
            chainId: query.chainId,
            authorityType: "governance_safe",
            address: {
              equals: manifest.governanceOwner,
              mode: Prisma.QueryMode.insensitive
            },
            manifestStatus: "active"
          },
          orderBy: [{ updatedAt: "desc" }]
        })
      : await this.prismaService.governanceAuthorityManifest.findFirst({
          where: {
            environment: query.environment,
            chainId: query.chainId,
            authorityType: "governance_safe",
            manifestStatus: "active"
          },
          orderBy: [{ updatedAt: "desc" }]
        });
    const blockers: string[] = [];

    if (!manifest) {
      blockers.push(
        "No active solvency_report_anchor_registry_v1 deployment manifest exists for the requested environment and chain."
      );
    } else {
      if (manifest.legacyPath) {
        blockers.push(
          "The active solvency anchor registry deployment manifest is marked as a legacy path."
        );
      }

      if (!manifest.deploymentTxHash) {
        blockers.push(
          "The active solvency anchor registry deployment manifest is missing deploymentTxHash."
        );
      }

      if (!manifest.governanceOwner) {
        blockers.push(
          "The active solvency anchor registry deployment manifest is missing governanceOwner."
        );
      }

      if (!manifest.authorizedAnchorer) {
        blockers.push(
          "The active solvency anchor registry deployment manifest is missing authorizedAnchorer."
        );
      }

      if (!manifest.abiChecksumSha256) {
        blockers.push(
          "The active solvency anchor registry deployment manifest is missing abiChecksumSha256."
        );
      }

      if (!governedSigner) {
        blockers.push(
          "No active governed signer inventory entry matches solvency_anchor_execution for the manifest authorizedAnchorer."
        );
      } else if (
        manifest.authorizedAnchorer &&
        this.normalizeHex(governedSigner.signerAddress) !==
          this.normalizeHex(manifest.authorizedAnchorer)
      ) {
        blockers.push(
          "The active governed solvency_anchor_execution signer does not match the manifest authorizedAnchorer."
        );
      }

      if (!governanceAuthority) {
        blockers.push(
          "No active governance_safe authority manifest matches the manifest governanceOwner."
        );
      } else if (
        manifest.governanceOwner &&
        this.normalizeHex(governanceAuthority.address) !==
          this.normalizeHex(manifest.governanceOwner)
      ) {
        blockers.push(
          "The active governance_safe authority does not match the manifest governanceOwner."
        );
      }
    }

    const operatorInputs: Array<[string, string | undefined]> = [
      ["networkName", query.networkName],
      ["manifestPath", query.manifestPath],
      ["manifestCommitSha", query.manifestCommitSha],
      ["releaseIdentifier", query.releaseIdentifier]
    ];
    const requiredOperatorInputs = operatorInputs
      .filter(([, value]) => !this.normalizeOptionalString(value))
      .map(([field]) => field);
    const ready = blockers.length === 0;

    return {
      generatedAt: new Date().toISOString(),
      evidenceType:
        solvencyAnchorRegistryDeploymentEvidenceType as "solvency_anchor_registry_deployment",
      environment: query.environment,
      chainId: query.chainId,
      ready,
      blockers,
      requiredOperatorInputs,
      recordEvidenceEndpoint: "/release-readiness/internal/evidence",
      registryContract: manifest
        ? {
            id: manifest.id,
            productSurface: "solvency_report_anchor_registry_v1",
            contractVersion: manifest.contractVersion,
            contractAddress: manifest.contractAddress,
            abiChecksumSha256: manifest.abiChecksumSha256,
            deploymentTxHash: manifest.deploymentTxHash ?? null,
            governanceOwner: manifest.governanceOwner ?? null,
            authorizedAnchorer: manifest.authorizedAnchorer ?? null,
            blockExplorerUrl: manifest.blockExplorerUrl ?? null,
            anchoredSmokeTxHash: manifest.anchoredSmokeTxHash ?? null,
            manifestStatus: manifest.manifestStatus,
            legacyPath: manifest.legacyPath,
            updatedAt: manifest.updatedAt.toISOString()
          }
        : null,
      governedSigner: governedSigner
        ? {
            id: governedSigner.id,
            signerScope: "solvency_anchor_execution",
            backendKind: governedSigner.backendKind,
            keyReferenceSha256: this.fingerprintString(
              governedSigner.keyReference
            ),
            signerAddress: governedSigner.signerAddress,
            allowedMethods: [...governedSigner.allowedMethods],
            manifestVersion: governedSigner.manifestVersion ?? null,
            environmentBinding: governedSigner.environmentBinding ?? null,
            active: governedSigner.active,
            updatedAt: governedSigner.updatedAt.toISOString()
          }
        : null,
      governanceAuthority: governanceAuthority
        ? {
            id: governanceAuthority.id,
            authorityType: "governance_safe",
            address: governanceAuthority.address,
            ownerLabel: governanceAuthority.ownerLabel ?? null,
            manifestStatus: governanceAuthority.manifestStatus,
            updatedAt: governanceAuthority.updatedAt.toISOString()
          }
        : null,
      evidenceRequestDraft: this.buildSolvencyAnchorRegistryEvidenceDraft(
        query,
        manifest,
        ready,
        requiredOperatorInputs
      )
    };
  }

  private readSolvencyAnchorRegistryEvidencePayload(
    evidencePayload: PrismaJsonValue | undefined
  ): SolvencyAnchorRegistryEvidencePayload | null {
    if (
      !evidencePayload ||
      Array.isArray(evidencePayload) ||
      typeof evidencePayload !== "object"
    ) {
      return null;
    }

    const payload = evidencePayload as Record<string, unknown>;
    const chainId =
      typeof payload.chainId === "number"
        ? payload.chainId
        : Number(payload.chainId);

    if (
      !Number.isInteger(chainId) ||
      typeof payload.contractAddress !== "string" ||
      typeof payload.deploymentTxHash !== "string" ||
      typeof payload.governanceOwner !== "string" ||
      typeof payload.authorizedAnchorer !== "string" ||
      typeof payload.abiChecksumSha256 !== "string"
    ) {
      return null;
    }

    const hasOnchainVerification = Object.prototype.hasOwnProperty.call(
      payload,
      "onchainVerification"
    );
    const onchainVerification =
      hasOnchainVerification &&
      payload.onchainVerification &&
      !Array.isArray(payload.onchainVerification) &&
      typeof payload.onchainVerification === "object"
        ? (payload.onchainVerification as Record<string, unknown>)
        : null;
    const onchainVerificationPayload = onchainVerification ?? {};

    return {
      chainId,
      contractAddress: payload.contractAddress,
      deploymentTxHash: payload.deploymentTxHash,
      governanceOwner: payload.governanceOwner,
      authorizedAnchorer: payload.authorizedAnchorer,
      abiChecksumSha256: payload.abiChecksumSha256,
      onchainVerification: hasOnchainVerification
        ? {
            chainId:
              typeof onchainVerificationPayload.chainId === "number"
                ? onchainVerificationPayload.chainId
                : Number(onchainVerificationPayload.chainId),
            contractAddress:
              typeof onchainVerificationPayload.contractAddress === "string"
                ? onchainVerificationPayload.contractAddress
                : undefined,
            deploymentTxHash:
              typeof onchainVerificationPayload.deploymentTxHash === "string"
                ? onchainVerificationPayload.deploymentTxHash
                : undefined,
            owner:
              typeof onchainVerificationPayload.owner === "string"
                ? onchainVerificationPayload.owner
                : undefined,
            authorizedAnchorer:
              typeof onchainVerificationPayload.authorizedAnchorer === "string"
                ? onchainVerificationPayload.authorizedAnchorer
                : undefined,
            bytecodePresent:
              typeof onchainVerificationPayload.bytecodePresent === "boolean"
                ? onchainVerificationPayload.bytecodePresent
                : undefined,
            deploymentBlockNumber:
              typeof onchainVerificationPayload.deploymentBlockNumber ===
              "number"
                ? onchainVerificationPayload.deploymentBlockNumber
                : null,
            rpcUrlHost:
              typeof onchainVerificationPayload.rpcUrlHost === "string"
                ? onchainVerificationPayload.rpcUrlHost
                : undefined
          }
        : undefined
    };
  }

  private assertSolvencyAnchorOnchainVerificationMatchesPayload(
    payload: SolvencyAnchorRegistryEvidencePayload,
    environment: ReleaseReadinessEnvironment,
    status: ReleaseReadinessEvidenceStatus
  ): void {
    const verification = payload.onchainVerification;

    if (!verification) {
      if (
        status === ReleaseReadinessEvidenceStatus.passed &&
        onchainVerifiedSolvencyAnchorEvidenceEnvironments.has(environment)
      ) {
        throw new BadRequestException(
          "Passed production-like or production solvency anchor registry deployment evidence requires on-chain verification metadata."
        );
      }
      return;
    }

    const mismatches: string[] = [];

    if (!Number.isInteger(verification.chainId)) {
      mismatches.push("chain id");
    } else if (verification.chainId !== payload.chainId) {
      mismatches.push("chain id");
    }

    if (
      !verification.contractAddress ||
      this.normalizeHex(verification.contractAddress) !==
        this.normalizeHex(payload.contractAddress)
    ) {
      mismatches.push("contract address");
    }

    if (
      !verification.deploymentTxHash ||
      this.normalizeHex(verification.deploymentTxHash) !==
        this.normalizeHex(payload.deploymentTxHash)
    ) {
      mismatches.push("deployment transaction hash");
    }

    if (
      !verification.owner ||
      this.normalizeHex(verification.owner) !==
        this.normalizeHex(payload.governanceOwner)
    ) {
      mismatches.push("owner");
    }

    if (
      !verification.authorizedAnchorer ||
      this.normalizeHex(verification.authorizedAnchorer) !==
        this.normalizeHex(payload.authorizedAnchorer)
    ) {
      mismatches.push("authorized anchorer");
    }

    if (verification.bytecodePresent !== true) {
      mismatches.push("deployed bytecode");
    }

    const deploymentBlockNumber = verification.deploymentBlockNumber;

    if (
      deploymentBlockNumber !== null &&
      deploymentBlockNumber !== undefined &&
      (!Number.isInteger(deploymentBlockNumber) || deploymentBlockNumber <= 0)
    ) {
      mismatches.push("deployment block number");
    }

    if (!verification.rpcUrlHost?.trim()) {
      mismatches.push("RPC host");
    }

    if (mismatches.length > 0) {
      throw new BadRequestException(
        `Solvency anchor registry deployment on-chain verification does not match evidence fields: ${mismatches.join(
          ", "
        )}.`
      );
    }
  }

  private async assertSolvencyAnchorRegistryEvidenceMatchesManifest(
    environment: ReleaseReadinessEnvironment,
    status: ReleaseReadinessEvidenceStatus,
    evidencePayload: PrismaJsonValue | undefined
  ): Promise<void> {
    const payload =
      this.readSolvencyAnchorRegistryEvidencePayload(evidencePayload);

    if (!payload) {
      throw new BadRequestException(
        "Solvency anchor registry deployment evidence payload could not be parsed for manifest verification."
      );
    }

    this.assertSolvencyAnchorOnchainVerificationMatchesPayload(
      payload,
      environment,
      status
    );

    const manifest =
      await this.prismaService.contractDeploymentManifest.findFirst({
        where: {
          environment,
          chainId: payload.chainId,
          productSurface: "solvency_report_anchor_registry_v1",
          contractAddress: {
            equals: payload.contractAddress,
            mode: Prisma.QueryMode.insensitive
          },
          manifestStatus: "active"
        }
      });

    if (!manifest) {
      throw new BadRequestException(
        "Solvency anchor registry deployment evidence must match an active contract deployment manifest."
      );
    }

    const mismatches: string[] = [];

    if (
      !manifest.deploymentTxHash ||
      this.normalizeHex(manifest.deploymentTxHash) !==
        this.normalizeHex(payload.deploymentTxHash)
    ) {
      mismatches.push("deployment transaction hash");
    }

    if (
      !manifest.governanceOwner ||
      this.normalizeHex(manifest.governanceOwner) !==
        this.normalizeHex(payload.governanceOwner)
    ) {
      mismatches.push("governance owner");
    }

    if (
      !manifest.authorizedAnchorer ||
      this.normalizeHex(manifest.authorizedAnchorer) !==
        this.normalizeHex(payload.authorizedAnchorer)
    ) {
      mismatches.push("authorized anchorer");
    }

    if (
      this.normalizeChecksum(manifest.abiChecksumSha256) !==
      this.normalizeChecksum(payload.abiChecksumSha256)
    ) {
      mismatches.push("ABI checksum");
    }

    if (mismatches.length > 0) {
      throw new BadRequestException(
        `Solvency anchor registry deployment evidence does not match the active manifest fields: ${mismatches.join(
          ", "
        )}.`
      );
    }

    const governedSigner =
      await this.prismaService.governedSignerInventory.findFirst({
        where: {
          environment,
          chainId: payload.chainId,
          signerScope: "solvency_anchor_execution",
          signerAddress: {
            equals: payload.authorizedAnchorer,
            mode: Prisma.QueryMode.insensitive
          },
          active: true
        }
      });

    if (!governedSigner) {
      throw new BadRequestException(
        "Solvency anchor registry deployment evidence authorized anchorer must match an active governed solvency_anchor_execution signer."
      );
    }

    const governanceAuthority =
      await this.prismaService.governanceAuthorityManifest.findFirst({
        where: {
          environment,
          chainId: payload.chainId,
          authorityType: "governance_safe",
          address: {
            equals: payload.governanceOwner,
            mode: Prisma.QueryMode.insensitive
          },
          manifestStatus: "active"
        }
      });

    if (!governanceAuthority) {
      throw new BadRequestException(
        "Solvency anchor registry deployment evidence governance owner must match the active governance_safe manifest authority."
      );
    }
  }

  async recordEvidence(
    dto: CreateReleaseReadinessEvidenceDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessEvidenceMutationResult> {
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);
    const runbookPath =
      this.normalizeOptionalString(dto.runbookPath) ??
      requiredReleaseReadinessChecks.find(
        (check) => check.evidenceType === dto.evidenceType
      )?.runbookPath ??
      null;
    const summary = dto.summary.trim();
    const note = this.normalizeOptionalString(dto.note);
    const releaseIdentifier = this.normalizeOptionalString(dto.releaseIdentifier);
    const rollbackReleaseIdentifier = this.normalizeOptionalString(
      dto.rollbackReleaseIdentifier
    );
    const backupReference = this.normalizeOptionalString(dto.backupReference);
    const missingMetadata = validateReleaseReadinessEvidenceMetadata({
      evidenceType: dto.evidenceType,
      releaseIdentifier,
      rollbackReleaseIdentifier,
      backupReference
    });
    const startedAt = this.normalizeOptionalDate(dto.startedAt);
    const completedAt = this.normalizeOptionalDate(dto.completedAt);
    const observedAt = this.normalizeOptionalDate(dto.observedAt) ?? new Date();
    const evidenceLinks = this.normalizeEvidenceLinks(dto.evidenceLinks);
    const evidencePayload =
      (dto.evidencePayload as PrismaJsonValue | undefined) ?? undefined;
    const missingPayloadFields = validateReleaseReadinessEvidencePayload({
      evidenceType: dto.evidenceType,
      evidencePayload
    });

    if (missingMetadata.length > 0) {
      throw new BadRequestException(
        `Release readiness evidence for ${dto.evidenceType} requires ${describeReleaseReadinessEvidenceMetadataRequirements(
          dto.evidenceType
        ).join(", ")}.`
      );
    }

    if (missingPayloadFields.length > 0) {
      throw new BadRequestException(
        `Release readiness evidence for ${dto.evidenceType} requires valid payload fields: ${describeReleaseReadinessEvidencePayloadRequirements(
          dto.evidenceType
        ).join(", ")}.`
      );
    }

    this.assertRollbackDrillEvidenceArtifactBinding(
      dto.evidenceType,
      dto.environment,
      rollbackReleaseIdentifier,
      evidencePayload
    );

    if (
      dto.evidenceType === solvencyAnchorRegistryDeploymentEvidenceType
    ) {
      await this.assertSolvencyAnchorRegistryEvidenceMatchesManifest(
        dto.environment,
        dto.status,
        evidencePayload
      );
    }

    const evidence = await this.prismaService.$transaction(async (transaction) => {
      const createdEvidence = await transaction.releaseReadinessEvidence.create({
        data: {
          evidenceType: dto.evidenceType,
          environment: dto.environment,
          status: dto.status,
          releaseIdentifier: releaseIdentifier ?? undefined,
          rollbackReleaseIdentifier: rollbackReleaseIdentifier ?? undefined,
          backupReference: backupReference ?? undefined,
          summary,
          note: note ?? undefined,
          operatorId,
          operatorRole: normalizedOperatorRole ?? undefined,
          runbookPath: runbookPath ?? undefined,
          evidenceLinks,
          evidencePayload,
          startedAt: startedAt ?? undefined,
          completedAt: completedAt ?? undefined,
          observedAt
        }
      });

      await this.appendAuditEvent(transaction, {
        data: {
          actorType: "operator",
          actorId: operatorId,
          action: "release_readiness.evidence_recorded",
          targetType: "ReleaseReadinessEvidence",
          targetId: createdEvidence.id,
          metadata: {
            evidenceType: createdEvidence.evidenceType,
            environment: createdEvidence.environment,
            status: createdEvidence.status,
            releaseIdentifier,
            rollbackReleaseIdentifier,
            backupReference,
            runbookPath,
            summary,
            evidenceLinks,
            observedAt: createdEvidence.observedAt.toISOString(),
            completedAt: createdEvidence.completedAt?.toISOString() ?? null,
            operatorRole: normalizedOperatorRole
          } as PrismaJsonValue
        }
      });

      return createdEvidence;
    });

    return {
      evidence: this.mapEvidenceProjection(evidence)
    };
  }

  async getEvidence(
    evidenceId: string
  ): Promise<ReleaseReadinessEvidenceMutationResult> {
    const evidence = await this.prismaService.releaseReadinessEvidence.findUnique({
      where: {
        id: evidenceId
      }
    });

    if (!evidence) {
      throw new NotFoundException("Release readiness evidence was not found.");
    }

    return {
      evidence: this.mapEvidenceProjection(evidence)
    };
  }

  async listEvidence(
    query: ListReleaseReadinessEvidenceDto
  ): Promise<ReleaseReadinessEvidenceList> {
    const limit = query.limit ?? 12;
    const where = this.buildEvidenceWhere(query);

    const [evidence, totalCount] = await Promise.all([
      this.prismaService.releaseReadinessEvidence.findMany({
        where,
        orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
        take: limit
      }),
      this.prismaService.releaseReadinessEvidence.count({
        where
      })
    ]);

    return {
      evidence: evidence.map((record) => this.mapEvidenceProjection(record)),
      limit,
      totalCount
    };
  }

  async getSummary(
    scope?: ReleaseReadinessSummaryScope,
    operatorContext?: {
      operatorId?: string | null;
      operatorRole?: string | null;
    }
  ): Promise<ReleaseReadinessSummary> {
    const normalizedScope = this.normalizeSummaryScope(scope);
    const candidateEvidence = await this.prismaService.releaseReadinessEvidence.findMany({
      where: this.buildSummaryEvidenceWhere(normalizedScope),
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }]
    });
    const recentEvidence = await this.prismaService.releaseReadinessEvidence.findMany({
      where: this.buildRecentEvidenceWhere(normalizedScope),
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
      take: 10
    });

    const latestEvidenceByType = new Map<
      ReleaseReadinessEvidenceType,
      ReleaseReadinessEvidenceRecord
    >();

    for (const evidence of candidateEvidence) {
      const check = requiredReleaseReadinessChecks.find(
        (candidateCheck) => candidateCheck.evidenceType === evidence.evidenceType
      );

      if (
        check &&
        check.acceptedEnvironments.includes(evidence.environment) &&
        !latestEvidenceByType.has(evidence.evidenceType)
      ) {
        latestEvidenceByType.set(evidence.evidenceType, evidence);
      }
    }

    const requiredChecks = requiredReleaseReadinessChecks.map((check) => {
      const latestEvidence = latestEvidenceByType.get(check.evidenceType) ?? null;
      const status: "passed" | "failed" | "pending" =
        latestEvidence?.status === ReleaseReadinessEvidenceStatus.passed
          ? "passed"
          : latestEvidence?.status === ReleaseReadinessEvidenceStatus.failed
            ? "failed"
            : "pending";

      return {
        evidenceType: check.evidenceType,
        label: check.label,
        description: check.description,
        runbookPath: check.runbookPath,
        acceptedEnvironments: [...check.acceptedEnvironments],
        status,
        latestEvidence: latestEvidence
          ? this.mapEvidenceProjection(latestEvidence)
          : null
      };
    });

    const passedCheckCount = requiredChecks.filter(
      (check) => check.status === "passed"
    ).length;
    const failedCheckCount = requiredChecks.filter(
      (check) => check.status === "failed"
    ).length;
    const pendingCheckCount = requiredChecks.filter(
      (check) => check.status === "pending"
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      releaseIdentifier: normalizedScope.releaseIdentifier ?? null,
      environment: normalizedScope.environment ?? null,
      approvalPolicy: this.buildApprovalPolicy(
        operatorContext?.operatorId,
        operatorContext?.operatorRole
      ),
      overallStatus:
        failedCheckCount > 0
          ? "critical"
          : pendingCheckCount > 0
            ? "warning"
            : "healthy",
      summary: {
        requiredCheckCount: requiredChecks.length,
        passedCheckCount,
        failedCheckCount,
        pendingCheckCount
      },
      requiredChecks,
      recentEvidence: recentEvidence.map((record) =>
        this.mapEvidenceProjection(record)
      )
    };
  }

  async getLaunchClosureStatus(
    scope?: ReleaseReadinessSummaryScope,
    operatorContext?: {
      operatorId?: string | null;
      operatorRole?: string | null;
    }
  ): Promise<LaunchClosureStatusProjection> {
    const summary = await this.getSummary(scope, operatorContext);
    const [latestApprovalRecord, latestPack] = summary.releaseIdentifier
      ? await Promise.all([
          this.prismaService.releaseReadinessApproval.findFirst({
          where: {
            releaseIdentifier: summary.releaseIdentifier,
            ...(summary.environment ? { environment: summary.environment } : {})
          },
          orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }]
        }),
          summary.environment
            ? this.getLatestLaunchClosurePackForScope(
                summary.releaseIdentifier,
                summary.environment
              )
            : Promise.resolve(null)
        ])
      : [null, null];
    const latestApproval = latestApprovalRecord
      ? this.mapApprovalProjection(latestApprovalRecord, summary, latestPack)
      : null;

    const externalChecks: LaunchClosureOperationalCheck[] =
      summary.requiredChecks
        .filter((check) =>
          !check.acceptedEnvironments.includes(
            ReleaseReadinessEnvironment.development
          ) &&
          !check.acceptedEnvironments.includes(ReleaseReadinessEnvironment.ci)
        )
        .map((check) => {
          const isStale =
            check.status === "passed" &&
            check.latestEvidence?.observedAt &&
            Date.now() - new Date(check.latestEvidence.observedAt).getTime() >
              this.maxEvidenceAgeHours * 60 * 60 * 1000;

          return {
            evidenceType: check.evidenceType,
            label: check.label,
            status: isStale ? "stale" : check.status,
            acceptedEnvironments: [...check.acceptedEnvironments],
            latestEvidence: check.latestEvidence
          };
        });

    const hasBlockingChecks = externalChecks.some(
      (check) =>
        check.status === "failed" ||
        check.status === "pending" ||
        check.status === "stale"
    );
    const overallStatus: LaunchClosureStatusProjection["overallStatus"] =
      latestApproval?.status === ReleaseReadinessApprovalStatus.approved
        ? "approved"
        : latestApproval?.status === ReleaseReadinessApprovalStatus.rejected
          ? "rejected"
          : latestApproval?.gate.approvalEligible
            ? "ready"
            : hasBlockingChecks ||
                latestApproval?.gate.overallStatus === "blocked"
              ? "blocked"
              : summary.releaseIdentifier
                ? "in_progress"
                : "blocked";

    return {
      generatedAt: summary.generatedAt,
      releaseIdentifier: summary.releaseIdentifier,
      environment: summary.environment,
      overallStatus,
      maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
      externalChecks,
      latestApproval,
      summaryMarkdown: renderLaunchClosureStatusSummary({
        releaseIdentifier: summary.releaseIdentifier,
        environment: summary.environment as
          | "staging"
          | "production_like"
          | "production"
          | null,
        overallStatus,
        maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
        externalChecks: externalChecks.map((check) => ({
          evidenceType: check.evidenceType,
          status: check.status,
          acceptedEnvironments: check.acceptedEnvironments,
          latestEvidenceObservedAt: check.latestEvidence?.observedAt ?? null,
          latestEvidenceEnvironment: check.latestEvidence?.environment ?? null
        })),
        latestApproval: latestApproval
          ? {
              status: latestApproval.status,
              gateOverallStatus: latestApproval.gate.overallStatus,
              missingEvidenceTypes: latestApproval.gate.missingEvidenceTypes,
              failedEvidenceTypes: latestApproval.gate.failedEvidenceTypes,
              staleEvidenceTypes: latestApproval.gate.staleEvidenceTypes,
              openBlockers: latestApproval.gate.openBlockers
            }
          : null
      })
    };
  }

  async storeLaunchClosurePack(
    manifest: LaunchClosureManifest,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<StoredLaunchClosurePackResult> {
    const validation = validateLaunchClosureManifest(manifest);

    if (validation.errors.length > 0) {
      throw new BadRequestException(validation.errors.join(" "));
    }

    const statusSnapshot = await this.getLaunchClosureStatus({
      releaseIdentifier: manifest.releaseIdentifier,
      environment: manifest.environment
    });
    const preview = previewLaunchClosurePack(manifest, {
      generatedAt: statusSnapshot.generatedAt,
      releaseIdentifier: statusSnapshot.releaseIdentifier,
      environment: manifest.environment,
      overallStatus: statusSnapshot.overallStatus,
      maximumEvidenceAgeHours: statusSnapshot.maximumEvidenceAgeHours,
      externalChecks: statusSnapshot.externalChecks.map((check) => ({
        evidenceType: check.evidenceType,
        status: check.status,
        acceptedEnvironments: check.acceptedEnvironments,
        latestEvidenceObservedAt: check.latestEvidence?.observedAt ?? null,
        latestEvidenceEnvironment: check.latestEvidence?.environment ?? null
      })),
      latestApproval: statusSnapshot.latestApproval
        ? {
            status: statusSnapshot.latestApproval.status,
            summary: statusSnapshot.latestApproval.summary,
            requestNote: statusSnapshot.latestApproval.requestNote,
            residualRiskNote:
              statusSnapshot.latestApproval.checklist.residualRiskNote,
            rollbackReleaseIdentifier:
              statusSnapshot.latestApproval.rollbackReleaseIdentifier,
            checklist: {
              securityConfigurationComplete:
                statusSnapshot.latestApproval.checklist
                  .securityConfigurationComplete,
              accessAndGovernanceComplete:
                statusSnapshot.latestApproval.checklist
                  .accessAndGovernanceComplete,
              dataAndRecoveryComplete:
                statusSnapshot.latestApproval.checklist.dataAndRecoveryComplete,
              platformHealthComplete:
                statusSnapshot.latestApproval.checklist.platformHealthComplete,
              functionalProofComplete:
                statusSnapshot.latestApproval.checklist.functionalProofComplete,
              contractAndChainProofComplete:
                statusSnapshot.latestApproval.checklist
                  .contractAndChainProofComplete,
              finalSignoffComplete:
                statusSnapshot.latestApproval.checklist.finalSignoffComplete,
              unresolvedRisksAccepted:
                statusSnapshot.latestApproval.checklist.unresolvedRisksAccepted
            },
            gateOverallStatus: statusSnapshot.latestApproval.gate.overallStatus,
            missingEvidenceTypes:
              statusSnapshot.latestApproval.gate.missingEvidenceTypes,
            failedEvidenceTypes:
              statusSnapshot.latestApproval.gate.failedEvidenceTypes,
            staleEvidenceTypes:
              statusSnapshot.latestApproval.gate.staleEvidenceTypes,
            openBlockers: statusSnapshot.latestApproval.gate.openBlockers
          }
        : null
    });
    const summaryMarkdown = renderLaunchClosureValidationSummary(manifest);
    const artifactManifest = buildLaunchClosureArtifactManifest(preview.files);
    const artifactPayload = {
      manifest,
      validation,
      summaryMarkdown,
      outputSubpath: preview.outputSubpath,
      artifactManifest,
      files: preview.files
    } as Prisma.JsonValue;
    const artifactChecksumSha256 = this.buildChecksum(artifactPayload);
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);

    const pack = await this.prismaService.$transaction(async (transaction) => {
      const latestPack = await transaction.releaseLaunchClosurePack.findFirst({
        where: {
          releaseIdentifier: manifest.releaseIdentifier,
          environment: manifest.environment
        },
        orderBy: [{ version: "desc" }]
      });
      const nextVersion = (latestPack?.version ?? 0) + 1;

      const createdPack = await transaction.releaseLaunchClosurePack.create({
        data: {
          releaseIdentifier: manifest.releaseIdentifier,
          environment: manifest.environment,
          version: nextVersion,
          generatedByOperatorId: operatorId,
          generatedByOperatorRole: normalizedOperatorRole ?? undefined,
          artifactChecksumSha256,
          artifactPayload: artifactPayload as PrismaJsonValue
        }
      });

      await this.appendAuditEvent(transaction, {
        data: {
          actorType: "operator",
          actorId: operatorId,
          action: "release_readiness.launch_closure_pack_generated",
          targetType: "ReleaseLaunchClosurePack",
          targetId: createdPack.id,
          metadata: {
            releaseIdentifier: createdPack.releaseIdentifier,
            environment: createdPack.environment,
            version: createdPack.version,
            artifactChecksumSha256,
            manifestChecksumSha256: artifactManifest.manifestChecksumSha256,
            artifactFileCount: artifactManifest.fileCount,
            operatorRole: normalizedOperatorRole
          } as PrismaJsonValue
        }
      });

      return createdPack;
    });

    return {
      validation,
      summaryMarkdown,
      outputSubpath: preview.outputSubpath,
      files: preview.files,
      pack: this.mapLaunchClosurePackProjection(pack)
    };
  }

  async getLaunchClosurePack(
    packId: string
  ): Promise<ReleaseLaunchClosurePackMutationResult> {
    const pack = await this.prismaService.releaseLaunchClosurePack.findUnique({
      where: {
        id: packId
      }
    });

    if (!pack) {
      throw new NotFoundException("Launch-closure pack was not found.");
    }

    return {
      pack: this.mapLaunchClosurePackProjection(pack)
    };
  }

  async verifyLaunchClosurePackIntegrity(
    packId: string
  ): Promise<ReleaseLaunchClosurePackIntegrityResult> {
    const pack = await this.prismaService.releaseLaunchClosurePack.findUnique({
      where: {
        id: packId
      }
    });

    if (!pack) {
      throw new NotFoundException("Launch-closure pack was not found.");
    }

    return this.verifyStoredLaunchClosurePackIntegrity(pack);
  }

  async listLaunchClosurePacks(
    query: ListReleaseLaunchClosurePacksDto
  ): Promise<ReleaseLaunchClosurePackList> {
    const limit = query.limit ?? 12;
    const where = this.buildLaunchClosurePackWhere(query);

    const [packs, totalCount] = await Promise.all([
      this.prismaService.releaseLaunchClosurePack.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        take: limit
      }),
      this.prismaService.releaseLaunchClosurePack.count({
        where
      })
    ]);

    return {
      packs: packs.map((record) => this.mapLaunchClosurePackProjection(record)),
      limit,
      totalCount
    };
  }

  async requestApproval(
    dto: CreateReleaseReadinessApprovalDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const releaseIdentifier = dto.releaseIdentifier.trim();
    const summaryText = dto.summary.trim();
    const requestNote = this.normalizeOptionalString(dto.requestNote);
    const rollbackReleaseIdentifier = this.normalizeOptionalString(
      dto.rollbackReleaseIdentifier
    );
    const normalizedOperatorRole = this.assertCanRequest(operatorRole);
    const checklist = this.buildApprovalChecklist(dto);

    if (!rollbackReleaseIdentifier) {
      throw new BadRequestException(
        "Launch approval requests require rollback release identifier."
      );
    }

    const [existingPendingApproval, launchClosurePack, readinessSummary] =
      await Promise.all([
      this.prismaService.releaseReadinessApproval.findFirst({
        where: {
          releaseIdentifier,
          environment: dto.environment,
          status: ReleaseReadinessApprovalStatus.pending_approval
        },
        orderBy: [{ requestedAt: "desc" }]
      }),
      this.prismaService.releaseLaunchClosurePack.findUnique({
        where: {
          id: dto.launchClosurePackId.trim()
        }
      }),
      this.getSummary({
        releaseIdentifier
      })
    ]);

    if (existingPendingApproval) {
      throw new ConflictException(
        "A pending launch approval already exists for this release identifier and environment."
      );
    }

    if (!launchClosurePack) {
      throw new NotFoundException("Launch-closure pack was not found.");
    }

    if (
      launchClosurePack.releaseIdentifier !== releaseIdentifier ||
      launchClosurePack.environment !== dto.environment
    ) {
      throw new BadRequestException(
        "Launch approval requests must reference a launch-closure pack for the same release identifier and environment."
      );
    }

    const launchClosurePackIntegrity =
      this.verifyStoredLaunchClosurePackIntegrity(launchClosurePack);
    this.assertLaunchClosurePackIntegrityDoesNotBlock(
      launchClosurePackIntegrity
    );

    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval,
      rollbackReleaseIdentifier
    );
    const launchClosurePackManifestChecksumSha256 =
      this.readLaunchClosureArtifactManifest(launchClosurePack.artifactPayload)
        ?.manifestChecksumSha256 ?? null;

    const approval = await this.prismaService.$transaction(async (transaction) => {
      const createdApproval = await transaction.releaseReadinessApproval.create({
        data: {
          releaseIdentifier,
          environment: dto.environment,
          launchClosurePackId: launchClosurePack.id,
          launchClosurePackVersion: launchClosurePack.version,
          launchClosurePackChecksumSha256:
            launchClosurePack.artifactChecksumSha256,
          rollbackReleaseIdentifier: rollbackReleaseIdentifier ?? undefined,
          summary: summaryText,
          requestNote: requestNote ?? undefined,
          requestedByOperatorId: operatorId,
          requestedByOperatorRole: normalizedOperatorRole ?? undefined,
          securityConfigurationComplete: checklist.securityConfigurationComplete,
          accessAndGovernanceComplete: checklist.accessAndGovernanceComplete,
          dataAndRecoveryComplete: checklist.dataAndRecoveryComplete,
          platformHealthComplete: checklist.platformHealthComplete,
          functionalProofComplete: checklist.functionalProofComplete,
          contractAndChainProofComplete:
            checklist.contractAndChainProofComplete,
          finalSignoffComplete: checklist.finalSignoffComplete,
          unresolvedRisksAccepted: checklist.unresolvedRisksAccepted,
          openBlockers: checklist.openBlockers,
          residualRiskNote: checklist.residualRiskNote ?? undefined,
          evidenceSnapshot: evidenceSnapshot as unknown as PrismaJsonValue,
          blockerSnapshot: gate as unknown as PrismaJsonValue
        }
      });

      await this.appendAuditEvent(transaction, {
        data: {
          actorType: "operator",
          actorId: operatorId,
          action: "release_readiness.approval_requested",
          targetType: "ReleaseReadinessApproval",
          targetId: createdApproval.id,
          metadata: {
            releaseIdentifier,
            environment: dto.environment,
            launchClosurePackId: launchClosurePack.id,
            launchClosurePackVersion: launchClosurePack.version,
            launchClosurePackChecksumSha256:
              launchClosurePack.artifactChecksumSha256,
            launchClosurePackManifestChecksumSha256,
            launchClosurePackIntegrity: {
              valid: launchClosurePackIntegrity.valid,
              artifactChecksumMatches:
                launchClosurePackIntegrity.artifactChecksumMatches,
              expectedFileCount: launchClosurePackIntegrity.expectedFileCount,
              checkedFileCount: launchClosurePackIntegrity.checkedFileCount
            },
            rollbackReleaseIdentifier,
            summary: summaryText,
            operatorRole: normalizedOperatorRole,
            gate
          } as PrismaJsonValue
        }
      });

      return createdApproval;
    });

    return {
      approval: this.mapApprovalProjection(
        approval,
        readinessSummary,
        launchClosurePack
      )
    };
  }

  async approveApproval(
    approvalId: string,
    dto: ApproveReleaseReadinessApprovalDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const approvedOperatorRole = this.assertCanApprove(operatorRole);
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    if (approval.status !== ReleaseReadinessApprovalStatus.pending_approval) {
      throw new ConflictException(
        "Only pending launch approvals can be approved."
      );
    }

    if (approval.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Launch approval requires a different approver than the requester."
      );
    }

    const readinessSummary = await this.getSummary({
      releaseIdentifier: approval.releaseIdentifier
    });
    const checklist = this.mapApprovalChecklist(approval);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval,
      approval.rollbackReleaseIdentifier ?? null
    );
    const latestPack = await this.getLatestLaunchClosurePackForScope(
      approval.releaseIdentifier,
      approval.environment
    );
    const launchClosureDrift = this.buildLaunchClosureDrift(
      approval,
      readinessSummary,
      latestPack
    );

    if (!gate.approvalEligible) {
      throw new ConflictException(
        "Launch approval is blocked until checklist gaps, failed or stale evidence, and open blockers are remediated."
      );
    }

    this.assertApprovalDriftDoesNotBlock(launchClosureDrift);

    const boundLaunchClosurePack =
      latestPack?.id === approval.launchClosurePackId
        ? latestPack
        : approval.launchClosurePackId
          ? await this.prismaService.releaseLaunchClosurePack.findUnique({
              where: {
                id: approval.launchClosurePackId
              }
            })
          : null;
    const verifiedBoundLaunchClosurePack =
      this.assertLaunchClosurePackMatchesApprovalSnapshot(
        boundLaunchClosurePack,
        approval
      );
    const launchClosurePackIntegrity =
      this.verifyStoredLaunchClosurePackIntegrity(
        verifiedBoundLaunchClosurePack
      );
    this.assertLaunchClosurePackIntegrityDoesNotBlock(
      launchClosurePackIntegrity
    );

    const approvalNote = this.normalizeOptionalString(dto.approvalNote);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const approvedGate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.approved,
      approval.rollbackReleaseIdentifier ?? null
    );
    const decisionDriftCapturedAt = new Date();

    const updatedApproval = await this.prismaService.$transaction(
      async (transaction) => {
        const currentApproval =
          await transaction.releaseReadinessApproval.findUnique({
            where: {
              id: approval.id
            }
          });

        if (!currentApproval) {
          throw new NotFoundException(
            "Release readiness approval request was not found."
          );
        }

        if (
          currentApproval.status !==
          ReleaseReadinessApprovalStatus.pending_approval
        ) {
          throw new ConflictException(
            "Only pending launch approvals can be approved."
          );
        }

        this.assertExpectedApprovalVersion(
          currentApproval,
          dto.expectedUpdatedAt
        );
        await this.assertApprovalActionableInLineage(transaction, currentApproval, {
          operatorId,
          operatorRole,
          attemptedAction: "approve"
        });

        const nextApproval = await transaction.releaseReadinessApproval.update({
          where: {
            id: approval.id
          },
          data: {
            status: ReleaseReadinessApprovalStatus.approved,
            approvedByOperatorId: operatorId,
            approvedByOperatorRole: approvedOperatorRole,
            approvalNote: approvalNote ?? undefined,
            approvedAt: new Date(),
            evidenceSnapshot: evidenceSnapshot as unknown as PrismaJsonValue,
            blockerSnapshot: approvedGate as unknown as PrismaJsonValue,
            decisionDriftSnapshot:
              launchClosureDrift as unknown as PrismaJsonValue,
            decisionDriftCapturedAt
          }
        });

        await this.appendAuditEvent(transaction, {
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "release_readiness.approval_approved",
            targetType: "ReleaseReadinessApproval",
            targetId: nextApproval.id,
            metadata: {
              releaseIdentifier: nextApproval.releaseIdentifier,
              environment: nextApproval.environment,
              approvedByOperatorRole: approvedOperatorRole,
              approvalNote,
              gate: approvedGate,
              launchClosurePackIntegrity: {
                valid: launchClosurePackIntegrity.valid,
                artifactChecksumMatches:
                  launchClosurePackIntegrity.artifactChecksumMatches,
                expectedFileCount: launchClosurePackIntegrity.expectedFileCount,
                checkedFileCount: launchClosurePackIntegrity.checkedFileCount
              },
              launchClosureDrift,
              decisionDriftCapturedAt: decisionDriftCapturedAt.toISOString()
            } as PrismaJsonValue
          }
        });

        return nextApproval;
      }
    );

    return {
      approval: this.mapApprovalProjection(updatedApproval)
    };
  }

  async rebindApprovalToLaunchClosurePack(
    approvalId: string,
    launchClosurePackId: string,
    expectedUpdatedAt: string,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const normalizedOperatorRole = this.assertCanRequest(operatorRole);
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    if (approval.status !== ReleaseReadinessApprovalStatus.pending_approval) {
      throw new ConflictException(
        "Only pending launch approvals can be rebound to a new launch-closure pack."
      );
    }

    const nextPackId = launchClosurePackId.trim();

    if (approval.launchClosurePackId === nextPackId) {
      throw new ConflictException(
        "Launch approval already references the requested launch-closure pack."
      );
    }

    const [launchClosurePack, readinessSummary] = await Promise.all([
      this.prismaService.releaseLaunchClosurePack.findUnique({
        where: {
          id: nextPackId
        }
      }),
      this.getSummary({
        releaseIdentifier: approval.releaseIdentifier,
        environment: approval.environment
      })
    ]);

    if (!launchClosurePack) {
      throw new NotFoundException("Launch-closure pack was not found.");
    }

    if (
      launchClosurePack.releaseIdentifier !== approval.releaseIdentifier ||
      launchClosurePack.environment !== approval.environment
    ) {
      throw new BadRequestException(
        "Launch approval rebind requires a launch-closure pack for the same release identifier and environment."
      );
    }

    const launchClosurePackIntegrity =
      this.verifyStoredLaunchClosurePackIntegrity(launchClosurePack);
    this.assertLaunchClosurePackIntegrityDoesNotBlock(
      launchClosurePackIntegrity
    );

    const checklist = this.mapApprovalChecklist(approval);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval,
      approval.rollbackReleaseIdentifier ?? null
    );
    const launchClosurePackManifestChecksumSha256 =
      this.readLaunchClosureArtifactManifest(launchClosurePack.artifactPayload)
        ?.manifestChecksumSha256 ?? null;

    const updatedApproval = await this.prismaService.$transaction(
      async (transaction) => {
        const supersededAt = new Date();
        const rebindableApproval =
          await transaction.releaseReadinessApproval.findUnique({
            where: {
              id: approval.id
            }
          });

        if (!rebindableApproval) {
          throw new NotFoundException(
            "Release readiness approval request was not found."
          );
        }

        if (
          rebindableApproval.status !==
          ReleaseReadinessApprovalStatus.pending_approval
        ) {
          throw new ConflictException(
            "Only pending launch approvals can be rebound to a new launch-closure pack."
          );
        }

        this.assertExpectedApprovalVersion(
          rebindableApproval,
          expectedUpdatedAt
        );

        if (rebindableApproval.supersededByApprovalId) {
          throw new ConflictException(
            "Launch approval already has a replacement approval in its lineage."
          );
        }

        const lineageReplacement =
          await transaction.releaseReadinessApproval.findFirst({
            where: {
              supersedesApprovalId: approval.id
            }
          });

        if (lineageReplacement) {
          throw new ConflictException(
            "Launch approval lineage already contains a replacement approval."
          );
        }

        await this.assertApprovalActionableInLineage(transaction, rebindableApproval, {
          operatorId,
          operatorRole,
          attemptedAction: "rebind_pack"
        });

        const nextApproval = await transaction.releaseReadinessApproval.create({
          data: {
            releaseIdentifier: approval.releaseIdentifier,
            environment: approval.environment,
            supersedesApprovalId: approval.id,
            launchClosurePackId: launchClosurePack.id,
            launchClosurePackVersion: launchClosurePack.version,
            launchClosurePackChecksumSha256:
              launchClosurePack.artifactChecksumSha256,
            rollbackReleaseIdentifier:
              approval.rollbackReleaseIdentifier ?? undefined,
            status: ReleaseReadinessApprovalStatus.pending_approval,
            summary: approval.summary,
            requestNote: approval.requestNote ?? undefined,
            requestedByOperatorId: approval.requestedByOperatorId,
            requestedByOperatorRole:
              approval.requestedByOperatorRole ?? undefined,
            securityConfigurationComplete:
              approval.securityConfigurationComplete,
            accessAndGovernanceComplete:
              approval.accessAndGovernanceComplete,
            dataAndRecoveryComplete: approval.dataAndRecoveryComplete,
            platformHealthComplete: approval.platformHealthComplete,
            functionalProofComplete: approval.functionalProofComplete,
            contractAndChainProofComplete:
              approval.contractAndChainProofComplete,
            finalSignoffComplete: approval.finalSignoffComplete,
            unresolvedRisksAccepted: approval.unresolvedRisksAccepted,
            openBlockers: [...approval.openBlockers],
            residualRiskNote: approval.residualRiskNote ?? undefined,
            evidenceSnapshot: evidenceSnapshot as unknown as PrismaJsonValue,
            blockerSnapshot: gate as unknown as PrismaJsonValue
          }
        });

        await transaction.releaseReadinessApproval.update({
          where: {
            id: approval.id
          },
          data: {
            status: ReleaseReadinessApprovalStatus.superseded,
            supersededByOperatorId: operatorId,
            supersededByOperatorRole: normalizedOperatorRole,
            supersededByApprovalId: nextApproval.id,
            supersededAt
          }
        });

        await this.appendAuditEvent(transaction, {
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "release_readiness.approval_pack_rebound",
            targetType: "ReleaseReadinessApproval",
            targetId: approval.id,
            metadata: {
              releaseIdentifier: approval.releaseIdentifier,
              environment: approval.environment,
              supersededApprovalId: approval.id,
              supersededByApprovalId: nextApproval.id,
              supersededAt: supersededAt.toISOString(),
              previousLaunchClosurePackId: approval.launchClosurePackId,
              previousLaunchClosurePackVersion: approval.launchClosurePackVersion,
              previousLaunchClosurePackChecksumSha256:
                approval.launchClosurePackChecksumSha256,
              nextApprovalId: nextApproval.id,
              nextApprovalSupersedesApprovalId: approval.id,
              nextLaunchClosurePackId: launchClosurePack.id,
              nextLaunchClosurePackVersion: launchClosurePack.version,
              nextLaunchClosurePackChecksumSha256:
                launchClosurePack.artifactChecksumSha256,
              nextLaunchClosurePackManifestChecksumSha256:
                launchClosurePackManifestChecksumSha256,
              nextLaunchClosurePackIntegrity: {
                valid: launchClosurePackIntegrity.valid,
                artifactChecksumMatches:
                  launchClosurePackIntegrity.artifactChecksumMatches,
                expectedFileCount: launchClosurePackIntegrity.expectedFileCount,
                checkedFileCount: launchClosurePackIntegrity.checkedFileCount
              },
              operatorRole: normalizedOperatorRole,
              gate
            } as PrismaJsonValue
          }
        });

        return nextApproval;
      }
    );

    return {
      approval: this.mapApprovalProjection(
        updatedApproval,
        readinessSummary,
        launchClosurePack
      )
    };
  }

  async rejectApproval(
    approvalId: string,
    dto: RejectReleaseReadinessApprovalDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const rejectedOperatorRole = this.assertCanApprove(operatorRole);
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    if (approval.status !== ReleaseReadinessApprovalStatus.pending_approval) {
      throw new ConflictException(
        "Only pending launch approvals can be rejected."
      );
    }

    if (approval.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Launch approval requires a different approver than the requester."
      );
    }

    const readinessSummary = await this.getSummary({
      releaseIdentifier: approval.releaseIdentifier
    });
    const checklist = this.mapApprovalChecklist(approval);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const rejectedGate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.rejected,
      approval.rollbackReleaseIdentifier ?? null
    );
    const latestPack = await this.getLatestLaunchClosurePackForScope(
      approval.releaseIdentifier,
      approval.environment
    );
    const launchClosureDrift = this.buildLaunchClosureDrift(
      approval,
      readinessSummary,
      latestPack
    );
    const rejectionNote = dto.rejectionNote.trim();
    const decisionDriftCapturedAt = new Date();

    const updatedApproval = await this.prismaService.$transaction(
      async (transaction) => {
        const currentApproval =
          await transaction.releaseReadinessApproval.findUnique({
            where: {
              id: approval.id
            }
          });

        if (!currentApproval) {
          throw new NotFoundException(
            "Release readiness approval request was not found."
          );
        }

        if (
          currentApproval.status !==
          ReleaseReadinessApprovalStatus.pending_approval
        ) {
          throw new ConflictException(
            "Only pending launch approvals can be rejected."
          );
        }

        this.assertExpectedApprovalVersion(
          currentApproval,
          dto.expectedUpdatedAt
        );
        await this.assertApprovalActionableInLineage(transaction, currentApproval, {
          operatorId,
          operatorRole,
          attemptedAction: "reject"
        });

        const nextApproval = await transaction.releaseReadinessApproval.update({
          where: {
            id: approval.id
          },
          data: {
            status: ReleaseReadinessApprovalStatus.rejected,
            rejectedByOperatorId: operatorId,
            rejectedByOperatorRole: rejectedOperatorRole,
            rejectionNote,
            rejectedAt: new Date(),
            evidenceSnapshot: evidenceSnapshot as unknown as PrismaJsonValue,
            blockerSnapshot: rejectedGate as unknown as PrismaJsonValue,
            decisionDriftSnapshot:
              launchClosureDrift as unknown as PrismaJsonValue,
            decisionDriftCapturedAt
          }
        });

        await this.appendAuditEvent(transaction, {
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "release_readiness.approval_rejected",
            targetType: "ReleaseReadinessApproval",
            targetId: nextApproval.id,
            metadata: {
              releaseIdentifier: nextApproval.releaseIdentifier,
              environment: nextApproval.environment,
              rejectedByOperatorRole: rejectedOperatorRole,
              rejectionNote,
              gate: rejectedGate,
              launchClosureDrift,
              decisionDriftCapturedAt: decisionDriftCapturedAt.toISOString()
            } as PrismaJsonValue
          }
        });

        return nextApproval;
      }
    );

    return {
      approval: this.mapApprovalProjection(updatedApproval)
    };
  }

  async getApproval(
    approvalId: string
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    const [projection] = await this.hydrateApprovalProjections([approval]);

    return {
      approval: projection
    };
  }

  async getApprovalDecisionReceipt(
    approvalId: string
  ): Promise<ReleaseReadinessApprovalDecisionReceipt> {
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    const { lineageRecords, issues } = await this.collectApprovalLineageRecords(
      this.prismaService,
      approval
    );
    const lineage = this.buildApprovalLineageIntegrityFromRecords(
      lineageRecords,
      issues
    );
    const lineageIds = [...new Set(lineageRecords.map((record) => record.id))];

    const [boundLaunchClosurePack, auditTrailRecords] = await Promise.all([
      approval.launchClosurePackId
        ? this.prismaService.releaseLaunchClosurePack.findUnique({
            where: {
              id: approval.launchClosurePackId
            }
          })
        : Promise.resolve(null),
      this.prismaService.auditEvent.findMany({
        where: {
          targetType: "ReleaseReadinessApproval",
          targetId: {
            in: lineageIds.length > 0 ? lineageIds : [approval.id]
          },
          action: {
            startsWith: "release_readiness."
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      })
    ]);

    const snapshotMatchesApproval =
      this.launchClosurePackMatchesApprovalSnapshot(
        boundLaunchClosurePack,
        approval
      );
    const launchClosurePackIntegrity = boundLaunchClosurePack
      ? this.verifyStoredLaunchClosurePackIntegrity(boundLaunchClosurePack)
      : null;
    const projection = this.mapApprovalProjection(
      approval,
      undefined,
      boundLaunchClosurePack,
      {
        status: lineage.status,
        issueCount: lineage.issues.length,
        actionableApprovalId: lineage.actionableApprovalId,
        isActionable: lineage.actionableApprovalId === approval.id
      }
    );
    const blockers = [
      ...(!boundLaunchClosurePack
        ? ["The approval-bound launch-closure pack record is missing."]
        : []),
      ...(boundLaunchClosurePack && !snapshotMatchesApproval
        ? [
            "The approval-bound launch-closure pack no longer matches the approval snapshot."
          ]
        : []),
      ...(launchClosurePackIntegrity && !launchClosurePackIntegrity.valid
        ? [
            "The approval-bound launch-closure pack has stored integrity issues."
          ]
        : []),
      ...(lineage.status !== "healthy"
        ? ["The approval lineage has unresolved integrity issues."]
        : []),
      ...(approval.status !== ReleaseReadinessApprovalStatus.approved
        ? ["The approval decision is not an approved launch decision."]
        : [])
    ];
    const decidedAt =
      approval.approvedAt?.toISOString() ??
      approval.rejectedAt?.toISOString() ??
      null;
    const decidedByOperatorId =
      approval.approvedByOperatorId ?? approval.rejectedByOperatorId ?? null;
    const decidedByOperatorRole =
      approval.approvedByOperatorRole ?? approval.rejectedByOperatorRole ?? null;
    const note = approval.approvalNote ?? approval.rejectionNote ?? null;
    const receiptPayload = {
      receiptVersion: "release-readiness-approval-decision/v1",
      generatedAt: approval.updatedAt.toISOString(),
      releaseIdentifier: approval.releaseIdentifier,
      environment: approval.environment,
      finalDecision:
        approval.status === ReleaseReadinessApprovalStatus.approved ||
        approval.status === ReleaseReadinessApprovalStatus.rejected,
      launchReady:
        approval.status === ReleaseReadinessApprovalStatus.approved &&
        blockers.length === 0,
      blockers,
      decision: {
        status: approval.status,
        decidedAt,
        decidedByOperatorId,
        decidedByOperatorRole,
        note
      },
      approval: projection,
      launchClosurePack: {
        snapshotMatchesApproval,
        record: boundLaunchClosurePack
          ? this.mapLaunchClosurePackProjection(boundLaunchClosurePack)
          : null,
        integrity: launchClosurePackIntegrity
      },
      lineage,
      auditTrail: auditTrailRecords.map((record) =>
        this.mapDecisionReceiptAuditEvent(record)
      )
    } satisfies Omit<
      ReleaseReadinessApprovalDecisionReceipt,
      "receiptChecksumSha256"
    >;

    return {
      ...receiptPayload,
      receiptChecksumSha256: this.buildChecksum(
        receiptPayload as unknown as Prisma.JsonValue
      )
    };
  }

  async getApprovalLineage(
    approvalId: string
  ): Promise<ReleaseReadinessApprovalLineageResult> {
    const { currentApproval, lineage, integrity } =
      await this.resolveApprovalLineageData(approvalId);

    return {
      approval: currentApproval,
      lineage,
      currentMutationToken: currentApproval.updatedAt,
      integrity
    };
  }

  async getApprovalRecoveryTarget(
    approvalId: string
  ): Promise<ReleaseReadinessApprovalRecoveryTargetResult> {
    const { currentApproval, lineage, integrity } =
      await this.resolveApprovalLineageData(approvalId);
    const actionableApproval =
      integrity.actionableApprovalId
        ? lineage.find((item) => item.id === integrity.actionableApprovalId) ?? null
        : null;

    return {
      selectedApprovalId: currentApproval.id,
      actionableApproval,
      currentMutationToken: actionableApproval?.updatedAt ?? null,
      integrity
    };
  }

  private async resolveApprovalLineageData(approvalId: string): Promise<{
    currentApproval: ReleaseReadinessApprovalProjection;
    lineage: ReleaseReadinessApprovalProjection[];
    integrity: ReleaseReadinessApprovalLineageIntegrity;
  }> {
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    const { lineageRecords, issues } = await this.collectApprovalLineageRecords(
      this.prismaService,
      approval
    );

    const lineage = await this.hydrateApprovalProjections(lineageRecords);
    const currentApproval =
      lineage.find((item) => item.id === approval.id) ?? lineage[0];
    const integrity = this.buildApprovalLineageIntegrityFromRecords(
      lineageRecords,
      issues
    );

    return {
      currentApproval,
      lineage,
      integrity
    };
  }

  async listApprovals(
    query: ListReleaseReadinessApprovalsDto
  ): Promise<ReleaseReadinessApprovalList> {
    const limit = query.limit ?? 10;
    const where = this.buildApprovalWhere(query);

    const [approvals, totalCount] = await Promise.all([
      this.prismaService.releaseReadinessApproval.findMany({
        where,
        orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
        take: limit
      }),
      this.prismaService.releaseReadinessApproval.count({
        where
      })
    ]);

    return {
      approvals: await this.hydrateApprovalProjections(approvals, {
        includeLineageSummary: true
      }),
      limit,
      totalCount
    };
  }

  async listApprovalLineageIncidents(
    query: ListReleaseReadinessApprovalLineageIncidentsDto
  ): Promise<ReleaseReadinessApprovalLineageIncidentList> {
    const limit = query.limit ?? 10;
    const where = this.buildApprovalWhere(query);
    const approvals = await this.prismaService.releaseReadinessApproval.findMany({
      where,
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }]
    });
    const hydrated = await this.hydrateApprovalProjections(approvals, {
      includeLineageSummary: true
    });
    const incidents = hydrated.filter(
      (approval) =>
        approval.lineageSummary &&
        (approval.lineageSummary.status !== "healthy" ||
          !approval.lineageSummary.isActionable)
    );

    return {
      incidents: incidents.slice(0, limit),
      limit,
      totalCount: incidents.length
    };
  }

  private async hydrateApprovalProjections(
    approvals: ReleaseReadinessApprovalRecord[],
    options?: {
      includeLineageSummary?: boolean;
    }
  ): Promise<ReleaseReadinessApprovalProjection[]> {
    const pendingApprovalScopeKeys = [
      ...new Set(
        approvals
          .filter(
            (approval) =>
              approval.status === ReleaseReadinessApprovalStatus.pending_approval
          )
          .map(
            (approval) =>
              `${approval.releaseIdentifier}:${approval.environment}`
          )
      )
    ];
    const currentSummaries = new Map<string, ReleaseReadinessSummary>();
    const latestPacks = new Map<string, ReleaseLaunchClosurePackRecord | null>();
    const lineageSummaries = new Map<
      string,
      NonNullable<ReleaseReadinessApprovalProjection["lineageSummary"]>
    >();

    await Promise.all(
      pendingApprovalScopeKeys.map(async (scopeKey) => {
        const matchingApproval = approvals.find(
          (approval) =>
            approval.status === ReleaseReadinessApprovalStatus.pending_approval &&
            `${approval.releaseIdentifier}:${approval.environment}` === scopeKey
        );

        if (!matchingApproval) {
          return;
        }

        const [summary, latestPack] = await Promise.all([
          this.getSummary({
            releaseIdentifier: matchingApproval.releaseIdentifier,
            environment: matchingApproval.environment
          }),
          this.getLatestLaunchClosurePackForScope(
            matchingApproval.releaseIdentifier,
            matchingApproval.environment
          )
        ]);
        currentSummaries.set(scopeKey, summary);
        latestPacks.set(scopeKey, latestPack);
      })
    );

    if (options?.includeLineageSummary) {
      for (const approval of approvals) {
        if (lineageSummaries.has(approval.id)) {
          continue;
        }

        const { lineage, integrity } = await this.resolveApprovalLineageData(approval.id);
        const summary = {
          status: integrity.status,
          issueCount: integrity.issues.length,
          actionableApprovalId: integrity.actionableApprovalId,
          isActionable: integrity.actionableApprovalId === approval.id
        } as const;

        lineage.forEach((lineageApproval) => {
          lineageSummaries.set(lineageApproval.id, {
            status: integrity.status,
            issueCount: integrity.issues.length,
            actionableApprovalId: integrity.actionableApprovalId,
            isActionable: integrity.actionableApprovalId === lineageApproval.id
          });
        });

        if (!lineageSummaries.has(approval.id)) {
          lineageSummaries.set(approval.id, summary);
        }
      }
    }

    return approvals.map((record) =>
      this.mapApprovalProjection(
        record,
        record.status === ReleaseReadinessApprovalStatus.pending_approval
          ? currentSummaries.get(`${record.releaseIdentifier}:${record.environment}`)
          : undefined,
        record.status === ReleaseReadinessApprovalStatus.pending_approval
          ? latestPacks.get(`${record.releaseIdentifier}:${record.environment}`) ??
            null
          : null,
        lineageSummaries.get(record.id) ?? null
      )
    );
  }

}
