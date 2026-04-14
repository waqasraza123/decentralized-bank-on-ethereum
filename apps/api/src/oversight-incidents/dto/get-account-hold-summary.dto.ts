import { Type } from "class-transformer";
import {
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
  OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH,
  OPERATOR_CASE_REASON_CODE_MAX_LENGTH,
  OPERATOR_CASE_REASON_CODE_PATTERN
} from "../../review-cases/dto/operator-case-input.validation";

export class GetAccountHoldSummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  sinceDays?: number;

  @IsOptional()
  @IsIn([
    "customer_manual_resolution_spike",
    "operator_manual_resolution_spike"
  ])
  incidentType?:
    | "customer_manual_resolution_spike"
    | "operator_manual_resolution_spike";

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_REASON_CODE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_REASON_CODE_PATTERN)
  restrictionReasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  appliedByOperatorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  releasedByOperatorId?: string;

  @IsOptional()
  @IsIn(["not_requested", "pending", "approved", "denied"])
  releaseDecisionStatus?: "not_requested" | "pending" | "approved" | "denied";
}
