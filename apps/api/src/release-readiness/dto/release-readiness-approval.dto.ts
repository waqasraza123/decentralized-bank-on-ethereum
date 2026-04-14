import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { OPERATOR_CASE_NOTE_CONTENT_PATTERN } from "../../review-cases/dto/operator-case-input.validation";
import { RELEASE_READINESS_NOTE_MAX_LENGTH } from "./release-readiness-input.validation";

export const releaseReadinessApprovalStatuses = [
  "pending_approval",
  "approved",
  "rejected"
] as const;

export class ApproveReleaseReadinessApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  approvalNote?: string;
}

export class RejectReleaseReadinessApprovalDto {
  @IsString()
  @MaxLength(RELEASE_READINESS_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  rejectionNote!: string;
}
