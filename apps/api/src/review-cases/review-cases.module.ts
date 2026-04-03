import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ManualResolutionReportingController } from "./manual-resolution-reporting.controller";
import { ManualResolutionReportingService } from "./manual-resolution-reporting.service";
import { ReviewCasesController } from "./review-cases.controller";
import { ReviewCasesService } from "./review-cases.service";

@Module({
  controllers: [ReviewCasesController, ManualResolutionReportingController],
  providers: [
    ReviewCasesService,
    ManualResolutionReportingService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ],
  exports: [ReviewCasesService]
})
export class ReviewCasesModule {}
