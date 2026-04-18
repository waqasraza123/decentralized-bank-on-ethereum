import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { GovernedExecutionController } from "./governed-execution.controller";
import { GovernedExecutionService } from "./governed-execution.service";
import { GovernedExecutionWorkerController } from "./governed-execution-worker.controller";

@Module({
  controllers: [GovernedExecutionController, GovernedExecutionWorkerController],
  providers: [
    GovernedExecutionService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [GovernedExecutionService]
})
export class GovernedExecutionModule {}
