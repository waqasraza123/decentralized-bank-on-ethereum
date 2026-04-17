import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CreateReleaseReadinessApprovalDto } from "./dto/create-release-readiness-approval.dto";
import { CreateReleaseReadinessEvidenceDto } from "./dto/create-release-readiness-evidence.dto";
import { GetReleaseReadinessSummaryDto } from "./dto/get-release-readiness-summary.dto";
import {
  GetLaunchClosureStatusDto,
  LaunchClosureManifestDto
} from "./dto/launch-closure.dto";
import { ListReleaseReadinessApprovalsDto } from "./dto/list-release-readiness-approvals.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";
import {
  ApproveReleaseReadinessApprovalDto,
  RejectReleaseReadinessApprovalDto
} from "./dto/release-readiness-approval.dto";
import {
  previewLaunchClosurePack,
  renderLaunchClosureValidationSummary,
  validateLaunchClosureManifest as validateLaunchClosureManifestPayload
} from "./launch-closure-pack";
import { ReleaseReadinessService } from "./release-readiness.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("release-readiness/internal")
export class ReleaseReadinessController {
  constructor(
    private readonly releaseReadinessService: ReleaseReadinessService
  ) {}

  @Get("summary")
  async getSummary(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetReleaseReadinessSummaryDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getSummary(query, {
      operatorId: request.internalOperator.operatorId,
      operatorRole: request.internalOperator.operatorRole
    });

    return {
      status: "success",
      message: "Release readiness summary retrieved successfully.",
      data: result
    };
  }

  @Get("evidence")
  async listEvidence(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleaseReadinessEvidenceDto
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.listEvidence(query);

    return {
      status: "success",
      message: "Release readiness evidence retrieved successfully.",
      data: result
    };
  }

  @Get("evidence/:evidenceId")
  async getEvidence(
    @Param("evidenceId") evidenceId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getEvidence(evidenceId);

    return {
      status: "success",
      message: "Release readiness evidence retrieved successfully.",
      data: result
    };
  }

  @Post("evidence")
  async recordEvidence(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateReleaseReadinessEvidenceDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.recordEvidence(
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness evidence recorded successfully.",
      data: result
    };
  }

  @Get("approvals")
  async listApprovals(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleaseReadinessApprovalsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.listApprovals(query);

    return {
      status: "success",
      message: "Release readiness approvals retrieved successfully.",
      data: result
    };
  }

  @Get("approvals/:approvalId")
  async getApproval(
    @Param("approvalId") approvalId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getApproval(approvalId);

    return {
      status: "success",
      message: "Release readiness approval retrieved successfully.",
      data: result
    };
  }

  @Post("approvals")
  async requestApproval(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateReleaseReadinessApprovalDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.requestApproval(
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness approval requested successfully.",
      data: result
    };
  }

  @Post("approvals/:approvalId/approve")
  async approveApproval(
    @Param("approvalId") approvalId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ApproveReleaseReadinessApprovalDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.approveApproval(
      approvalId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness approval completed successfully.",
      data: result
    };
  }

  @Post("approvals/:approvalId/reject")
  async rejectApproval(
    @Param("approvalId") approvalId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RejectReleaseReadinessApprovalDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.rejectApproval(
      approvalId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness approval rejected successfully.",
      data: result
    };
  }

  @Get("launch-closure/status")
  async getLaunchClosureStatus(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetLaunchClosureStatusDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getLaunchClosureStatus(
      query,
      {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole
      }
    );

    return {
      status: "success",
      message: "Launch-closure status retrieved successfully.",
      data: result
    };
  }

  @Post("launch-closure/validate")
  validateLaunchClosureManifest(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: LaunchClosureManifestDto
  ): CustomJsonResponse {
    const validation = validateLaunchClosureManifestPayload(dto.manifest);

    return {
      status: "success",
      message: "Launch-closure manifest validated successfully.",
      data: {
        validation,
        summaryMarkdown: renderLaunchClosureValidationSummary(dto.manifest)
      }
    };
  }

  @Post("launch-closure/scaffold")
  async scaffoldLaunchClosurePack(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: LaunchClosureManifestDto
  ): Promise<CustomJsonResponse> {
    const validation = validateLaunchClosureManifestPayload(dto.manifest);

    if (validation.errors.length > 0) {
      throw new BadRequestException(validation.errors.join(" "));
    }

    const statusSnapshot =
      await this.releaseReadinessService.getLaunchClosureStatus({
        releaseIdentifier: dto.manifest.releaseIdentifier,
        environment: dto.manifest.environment
      });
    const preview = previewLaunchClosurePack(dto.manifest, {
      generatedAt: statusSnapshot.generatedAt,
      releaseIdentifier: statusSnapshot.releaseIdentifier,
      environment: dto.manifest.environment,
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

    return {
      status: "success",
      message: "Launch-closure pack generated successfully.",
      data: {
        validation,
        summaryMarkdown: renderLaunchClosureValidationSummary(dto.manifest),
        outputSubpath: preview.outputSubpath,
        files: preview.files
      }
    };
  }
}
