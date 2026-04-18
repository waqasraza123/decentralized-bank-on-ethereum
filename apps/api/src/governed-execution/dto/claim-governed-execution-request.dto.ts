import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class ClaimGovernedExecutionRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  reclaimStaleAfterMs?: number;
}
