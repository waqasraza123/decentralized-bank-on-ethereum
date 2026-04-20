import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { PrismaService } from "../prisma/prisma.service";
import { RetirementVaultController } from "./retirement-vault.controller";
import { RetirementVaultService } from "./retirement-vault.service";

@Module({
  imports: [LedgerModule],
  controllers: [RetirementVaultController],
  providers: [RetirementVaultService, PrismaService],
  exports: [RetirementVaultService]
})
export class RetirementVaultModule {}
