import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerModule } from "../ledger/ledger.module";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { BalanceTransferEmailDeliveryService } from "./balance-transfer-email-delivery.service";
import { BalanceTransfersController } from "./balance-transfers.controller";
import { BalanceTransfersInternalController } from "./balance-transfers-internal.controller";
import { BalanceTransfersService } from "./balance-transfers.service";

@Module({
  imports: [LedgerModule],
  controllers: [BalanceTransfersController, BalanceTransfersInternalController],
  providers: [
    BalanceTransfersService,
    BalanceTransferEmailDeliveryService,
    PrismaService,
    PlatformAlertDeliveryService,
  ],
  exports: [BalanceTransfersService],
})
export class BalanceTransfersModule {}
