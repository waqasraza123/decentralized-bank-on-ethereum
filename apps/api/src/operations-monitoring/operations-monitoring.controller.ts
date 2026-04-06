import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetOperationsStatusDto } from "./dto/get-operations-status.dto";
import { ListPlatformAlertsDto } from "./dto/list-platform-alerts.dto";
import { ListWorkerRuntimeHealthDto } from "./dto/list-worker-runtime-health.dto";
import { OperationsMonitoringService } from "./operations-monitoring.service";

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("operations/internal")
export class OperationsMonitoringController {
  constructor(
    private readonly operationsMonitoringService: OperationsMonitoringService
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
}
