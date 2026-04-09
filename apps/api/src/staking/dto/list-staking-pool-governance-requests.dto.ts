import { Type } from "class-transformer";
import { IsIn, IsOptional, IsInt, Max, Min } from "class-validator";
import { stakingPoolGovernanceRequestStatuses } from "./staking-pool-governance-request.dto";

export class ListStakingPoolGovernanceRequestsDto {
  @IsOptional()
  @IsIn(stakingPoolGovernanceRequestStatuses)
  status?: (typeof stakingPoolGovernanceRequestStatuses)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
