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
import { ListInternalRetirementVaultReleaseRequestsDto } from "./dto/list-internal-retirement-vault-release-requests.dto";
import { RetirementVaultOperatorNoteDto } from "./dto/retirement-vault-operator-note.dto";
import { RetirementVaultService } from "./retirement-vault.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("retirement-vault/internal")
export class RetirementVaultInternalController {
  constructor(private readonly retirementVaultService: RetirementVaultService) {}

  @Get("release-requests")
  async listReleaseRequests(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListInternalRetirementVaultReleaseRequestsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.listInternalReleaseRequests(
      query
    );

    return {
      status: "success",
      message: "Retirement vault release requests retrieved successfully.",
      data: result,
    };
  }

  @Get("release-requests/:releaseRequestId")
  async getReleaseRequestWorkspace(
    @Param("releaseRequestId") releaseRequestId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.getInternalReleaseRequestWorkspace(
      releaseRequestId
    );

    return {
      status: "success",
      message: "Retirement vault release workspace retrieved successfully.",
      data: result,
    };
  }

  @Post("release-requests/:releaseRequestId/approve")
  async approveReleaseRequest(
    @Param("releaseRequestId") releaseRequestId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RetirementVaultOperatorNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.approveInternalReleaseRequest(
      releaseRequestId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto.note
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault release approval state reused successfully."
        : "Retirement vault release request approved successfully.",
      data: result,
    };
  }

  @Post("release-requests/:releaseRequestId/reject")
  async rejectReleaseRequest(
    @Param("releaseRequestId") releaseRequestId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RetirementVaultOperatorNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.rejectInternalReleaseRequest(
      releaseRequestId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto.note
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault release rejection state reused successfully."
        : "Retirement vault release request rejected successfully.",
      data: result,
    };
  }
}
