import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListLedgerReconciliationMismatchesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["open", "resolved", "dismissed"])
  status?: "open" | "resolved" | "dismissed";

  @IsOptional()
  @IsIn(["transaction_intent", "customer_balance"])
  scope?: "transaction_intent" | "customer_balance";

  @IsOptional()
  @IsIn([
    "none",
    "replay_confirm",
    "replay_settle",
    "open_review_case",
    "repair_customer_balance"
  ])
  recommendedAction?:
    | "none"
    | "replay_confirm"
    | "replay_settle"
    | "open_review_case"
    | "repair_customer_balance";

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  transactionIntentId?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
