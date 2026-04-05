import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerAccountOperationsController } from "./customer-account-operations.controller";
import { CustomerAccountOperationsService } from "./customer-account-operations.service";

@Module({
  controllers: [CustomerAccountOperationsController],
  providers: [
    CustomerAccountOperationsService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ],
  exports: [CustomerAccountOperationsService]
})
export class CustomerAccountOperationsModule {}
