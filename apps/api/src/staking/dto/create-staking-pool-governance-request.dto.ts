import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateStakingPoolGovernanceRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rewardRate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  requestNote?: string;
}
