import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { TreasuryController } from "./treasury.controller";
import { TreasuryService } from "./treasury.service";

@Module({
  controllers: [TreasuryController],
  providers: [TreasuryService, PrismaService, InternalOperatorApiKeyGuard],
  exports: [TreasuryService]
})
export class TreasuryModule {}
