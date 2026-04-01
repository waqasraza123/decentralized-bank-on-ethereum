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
import { DecideDepositIntentDto } from "./dto/decide-deposit-intent.dto";
import { ListApprovedDepositIntentsDto } from "./dto/list-approved-deposit-intents.dto";
import { ListPendingDepositIntentsDto } from "./dto/list-pending-deposit-intents.dto";
import { QueueApprovedDepositIntentDto } from "./dto/queue-approved-deposit-intent.dto";
import { TransactionIntentsService } from "./transaction-intents.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("transaction-intents/internal")
export class TransactionIntentsInternalController {
  constructor(
    private readonly transactionIntentsService: TransactionIntentsService
  ) {}

  @Get("deposit-requests/pending")
  async listPendingDepositIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPendingDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.listPendingDepositIntents(query);

    return {
      status: "success",
      message: "Pending deposit requests retrieved successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/decision")
  async decideDepositIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DecideDepositIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionIntentsService.decideDepositIntent(
      intentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message:
        dto.decision === "approved"
          ? "Deposit request approved successfully."
          : "Deposit request denied successfully.",
      data: result
    };
  }

  @Get("deposit-requests/approved")
  async listApprovedDepositIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListApprovedDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.listApprovedDepositIntents(query);

    return {
      status: "success",
      message: "Approved deposit requests retrieved successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/queue")
  async queueApprovedDepositIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: QueueApprovedDepositIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.queueApprovedDepositIntent(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.queueReused
        ? "Deposit request queue state reused successfully."
        : "Deposit request queued successfully.",
      data: result
    };
  }
}
