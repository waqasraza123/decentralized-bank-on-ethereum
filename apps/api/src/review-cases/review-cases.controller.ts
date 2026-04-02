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
import { DismissReviewCaseDto } from "./dto/dismiss-review-case.dto";
import { ListReviewCasesDto } from "./dto/list-review-cases.dto";
import { OpenDeniedWithdrawalReviewCaseDto } from "./dto/open-denied-withdrawal-review-case.dto";
import { ResolveReviewCaseDto } from "./dto/resolve-review-case.dto";
import { ReviewCasesService } from "./review-cases.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("review-cases/internal")
export class ReviewCasesController {
  constructor(private readonly reviewCasesService: ReviewCasesService) {}

  @Get()
  async listReviewCases(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReviewCasesDto
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.listReviewCases(query);

    return {
      status: "success",
      message: "Review cases retrieved successfully.",
      data: result
    };
  }

  @Post("withdrawal-intents/:intentId/open")
  async openDeniedWithdrawalReviewCase(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: OpenDeniedWithdrawalReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.openDeniedWithdrawalReviewCase(
      intentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.reviewCaseReused
        ? "Withdrawal review case reused successfully."
        : "Withdrawal review case opened successfully.",
      data: result
    };
  }

  @Get(":reviewCaseId")
  async getReviewCase(
    @Param("reviewCaseId") reviewCaseId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.getReviewCase(reviewCaseId);

    return {
      status: "success",
      message: "Review case retrieved successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/resolve")
  async resolveReviewCase(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ResolveReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.resolveReviewCase(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.statusReused
        ? "Review case resolve state reused successfully."
        : "Review case resolved successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/dismiss")
  async dismissReviewCase(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DismissReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.dismissReviewCase(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.statusReused
        ? "Review case dismiss state reused successfully."
        : "Review case dismissed successfully.",
      data: result
    };
  }
}
