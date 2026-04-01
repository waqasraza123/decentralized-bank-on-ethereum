import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CreateDepositIntentDto } from "./dto/create-deposit-intent.dto";
import { ListMyTransactionIntentsDto } from "./dto/list-my-transaction-intents.dto";
import { TransactionIntentsService } from "./transaction-intents.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("transaction-intents")
export class TransactionIntentsController {
  constructor(
    private readonly transactionIntentsService: TransactionIntentsService
  ) {}

  @Post("deposit-requests")
  async createDepositIntent(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateDepositIntentDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionIntentsService.createDepositIntent(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.idempotencyReused
        ? "Deposit request reused successfully."
        : "Deposit request created successfully.",
      data: result
    };
  }

  @Get("me")
  async listMyTransactionIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListMyTransactionIntentsDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionIntentsService.listMyTransactionIntents(
      request.user.id,
      query
    );

    return {
      status: "success",
      message: "Transaction intents retrieved successfully.",
      data: result
    };
  }
}
