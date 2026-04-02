import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesController } from "./review-cases.controller";
import { ReviewCasesService } from "./review-cases.service";

@Module({
  controllers: [ReviewCasesController],
  providers: [ReviewCasesService, PrismaService, InternalOperatorApiKeyGuard],
  exports: [ReviewCasesService]
})
export class ReviewCasesModule {}
