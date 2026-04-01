import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionIntentsController } from "./transaction-intents.controller";
import { TransactionIntentsService } from "./transaction-intents.service";

@Module({
  controllers: [TransactionIntentsController],
  providers: [TransactionIntentsService, PrismaService]
})
export class TransactionIntentsModule {}
