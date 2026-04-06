import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { OperationsMonitoringController } from "./operations-monitoring.controller";
import { OperationsMonitoringService } from "./operations-monitoring.service";
import { OperationsMonitoringWorkerController } from "./operations-monitoring-worker.controller";

@Module({
  controllers: [
    OperationsMonitoringController,
    OperationsMonitoringWorkerController
  ],
  providers: [
    OperationsMonitoringService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [OperationsMonitoringService]
})
export class OperationsMonitoringModule {}
