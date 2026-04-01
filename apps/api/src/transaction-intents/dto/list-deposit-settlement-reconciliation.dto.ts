import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListDepositSettlementReconciliationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;

  @IsOptional()
  @IsIn([
    "waiting_for_confirmation",
    "ready_for_confirm_replay",
    "ready_for_settle_replay",
    "healthy_settled",
    "manual_review_required"
  ])
  readonly state?:
    | "waiting_for_confirmation"
    | "ready_for_confirm_replay"
    | "ready_for_settle_replay"
    | "healthy_settled"
    | "manual_review_required";
}
