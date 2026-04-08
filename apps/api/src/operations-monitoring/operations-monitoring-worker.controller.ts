import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ReEscalateCriticalPlatformAlertsDto } from "./dto/re-escalate-critical-platform-alerts.dto";
import { ReportWorkerRuntimeHeartbeatDto } from "./dto/report-worker-runtime-heartbeat.dto";
import { OperationsMonitoringService } from "./operations-monitoring.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("operations/internal/worker")
export class OperationsMonitoringWorkerController {
  constructor(
    private readonly operationsMonitoringService: OperationsMonitoringService
  ) {}

  @Post("heartbeat")
  async reportHeartbeat(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReportWorkerRuntimeHeartbeatDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.operationsMonitoringService.reportWorkerRuntimeHeartbeat(
        request.internalWorker.workerId,
        dto
      );

    return {
      status: "success",
      message: "Worker heartbeat recorded successfully.",
      data: result
    };
  }

  @Post("alerts/re-escalate-critical")
  async reEscalateCriticalPlatformAlerts(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReEscalateCriticalPlatformAlertsDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.operationsMonitoringService.reEscalateCriticalPlatformAlertsFromWorker(
        request.internalWorker.workerId,
        dto
      );

    return {
      status: "success",
      message:
        result.reEscalatedAlertCount > 0
          ? "Overdue critical platform alerts re-escalated successfully."
          : "No overdue critical platform alerts required re-escalation.",
      data: result
    };
  }
}
