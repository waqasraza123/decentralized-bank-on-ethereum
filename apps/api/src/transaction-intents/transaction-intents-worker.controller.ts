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
import { FailDepositIntentExecutionDto } from "./dto/fail-deposit-intent-execution.dto";
import { ListQueuedDepositIntentsDto } from "./dto/list-queued-deposit-intents.dto";
import { RecordDepositBroadcastDto } from "./dto/record-deposit-broadcast.dto";
import { TransactionIntentsService } from "./transaction-intents.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("transaction-intents/internal/worker")
export class TransactionIntentsWorkerController {
  constructor(
    private readonly transactionIntentsService: TransactionIntentsService
  ) {}

  @Get("deposit-requests/queued")
  async listQueuedDepositIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListQueuedDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.listQueuedDepositIntents(query);

    return {
      status: "success",
      message: "Queued deposit requests retrieved successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/broadcast")
  async recordDepositBroadcast(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordDepositBroadcastDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionIntentsService.recordDepositBroadcast(
      intentId,
      request.internalWorker.workerId,
      dto
    );

    return {
      status: "success",
      message: result.broadcastReused
        ? "Deposit broadcast state reused successfully."
        : "Deposit broadcast recorded successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/fail")
  async failDepositIntentExecution(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: FailDepositIntentExecutionDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.failDepositIntentExecution(
        intentId,
        request.internalWorker.workerId,
        dto
      );

    return {
      status: "success",
      message: result.failureReused
        ? "Deposit execution failure state reused successfully."
        : "Deposit execution failure recorded successfully.",
      data: result
    };
  }
}
