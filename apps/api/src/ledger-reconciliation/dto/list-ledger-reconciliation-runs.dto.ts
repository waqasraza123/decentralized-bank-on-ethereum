import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH } from "../../review-cases/dto/operator-case-input.validation";

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
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  transactionIntentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  workerId?: string;
}
