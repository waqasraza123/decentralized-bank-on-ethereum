import { IsOptional, IsString, MaxLength } from "class-validator";

export const stakingPoolGovernanceRequestStatuses = [
  "pending_approval",
  "approved",
  "rejected",
  "executed",
  "execution_failed"
] as const;

export class ApproveStakingPoolGovernanceRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  approvalNote?: string;
}

export class RejectStakingPoolGovernanceRequestDto {
  @IsString()
  @MaxLength(4000)
  rejectionNote!: string;
}

export class ExecuteStakingPoolGovernanceRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  executionNote?: string;
}
