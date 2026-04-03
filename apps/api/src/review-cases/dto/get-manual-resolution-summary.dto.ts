import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

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
  manualResolutionReasonCode?: string;

  @IsOptional()
  @IsString()
  manualResolvedByOperatorId?: string;
}
