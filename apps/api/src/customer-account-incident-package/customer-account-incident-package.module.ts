import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomerAccountOperationsModule } from "../customer-account-operations/customer-account-operations.module";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerAccountIncidentPackageController } from "./customer-account-incident-package.controller";
import { CustomerAccountIncidentPackageExportGovernanceController } from "./customer-account-incident-package-export-governance.controller";
import { CustomerAccountIncidentPackageExportGovernanceService } from "./customer-account-incident-package-export-governance.service";
import { CustomerAccountIncidentPackageService } from "./customer-account-incident-package.service";

@Module({
  imports: [CustomerAccountOperationsModule],
  controllers: [
    CustomerAccountIncidentPackageController,
    CustomerAccountIncidentPackageExportGovernanceController
  ],
  providers: [
    CustomerAccountIncidentPackageService,
    CustomerAccountIncidentPackageExportGovernanceService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ]
})
export class CustomerAccountIncidentPackageModule {}
