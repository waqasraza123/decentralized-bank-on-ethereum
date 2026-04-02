import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListWithdrawalSettlementReconciliationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn([
    "waiting_for_confirmation",
    "ready_for_confirm_replay",
    "ready_for_settle_replay",
    "healthy_settled",
    "manual_review_required"
  ])
  state?:
    | "waiting_for_confirmation"
    | "ready_for_confirm_replay"
    | "ready_for_settle_replay"
    | "healthy_settled"
    | "manual_review_required";
}
