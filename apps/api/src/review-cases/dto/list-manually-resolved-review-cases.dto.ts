import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListManuallyResolvedReviewCasesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

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
  assignedOperatorId?: string;

  @IsOptional()
  @IsString()
  manualResolutionReasonCode?: string;

  @IsOptional()
  @IsString()
  manualResolvedByOperatorId?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
