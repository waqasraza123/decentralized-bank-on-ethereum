import { Type } from "class-transformer";
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min
} from "class-validator";
import { OPERATOR_CASE_NOTE_CONTENT_PATTERN } from "../../review-cases/dto/operator-case-input.validation";
import { releaseReadinessEnvironments } from "./create-release-readiness-evidence.dto";
import {
  RELEASE_READINESS_IDENTIFIER_MAX_LENGTH,
  RELEASE_READINESS_RUNBOOK_PATH_MAX_LENGTH
} from "./release-readiness-input.validation";

const NETWORK_NAME_MAX_LENGTH = 100;
const GIT_COMMIT_SHA_PATTERN = /^[a-fA-F0-9]{7,40}$/;

export class GetSolvencyAnchorRegistryDeploymentProofDto {
  @IsIn(releaseReadinessEnvironments)
  environment!: (typeof releaseReadinessEnvironments)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  chainId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(NETWORK_NAME_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  networkName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_RUNBOOK_PATH_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  manifestPath?: string;

  @IsOptional()
  @IsString()
  @Matches(GIT_COMMIT_SHA_PATTERN)
  manifestCommitSha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  releaseIdentifier?: string;
}
