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
import { ListWithdrawalSettlementReconciliationDto } from "./dto/list-withdrawal-settlement-reconciliation.dto";
import { ReplayWithdrawalSettlementStepDto } from "./dto/replay-withdrawal-settlement-step.dto";
import { WithdrawalSettlementReconciliationService } from "./withdrawal-settlement-reconciliation.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("transaction-intents/internal/reconciliation")
export class WithdrawalSettlementReconciliationController {
  constructor(
    private readonly withdrawalSettlementReconciliationService: WithdrawalSettlementReconciliationService
  ) {}

  @Get("withdrawal-settlements")
  async listWithdrawalSettlementReconciliation(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListWithdrawalSettlementReconciliationDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalSettlementReconciliationService.listWithdrawalSettlementReconciliation(
        query
      );

    return {
      status: "success",
      message: "Withdrawal settlement reconciliation retrieved successfully.",
      data: result
    };
  }

  @Post("withdrawal-settlements/:intentId/replay-confirm")
  async replayConfirm(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReplayWithdrawalSettlementStepDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalSettlementReconciliationService.replayConfirm(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.confirmReused
        ? "Withdrawal confirm replay reused successfully."
        : "Withdrawal confirm replay completed successfully.",
      data: result
    };
  }

  @Post("withdrawal-settlements/:intentId/replay-settle")
  async replaySettle(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReplayWithdrawalSettlementStepDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalSettlementReconciliationService.replaySettle(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.settlementReused
        ? "Withdrawal settle replay reused successfully."
        : "Withdrawal settle replay completed successfully.",
      data: result
    };
  }
}
