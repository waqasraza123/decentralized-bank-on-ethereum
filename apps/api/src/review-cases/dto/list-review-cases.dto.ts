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
} from "./operator-case-input.validation";

export class ListReviewCasesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["open", "in_progress", "resolved", "dismissed"])
  status?: "open" | "in_progress" | "resolved" | "dismissed";

  @IsOptional()
  @IsIn([
    "account_review",
    "withdrawal_review",
    "reconciliation_review",
    "manual_intervention"
  ])
  type?:
    | "account_review"
    | "withdrawal_review"
    | "reconciliation_review"
    | "manual_intervention";

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
  @MaxLength(OPERATOR_CASE_REASON_CODE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_REASON_CODE_PATTERN)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  assignedOperatorId?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(OPERATOR_CASE_EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  supabaseUserId?: string;
}
