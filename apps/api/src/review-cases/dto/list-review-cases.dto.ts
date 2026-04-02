import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

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
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  transactionIntentId?: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  assignedOperatorId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  supabaseUserId?: string;
}
