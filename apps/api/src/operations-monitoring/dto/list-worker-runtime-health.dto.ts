import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListWorkerRuntimeHealthDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(86400)
  staleAfterSeconds?: number;

  @IsOptional()
  @IsIn(["healthy", "degraded", "stale"])
  healthStatus?: "healthy" | "degraded" | "stale";

  @IsOptional()
  @IsString()
  workerId?: string;
}
