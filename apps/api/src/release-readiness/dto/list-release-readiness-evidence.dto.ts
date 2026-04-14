import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";
import {
  releaseReadinessEnvironments,
  releaseReadinessEvidenceStatuses,
  releaseReadinessEvidenceTypes
} from "./create-release-readiness-evidence.dto";
import {
  RELEASE_READINESS_LIST_LIMIT_MAX,
  RELEASE_READINESS_SINCE_DAYS_MAX
} from "./release-readiness-input.validation";

export class ListReleaseReadinessEvidenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RELEASE_READINESS_LIST_LIMIT_MAX)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RELEASE_READINESS_SINCE_DAYS_MAX)
  sinceDays?: number;

  @IsOptional()
  @IsIn(releaseReadinessEvidenceTypes)
  evidenceType?: (typeof releaseReadinessEvidenceTypes)[number];

  @IsOptional()
  @IsIn(releaseReadinessEnvironments)
  environment?: (typeof releaseReadinessEnvironments)[number];

  @IsOptional()
  @IsIn(releaseReadinessEvidenceStatuses)
  status?: (typeof releaseReadinessEvidenceStatuses)[number];
}
