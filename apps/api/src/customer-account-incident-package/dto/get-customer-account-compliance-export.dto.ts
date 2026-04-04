import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export const incidentPackageExportModes = [
  "internal_full",
  "redaction_ready",
  "compliance_focused"
] as const;

export type IncidentPackageExportMode =
  (typeof incidentPackageExportModes)[number];

export class GetCustomerAccountComplianceExportDto {
  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  supabaseUserId?: string;

  @IsOptional()
  @IsIn(incidentPackageExportModes)
  mode?: IncidentPackageExportMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recentLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timelineLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sinceDays?: number;
}
