import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListMyTransactionHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn([
    "deposit",
    "withdrawal",
    "internal_balance_transfer",
    "vault_subscription",
    "vault_redemption"
  ])
  intentType?:
    | "deposit"
    | "withdrawal"
    | "internal_balance_transfer"
    | "vault_subscription"
    | "vault_redemption";

  @IsOptional()
  @IsIn([
    "requested",
    "review_required",
    "approved",
    "queued",
    "broadcast",
    "confirmed",
    "settled",
    "failed",
    "cancelled",
    "manually_resolved"
  ])
  status?:
    | "requested"
    | "review_required"
    | "approved"
    | "queued"
    | "broadcast"
    | "confirmed"
    | "settled"
    | "failed"
    | "cancelled"
    | "manually_resolved";

  @IsOptional()
  @IsString()
  assetSymbol?: string;
}
