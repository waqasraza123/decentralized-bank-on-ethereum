import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import {
  OPERATOR_CASE_EMAIL_MAX_LENGTH,
  OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH,
  OPERATOR_CASE_REASON_CODE_MAX_LENGTH,
  OPERATOR_CASE_REASON_CODE_PATTERN
} from "../../review-cases/dto/operator-case-input.validation";

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
  @MaxLength(OPERATOR_CASE_REASON_CODE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_REASON_CODE_PATTERN)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  transactionIntentId?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(OPERATOR_CASE_EMAIL_MAX_LENGTH)
  email?: string;
}
