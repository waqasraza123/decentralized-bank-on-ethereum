import { Module } from "@nestjs/common";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { PrismaService } from "../prisma/prisma.service";
import { ClientObservabilityController } from "./client-observability.controller";
import { ClientObservabilityService } from "./client-observability.service";

@Module({
  controllers: [ClientObservabilityController],
  providers: [
    ClientObservabilityService,
    PlatformAlertDeliveryService,
    PrismaService
  ]
})
export class ClientObservabilityModule {}
