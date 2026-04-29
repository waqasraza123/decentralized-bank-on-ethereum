import {
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
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ListSolvencyReportAnchorsDto } from "./dto/list-solvency-report-anchors.dto";
import { RecordSolvencyReportAnchorConfirmedDto } from "./dto/record-solvency-report-anchor-confirmed.dto";
import { RecordSolvencyReportAnchorFailedDto } from "./dto/record-solvency-report-anchor-failed.dto";
import { RecordSolvencyReportAnchorSubmittedDto } from "./dto/record-solvency-report-anchor-submitted.dto";
import { SolvencyService } from "./solvency.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("solvency/internal/worker")
export class SolvencyWorkerController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Get("report-anchors/requested")
  async listRequestedReportAnchors(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListSolvencyReportAnchorsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.listRequestedReportAnchorsForWorker(
      query.limit
    );

    return {
      status: "success",
      message: "Requested solvency report anchors retrieved successfully.",
      data: result
    };
  }

  @Get("report-anchors/submitted")
  async listSubmittedReportAnchors(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListSolvencyReportAnchorsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.listSubmittedReportAnchorsForWorker(
      query.limit
    );

    return {
      status: "success",
      message: "Submitted solvency report anchors retrieved successfully.",
      data: result
    };
  }

  @Post("snapshots/run")
  async runSnapshot(
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.generateSnapshot({
      actorType: "worker",
      actorId: request.internalWorker.workerId
    });

    return {
      status: "success",
      message: "Worker-triggered solvency snapshot generated successfully.",
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
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.recordReportAnchorSubmittedByWorker(
      anchorId,
      dto,
      request.internalWorker.workerId
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
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.recordReportAnchorConfirmedByWorker(
      anchorId,
      dto,
      request.internalWorker.workerId
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
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.recordReportAnchorFailedByWorker(
      anchorId,
      dto,
      request.internalWorker.workerId
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
