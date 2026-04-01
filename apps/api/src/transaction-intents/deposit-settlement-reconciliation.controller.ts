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
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { DepositSettlementReconciliationService } from "./deposit-settlement-reconciliation.service";
import { ListDepositSettlementReconciliationDto } from "./dto/list-deposit-settlement-reconciliation.dto";
import { ReplayDepositSettlementStepDto } from "./dto/replay-deposit-settlement-step.dto";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
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
    @Query(new ValidationPipe({ transform: true }))
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

  @Post("deposit-settlements/:intentId/replay-confirm")
  async replayConfirm(
    @Param("intentId") intentId: string,
    @Body(new ValidationPipe()) dto: ReplayDepositSettlementStepDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.depositSettlementReconciliationService.replayConfirm(
      intentId,
      request.internalOperator.operatorId,
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
    @Body(new ValidationPipe()) dto: ReplayDepositSettlementStepDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.depositSettlementReconciliationService.replaySettle(
      intentId,
      request.internalOperator.operatorId,
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
}
