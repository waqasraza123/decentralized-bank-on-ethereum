import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import {
  incidentPackageExportModes,
  type IncidentPackageExportMode
} from "./get-customer-account-compliance-export.dto";
import {
  incidentPackageReleaseTargets,
  type IncidentPackageReleaseTarget
} from "./create-customer-account-incident-package-release-request.dto";

export class ListPendingCustomerAccountIncidentPackageReleasesDto {
  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  requestedByOperatorId?: string;

  @IsOptional()
  @IsIn(incidentPackageExportModes)
  mode?: IncidentPackageExportMode;

  @IsOptional()
  @IsIn(incidentPackageReleaseTargets)
  releaseTarget?: IncidentPackageReleaseTarget;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
