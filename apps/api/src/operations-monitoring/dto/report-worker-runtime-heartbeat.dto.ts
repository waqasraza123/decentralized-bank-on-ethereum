import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ReportWorkerRuntimeHeartbeatDto {
  @IsIn(["development", "test", "production"])
  environment!: "development" | "test" | "production";

  @IsIn(["monitor", "synthetic", "managed"])
  executionMode!: "monitor" | "synthetic" | "managed";

  @IsIn(["running", "succeeded", "failed"])
  lastIterationStatus!: "running" | "succeeded" | "failed";

  @IsOptional()
  @IsDateString()
  lastIterationStartedAt?: string;

  @IsOptional()
  @IsDateString()
  lastIterationCompletedAt?: string;

  @IsOptional()
  @IsString()
  lastErrorCode?: string;

  @IsOptional()
  @IsString()
  lastErrorMessage?: string;

  @IsOptional()
  @IsString()
  lastReconciliationScanRunId?: string;

  @IsOptional()
  @IsDateString()
  lastReconciliationScanStartedAt?: string;

  @IsOptional()
  @IsDateString()
  lastReconciliationScanCompletedAt?: string;

  @IsOptional()
  @IsIn(["running", "succeeded", "failed"])
  lastReconciliationScanStatus?: "running" | "succeeded" | "failed";

  @IsOptional()
  @IsObject()
  runtimeMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  latestIterationMetrics?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  lastIterationDurationMs?: number;
}
