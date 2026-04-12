import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class StartManagedWithdrawalExecutionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reclaimStaleAfterMs!: number;
}
