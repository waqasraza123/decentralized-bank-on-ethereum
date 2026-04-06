import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListLedgerReconciliationRunsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["running", "succeeded", "failed"])
  status?: "running" | "succeeded" | "failed";

  @IsOptional()
  @IsIn(["operator", "worker", "system"])
  triggerSource?: "operator" | "worker" | "system";

  @IsOptional()
  @IsIn(["transaction_intent", "customer_balance"])
  scope?: "transaction_intent" | "customer_balance";

  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  transactionIntentId?: string;

  @IsOptional()
  @IsString()
  workerId?: string;
}
