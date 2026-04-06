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
}
