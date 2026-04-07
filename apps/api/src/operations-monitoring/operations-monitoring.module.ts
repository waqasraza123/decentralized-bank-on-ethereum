import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { ApiRequestMetricsService } from "../logging/api-request-metrics.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { OperationsMonitoringController } from "./operations-monitoring.controller";
import { OperationsMonitoringService } from "./operations-monitoring.service";
import { OperationsMonitoringWorkerController } from "./operations-monitoring-worker.controller";

@Module({
  imports: [ReviewCasesModule],
  controllers: [
    OperationsMonitoringController,
    OperationsMonitoringWorkerController
  ],
  providers: [
    OperationsMonitoringService,
    ApiRequestMetricsService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [OperationsMonitoringService, ApiRequestMetricsService]
})
export class OperationsMonitoringModule {}
