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
import { InternalGovernedExecutorApiKeyGuard } from "../auth/guards/internal-governed-executor-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ClaimGovernedExecutorRequestDto } from "./dto/claim-governed-executor-request.dto";
import { ListGovernedExecutionRequestsDto } from "./dto/list-governed-execution-requests.dto";
import { RecordGovernedExecutorExecutionFailureDto } from "./dto/record-governed-executor-execution-failure.dto";
import { RecordGovernedExecutorExecutionSuccessDto } from "./dto/record-governed-executor-execution-success.dto";
import { GovernedExecutionService } from "./governed-execution.service";

type InternalGovernedExecutorRequest = {
  internalGovernedExecutor: {
    executorId: string;
  };
};

@UseGuards(InternalGovernedExecutorApiKeyGuard)
@Controller("governed-execution/internal/executor")
export class GovernedExecutionExecutorController {
  constructor(
    private readonly governedExecutionService: GovernedExecutionService
  ) {}

  @Get("execution-requests/ready")
  async listReadyExecutionRequests(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListGovernedExecutionRequestsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.governedExecutionService.listExecutorReadyExecutionRequests(
        query.limit
      );

    return {
      status: "success",
      message: "Governed executor-ready requests retrieved successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/claim")
  async claimExecutionRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ClaimGovernedExecutorRequestDto,
    @Request() request: InternalGovernedExecutorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.claimExecutionForExecutor(
      requestId,
      request.internalGovernedExecutor.executorId,
      dto.reclaimStaleAfterMs
    );

    return {
      status: "success",
      message: "Governed execution request claimed by executor successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/record-executed")
  async recordExecutionSuccess(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordGovernedExecutorExecutionSuccessDto,
    @Request() request: InternalGovernedExecutorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.governedExecutionService.recordExecutionSuccessFromExecutor(
        requestId,
        dto,
        request.internalGovernedExecutor.executorId
      );

    return {
      status: "success",
      message: "Governed executor success receipt recorded successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/record-failed")
  async recordExecutionFailure(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordGovernedExecutorExecutionFailureDto,
    @Request() request: InternalGovernedExecutorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.governedExecutionService.recordExecutionFailureFromExecutor(
        requestId,
        dto,
        request.internalGovernedExecutor.executorId
      );

    return {
      status: "success",
      message: "Governed executor failure receipt recorded successfully.",
      data: result
    };
  }
}
