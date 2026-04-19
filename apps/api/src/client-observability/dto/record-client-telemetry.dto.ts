import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

const clientTelemetryKinds = [
  "message",
  "exception",
  "http_error",
  "bootstrap_error",
  "unhandled_rejection",
  "query_error",
  "mutation_error"
] as const;

const clientTelemetryLevels = ["info", "warning", "error"] as const;

export class RecordClientTelemetryDto {
  @IsString()
  @MaxLength(64)
  app!: string;

  @IsString()
  @MaxLength(64)
  environment!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  release?: string;

  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsDateString()
  timestamp!: string;

  @IsIn(clientTelemetryKinds)
  kind!: (typeof clientTelemetryKinds)[number];

  @IsIn(clientTelemetryLevels)
  level!: (typeof clientTelemetryLevels)[number];

  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  errorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  stack?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
