import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class GetOperationsStatusDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(86400)
  staleAfterSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  recentAlertLimit?: number;
}
