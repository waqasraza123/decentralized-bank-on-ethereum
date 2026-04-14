import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from "class-validator";
import type {
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import { OPERATOR_CASE_NOTE_CONTENT_PATTERN } from "../../review-cases/dto/operator-case-input.validation";
import {
  RELEASE_READINESS_EVIDENCE_LINK_MAX_LENGTH,
  RELEASE_READINESS_IDENTIFIER_MAX_LENGTH,
  RELEASE_READINESS_NOTE_MAX_LENGTH,
  RELEASE_READINESS_RUNBOOK_PATH_MAX_LENGTH,
  RELEASE_READINESS_SUMMARY_MAX_LENGTH
} from "./release-readiness-input.validation";

export const releaseReadinessEvidenceTypes = [
  "platform_alert_delivery_slo",
  "critical_alert_reescalation",
  "database_restore_drill",
  "api_rollback_drill",
  "worker_rollback_drill",
  "contract_invariant_suite",
  "backend_integration_suite",
  "end_to_end_finance_flows",
  "secret_handling_review",
  "role_review"
] as const;

export const releaseReadinessEnvironments = [
  "development",
  "ci",
  "staging",
  "production_like",
  "production"
] as const;

export const releaseReadinessEvidenceStatuses = [
  "pending",
  "passed",
  "failed"
] as const;

export class CreateReleaseReadinessEvidenceDto {
  @IsIn(releaseReadinessEvidenceTypes)
  evidenceType!: ReleaseReadinessEvidenceType;

  @IsIn(releaseReadinessEnvironments)
  environment!: ReleaseReadinessEnvironment;

  @IsIn(releaseReadinessEvidenceStatuses)
  status!: ReleaseReadinessEvidenceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  releaseIdentifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  rollbackReleaseIdentifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  backupReference?: string;

  @IsString()
  @MaxLength(RELEASE_READINESS_SUMMARY_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_RUNBOOK_PATH_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  runbookPath?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(RELEASE_READINESS_EVIDENCE_LINK_MAX_LENGTH, { each: true })
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN, { each: true })
  evidenceLinks?: string[];

  @IsOptional()
  @IsObject()
  evidencePayload?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsDateString()
  observedAt?: string;
}
