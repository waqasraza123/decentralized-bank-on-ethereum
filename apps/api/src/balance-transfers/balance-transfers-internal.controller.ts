import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { BalanceTransfersService } from "./balance-transfers.service";
import { DecideBalanceTransferDto } from "./dto/decide-balance-transfer.dto";
import { ListPendingBalanceTransfersDto } from "./dto/list-pending-balance-transfers.dto";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("balance-transfers/internal")
export class BalanceTransfersInternalController {
  constructor(
    private readonly balanceTransfersService: BalanceTransfersService
  ) {}

  @Get("pending")
  async listPendingTransfers(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    query: ListPendingBalanceTransfersDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.balanceTransfersService.listPendingBalanceTransfers(query);

    return {
      status: "success",
      message: "Pending internal balance transfers retrieved successfully.",
      data: result,
    };
  }

  @Post(":intentId/decision")
  async decideTransfer(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    dto: DecideBalanceTransferDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.balanceTransfersService.decideBalanceTransfer(
      intentId,
      request.internalOperator.operatorId,
      dto,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message:
        dto.decision === "approved"
          ? "Internal balance transfer approved successfully."
          : "Internal balance transfer denied successfully.",
      data: result,
    };
  }
}
