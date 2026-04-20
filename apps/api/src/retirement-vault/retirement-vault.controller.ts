import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CreateRetirementVaultDto } from "./dto/create-retirement-vault.dto";
import { FundRetirementVaultDto } from "./dto/fund-retirement-vault.dto";
import { RetirementVaultService } from "./retirement-vault.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("retirement-vault")
export class RetirementVaultController {
  constructor(private readonly retirementVaultService: RetirementVaultService) {}

  @Get("me")
  async listMyRetirementVaults(
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.listMyRetirementVaults(
      request.user.id
    );

    return {
      status: "success",
      message: "Retirement vault snapshot retrieved successfully.",
      data: result
    };
  }

  @Post("me")
  async createMyRetirementVault(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateRetirementVaultDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.createMyRetirementVault(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.created
        ? "Retirement vault created successfully."
        : "Retirement vault already exists for this asset.",
      data: result
    };
  }

  @Post("me/funding-requests")
  async fundMyRetirementVault(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: FundRetirementVaultDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.fundMyRetirementVault(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.idempotencyReused
        ? "Retirement vault funding request reused successfully."
        : "Retirement vault funded successfully.",
      data: result
    };
  }
}
