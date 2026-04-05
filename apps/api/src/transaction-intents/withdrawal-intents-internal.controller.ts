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
import { ConfirmWithdrawalIntentDto } from "./dto/confirm-withdrawal-intent.dto";
import { DecideWithdrawalIntentDto } from "./dto/decide-withdrawal-intent.dto";
import { FailWithdrawalIntentExecutionDto } from "./dto/fail-withdrawal-intent-execution.dto";
import { ListApprovedWithdrawalIntentsDto } from "./dto/list-approved-withdrawal-intents.dto";
import { ListBroadcastWithdrawalIntentsDto } from "./dto/list-broadcast-withdrawal-intents.dto";
import { ListPendingWithdrawalIntentsDto } from "./dto/list-pending-withdrawal-intents.dto";
import { ListQueuedWithdrawalIntentsDto } from "./dto/list-queued-withdrawal-intents.dto";
import { QueueApprovedWithdrawalIntentDto } from "./dto/queue-approved-withdrawal-intent.dto";
import { RecordWithdrawalBroadcastDto } from "./dto/record-withdrawal-broadcast.dto";
import { SettleConfirmedWithdrawalIntentDto } from "./dto/settle-confirmed-withdrawal-intent.dto";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
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

  @Get("withdrawal-requests/queued")
  async listQueuedWithdrawalIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListQueuedWithdrawalIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.listQueuedWithdrawalIntents(query);

    return {
      status: "success",
      message: "Queued withdrawal custody operations retrieved successfully.",
      data: result
    };
  }

  @Get("withdrawal-requests/broadcast")
  async listBroadcastWithdrawalIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListBroadcastWithdrawalIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.listBroadcastWithdrawalIntents(query);

    return {
      status: "success",
      message: "Broadcast withdrawal custody operations retrieved successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/broadcast")
  async recordWithdrawalBroadcast(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordWithdrawalBroadcastDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.recordWithdrawalBroadcastByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.broadcastReused
        ? "Withdrawal custody broadcast state reused successfully."
        : "Withdrawal custody broadcast recorded successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/fail")
  async failWithdrawalIntentExecution(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: FailWithdrawalIntentExecutionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.failWithdrawalIntentExecutionByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.failureReused
        ? "Withdrawal custody failure state reused successfully."
        : "Withdrawal custody failure recorded successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/confirm")
  async confirmWithdrawalIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ConfirmWithdrawalIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.confirmWithdrawalIntentByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.confirmReused
        ? "Withdrawal custody confirm state reused successfully."
        : "Withdrawal custody confirmation recorded successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/settle")
  async settleConfirmedWithdrawalIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: SettleConfirmedWithdrawalIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.settleConfirmedWithdrawalIntentByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.settlementReused
        ? "Withdrawal custody settlement state reused successfully."
        : "Withdrawal custody settlement recorded successfully.",
      data: result
    };
  }
}
