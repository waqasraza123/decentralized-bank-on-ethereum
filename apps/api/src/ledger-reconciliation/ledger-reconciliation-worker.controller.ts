import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ScanLedgerReconciliationDto } from "./dto/scan-ledger-reconciliation.dto";
import { LedgerReconciliationService } from "./ledger-reconciliation.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("ledger/internal/worker/reconciliation")
export class LedgerReconciliationWorkerController {
  constructor(
    private readonly ledgerReconciliationService: LedgerReconciliationService
  ) {}

  @Post("scan")
  async scanMismatches(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ScanLedgerReconciliationDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.runTrackedScan(dto, {
      triggerSource: "worker",
      workerId: request.internalWorker.workerId
    });

    return {
      status: "success",
      message: "Worker-triggered ledger reconciliation scan completed successfully.",
      data: result
    };
  }
}
