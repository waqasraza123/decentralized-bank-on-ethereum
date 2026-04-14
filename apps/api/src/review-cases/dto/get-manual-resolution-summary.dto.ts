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
} from "./operator-case-input.validation";

export class GetManualResolutionSummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  sinceDays?: number;

  @IsOptional()
  @IsIn(["deposit", "withdrawal"])
  intentType?: "deposit" | "withdrawal";

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_REASON_CODE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_REASON_CODE_PATTERN)
  manualResolutionReasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  manualResolvedByOperatorId?: string;
}
