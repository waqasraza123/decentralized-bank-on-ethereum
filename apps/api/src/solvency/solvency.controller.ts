import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
  Body
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetSolvencyWorkspaceDto } from "./dto/get-solvency-workspace.dto";
import { ApproveSolvencyPolicyResumeRequestDto } from "./dto/approve-solvency-policy-resume-request.dto";
import { RejectSolvencyPolicyResumeRequestDto } from "./dto/reject-solvency-policy-resume-request.dto";
import { RequestSolvencyPolicyResumeDto } from "./dto/request-solvency-policy-resume.dto";
import { RecordSolvencyReportAnchorConfirmedDto } from "./dto/record-solvency-report-anchor-confirmed.dto";
import { RecordSolvencyReportAnchorFailedDto } from "./dto/record-solvency-report-anchor-failed.dto";
import { RecordSolvencyReportAnchorSubmittedDto } from "./dto/record-solvency-report-anchor-submitted.dto";
import { RequestSolvencyReportAnchorDto } from "./dto/request-solvency-report-anchor.dto";
import { SolvencyService } from "./solvency.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("solvency/internal")
export class SolvencyController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Get("workspace")
  async getWorkspace(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetSolvencyWorkspaceDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.getWorkspace(query.limit, {
      operatorId: request.internalOperator.operatorId,
      operatorRole: request.internalOperator.operatorRole ?? null
    });

    return {
      status: "success",
      message: "Solvency workspace retrieved successfully.",
      data: result
    };
  }

  @Get("snapshots/:snapshotId")
  async getSnapshotDetail(
    @Param("snapshotId") snapshotId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.getSnapshotDetail(snapshotId);

    return {
      status: "success",
      message: "Solvency snapshot detail retrieved successfully.",
      data: result
    };
  }

  @Post("snapshots/run")
  async runSnapshot(
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.generateSnapshot({
      actorType: "operator",
      actorId: request.internalOperator.operatorId
    });

    return {
      status: "success",
      message: "Solvency snapshot generated successfully.",
      data: result
    };
  }

  @Post("policy-resume-requests")
  async requestPolicyResume(
    @Body(new ValidationPipe()) dto: RequestSolvencyPolicyResumeDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.requestPolicyResume(
      dto.snapshotId,
      dto.expectedPolicyUpdatedAt,
      dto.requestNote,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Solvency policy resume requested successfully.",
      data: result
    };
  }

  @Post("policy-resume-requests/:requestId/approve")
  async approvePolicyResume(
    @Param("requestId") requestId: string,
    @Body(new ValidationPipe()) dto: ApproveSolvencyPolicyResumeRequestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.approvePolicyResume(
      requestId,
      dto.approvalNote,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Solvency policy resume approved successfully.",
      data: result
    };
  }

  @Post("policy-resume-requests/:requestId/reject")
  async rejectPolicyResume(
    @Param("requestId") requestId: string,
    @Body(new ValidationPipe()) dto: RejectSolvencyPolicyResumeRequestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.rejectPolicyResume(
      requestId,
      dto.rejectionNote,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Solvency policy resume rejected successfully.",
      data: result
    };
  }

  @Post("reports/:reportId/anchor-requests")
  async requestReportAnchor(
    @Param("reportId") reportId: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RequestSolvencyReportAnchorDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.requestReportAnchor(
      reportId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Solvency report anchor request already exists."
        : "Solvency report anchor requested successfully.",
      data: result
    };
  }

  @Post("report-anchors/:anchorId/record-submitted")
  async recordReportAnchorSubmitted(
    @Param("anchorId") anchorId: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordSolvencyReportAnchorSubmittedDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.recordReportAnchorSubmitted(
      anchorId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Solvency report anchor submission was already recorded."
        : "Solvency report anchor submission recorded successfully.",
      data: result
    };
  }

  @Post("report-anchors/:anchorId/record-confirmed")
  async recordReportAnchorConfirmed(
    @Param("anchorId") anchorId: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordSolvencyReportAnchorConfirmedDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.recordReportAnchorConfirmed(
      anchorId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Solvency report anchor confirmation was already recorded."
        : "Solvency report anchor confirmation recorded successfully.",
      data: result
    };
  }

  @Post("report-anchors/:anchorId/record-failed")
  async recordReportAnchorFailed(
    @Param("anchorId") anchorId: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordSolvencyReportAnchorFailedDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.recordReportAnchorFailed(
      anchorId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Solvency report anchor failure was already recorded."
        : "Solvency report anchor failure recorded successfully.",
      data: result
    };
  }
}
