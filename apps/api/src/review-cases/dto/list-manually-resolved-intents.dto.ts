import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListManuallyResolvedIntentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["deposit", "withdrawal"])
  intentType?: "deposit" | "withdrawal";

  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  supabaseUserId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  manualResolutionReasonCode?: string;

  @IsOptional()
  @IsString()
  manualResolvedByOperatorId?: string;
}
