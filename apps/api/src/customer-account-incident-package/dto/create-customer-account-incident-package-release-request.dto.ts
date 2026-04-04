import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import {
  incidentPackageExportModes,
  type IncidentPackageExportMode
} from "./get-customer-account-compliance-export.dto";

export const incidentPackageReleaseTargets = [
  "internal_casefile",
  "compliance_handoff",
  "regulator_response",
  "external_counsel"
] as const;

export type IncidentPackageReleaseTarget =
  (typeof incidentPackageReleaseTargets)[number];

export class CreateCustomerAccountIncidentPackageReleaseRequestDto {
  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  supabaseUserId?: string;

  @IsOptional()
  @IsIn(incidentPackageExportModes)
  mode?: IncidentPackageExportMode;

  @IsIn(incidentPackageReleaseTargets)
  releaseTarget!: IncidentPackageReleaseTarget;

  @IsString()
  releaseReasonCode!: string;

  @IsOptional()
  @IsString()
  requestNote?: string;

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
