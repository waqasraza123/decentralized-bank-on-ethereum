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
import { DecideWithdrawalIntentDto } from "./dto/decide-withdrawal-intent.dto";
import { ListApprovedWithdrawalIntentsDto } from "./dto/list-approved-withdrawal-intents.dto";
import { ListPendingWithdrawalIntentsDto } from "./dto/list-pending-withdrawal-intents.dto";
import { QueueApprovedWithdrawalIntentDto } from "./dto/queue-approved-withdrawal-intent.dto";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("transaction-intents/internal")
export class WithdrawalIntentsInternalController {
  constructor(
    private readonly withdrawalIntentsService: WithdrawalIntentsService
  ) {}

  @Get("withdrawal-requests/pending")
  async listPendingWithdrawalIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPendingWithdrawalIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.listPendingWithdrawalIntents(query);

    return {
      status: "success",
      message: "Pending withdrawal requests retrieved successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/decision")
  async decideWithdrawalIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DecideWithdrawalIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.withdrawalIntentsService.decideWithdrawalIntent(
      intentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message:
        dto.decision === "approved"
          ? "Withdrawal request approved successfully."
          : "Withdrawal request denied successfully.",
      data: result
    };
  }

  @Get("withdrawal-requests/approved")
  async listApprovedWithdrawalIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListApprovedWithdrawalIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.listApprovedWithdrawalIntents(query);

    return {
      status: "success",
      message: "Approved withdrawal requests retrieved successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/queue")
  async queueApprovedWithdrawalIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: QueueApprovedWithdrawalIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.queueApprovedWithdrawalIntent(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.queueReused
        ? "Withdrawal request queue state reused successfully."
        : "Withdrawal request queued successfully.",
      data: result
    };
  }
}
