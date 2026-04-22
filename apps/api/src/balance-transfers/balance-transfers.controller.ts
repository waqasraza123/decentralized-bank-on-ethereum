import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { BalanceTransfersService } from "./balance-transfers.service";
import { CreateBalanceTransferDto } from "./dto/create-balance-transfer.dto";
import { PreviewBalanceTransferRecipientDto } from "./dto/preview-balance-transfer-recipient.dto";

type AuthenticatedRequest = {
  user: {
    id: string;
    sessionId?: string | null;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("balance-transfers")
export class BalanceTransfersController {
  constructor(
    private readonly authService: AuthService,
    private readonly balanceTransfersService: BalanceTransfersService
  ) {}

  @Post("me/recipient-preview")
  async previewRecipient(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    dto: PreviewBalanceTransferRecipientDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    await this.authService.assertCustomerMoneyMovementEnabled(
      request.user.id,
      request.user.sessionId ?? null
    );

    const result = await this.balanceTransfersService.previewRecipient(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.available
        ? "Recipient preview resolved successfully."
        : "Recipient is unavailable for internal balance transfers.",
      data: result,
    };
  }

  @Post("me")
  async createBalanceTransfer(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    dto: CreateBalanceTransferDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    await this.authService.assertCustomerMoneyMovementEnabled(
      request.user.id,
      request.user.sessionId ?? null
    );
    await this.authService.assertCustomerStepUpFresh(
      request.user.id,
      request.user.sessionId ?? null
    );

    const result = await this.balanceTransfersService.createBalanceTransfer(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.idempotencyReused
        ? "Internal balance transfer reused successfully."
        : result.thresholdOutcome === "review_required"
          ? "Internal balance transfer created and queued for operator review."
          : "Internal balance transfer settled successfully.",
      data: result,
    };
  }
}
