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
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { OpenReconciliationReviewCaseDto } from "../review-cases/dto/open-reconciliation-review-case.dto";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { DepositSettlementReconciliationService } from "./deposit-settlement-reconciliation.service";
import { ListDepositSettlementReconciliationDto } from "./dto/list-deposit-settlement-reconciliation.dto";
import { ReplayDepositSettlementStepDto } from "./dto/replay-deposit-settlement-step.dto";
import { RequestDepositSettlementReplayApprovalDto } from "./dto/request-deposit-settlement-replay-approval.dto";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string | null;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("transaction-intents/internal/reconciliation")
export class DepositSettlementReconciliationController {
  constructor(
    private readonly depositSettlementReconciliationService: DepositSettlementReconciliationService
  ) {}

  @Get("deposit-settlements")
  async listDepositSettlementReconciliation(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListDepositSettlementReconciliationDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.depositSettlementReconciliationService.listDepositSettlementReconciliation(
        query
      );

    return {
      status: "success",
      message: "Deposit settlement reconciliation retrieved successfully.",
      data: result
    };
  }

  @Post("deposit-settlements/:intentId/request-replay-approval")
  async requestReplayApproval(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RequestDepositSettlementReplayApprovalDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.depositSettlementReconciliationService.requestReplayApproval(
        intentId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole ?? null,
        dto
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Deposit replay approval request reused successfully."
        : "Deposit replay approval request created successfully.",
      data: result
    };
  }

  @Post("deposit-settlements/:intentId/replay-confirm")
  async replayConfirm(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReplayDepositSettlementStepDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.depositSettlementReconciliationService.replayConfirm(
      intentId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto
    );

    return {
      status: "success",
      message: result.confirmReused
        ? "Deposit confirm replay reused successfully."
        : "Deposit confirm replay completed successfully.",
      data: result
    };
  }

  @Post("deposit-settlements/:intentId/replay-settle")
  async replaySettle(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReplayDepositSettlementStepDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.depositSettlementReconciliationService.replaySettle(
      intentId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto
    );

    return {
      status: "success",
      message: result.settlementReused
        ? "Deposit settle replay reused successfully."
        : "Deposit settle replay completed successfully.",
      data: result
    };
  }

  @Post("deposit-settlements/:intentId/open-review-case")
  async openManualReviewCase(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: OpenReconciliationReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.depositSettlementReconciliationService.openManualReviewCase(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.reviewCaseReused
        ? "Deposit reconciliation review case reused successfully."
        : "Deposit reconciliation review case opened successfully.",
      data: result
    };
  }
}
