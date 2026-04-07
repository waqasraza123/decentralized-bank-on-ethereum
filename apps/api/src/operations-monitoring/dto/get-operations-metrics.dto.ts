import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

export class GetOperationsMetricsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(86400)
  staleAfterSeconds?: number;
}
