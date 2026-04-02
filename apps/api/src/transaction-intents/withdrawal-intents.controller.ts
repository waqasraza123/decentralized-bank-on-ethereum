import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CreateWithdrawalIntentDto } from "./dto/create-withdrawal-intent.dto";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("transaction-intents")
export class WithdrawalIntentsController {
  constructor(
    private readonly withdrawalIntentsService: WithdrawalIntentsService
  ) {}

  @Post("withdrawal-requests")
  async createWithdrawalIntent(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateWithdrawalIntentDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.withdrawalIntentsService.createWithdrawalIntent(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.idempotencyReused
        ? "Withdrawal request reused successfully."
        : "Withdrawal request created successfully.",
      data: result
    };
  }
}
