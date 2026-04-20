import { Module } from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { LedgerModule } from "../ledger/ledger.module";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { RetirementVaultController } from "./retirement-vault.controller";
import { RetirementVaultInternalController } from "./retirement-vault-internal.controller";
import { RetirementVaultService } from "./retirement-vault.service";
import { RetirementVaultWorkerController } from "./retirement-vault-worker.controller";

@Module({
  imports: [LedgerModule, ReviewCasesModule],
  controllers: [
    RetirementVaultController,
    RetirementVaultInternalController,
    RetirementVaultWorkerController
  ],
  providers: [
    RetirementVaultService,
    PrismaService,
    InternalOperatorBearerGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [RetirementVaultService]
})
export class RetirementVaultModule {}
