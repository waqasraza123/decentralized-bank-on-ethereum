import { IsIn, IsOptional, IsString } from "class-validator";

export class ScanLedgerReconciliationDto {
  @IsOptional()
  @IsIn(["transaction_intent", "customer_balance"])
  scope?: "transaction_intent" | "customer_balance";

  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  transactionIntentId?: string;
}
