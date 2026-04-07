import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { ApiRequestMetricsService } from "../logging/api-request-metrics.service";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetOperationsMetricsDto } from "./dto/get-operations-metrics.dto";
import { GetOperationsStatusDto } from "./dto/get-operations-status.dto";
import { ListPlatformAlertsDto } from "./dto/list-platform-alerts.dto";
import { ListWorkerRuntimeHealthDto } from "./dto/list-worker-runtime-health.dto";
import { RouteCriticalPlatformAlertsDto } from "./dto/route-critical-platform-alerts.dto";
import { RoutePlatformAlertToReviewCaseDto } from "./dto/route-platform-alert-to-review-case.dto";
import { OperationsMonitoringService } from "./operations-monitoring.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("operations/internal")
export class OperationsMonitoringController {
  constructor(
    private readonly operationsMonitoringService: OperationsMonitoringService,
    private readonly apiRequestMetricsService: ApiRequestMetricsService
  ) {}

  @Get("status")
  async getOperationsStatus(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetOperationsStatusDto
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.getOperationsStatus(
      query
    );

    return {
      status: "success",
      message: "Operations status retrieved successfully.",
      data: result
    };
  }

  @Get("alerts")
  async listPlatformAlerts(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPlatformAlertsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.listPlatformAlerts(
      query
    );

    return {
      status: "success",
      message: "Platform alerts retrieved successfully.",
      data: result
    };
  }

  @Post("alerts/route-critical")
  async routeCriticalPlatformAlerts(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RouteCriticalPlatformAlertsDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.routeCriticalPlatformAlerts(
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message:
        result.routedAlerts.length > 0
          ? "Critical platform alerts routed successfully."
          : "No unrouted critical platform alerts required routing.",
      data: result
    };
  }

  @Post("alerts/:alertId/route-review-case")
  async routePlatformAlertToReviewCase(
    @Param("alertId") alertId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RoutePlatformAlertToReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.routePlatformAlertToReviewCase(
      alertId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.routingStateReused
        ? "Platform alert routing state reused successfully."
        : result.reviewCaseReused
          ? "Platform alert routed to an existing review case successfully."
          : "Platform alert routed to a review case successfully.",
      data: result
    };
  }

  @Get("workers/health")
  async listWorkerRuntimeHealth(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListWorkerRuntimeHealthDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.operationsMonitoringService.listWorkerRuntimeHealth(query);

    return {
      status: "success",
      message: "Worker runtime health retrieved successfully.",
      data: result
    };
  }

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getPrometheusMetrics(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetOperationsMetricsDto
  ): Promise<string> {
    return this.operationsMonitoringService.renderPrometheusMetrics(
      query,
      this.apiRequestMetricsService
    );
  }
}
