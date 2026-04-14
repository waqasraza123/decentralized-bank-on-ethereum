import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import {
  OPERATOR_CASE_EMAIL_MAX_LENGTH,
  OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH
} from "../../review-cases/dto/operator-case-input.validation";
import {
  TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH,
  TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH,
  TRANSACTION_INTENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  TRANSACTION_INTENT_IDEMPOTENCY_KEY_MIN_LENGTH
} from "./transaction-intent-request.validation";
import {
  TRANSACTION_INTENT_TX_HASH_PATTERN,
  TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
} from "./transaction-intent-execution.validation";

export class SearchTransactionOperationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["deposit", "withdrawal"])
  intentType?: "deposit" | "withdrawal";

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
  @MinLength(TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH)
  assetSymbol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  supabaseUserId?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(OPERATOR_CASE_EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(TRANSACTION_INTENT_TX_HASH_PATTERN, {
    message: TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
  })
  txHash?: string;

  @IsOptional()
  @IsString()
  @MinLength(TRANSACTION_INTENT_IDEMPOTENCY_KEY_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_IDEMPOTENCY_KEY_MAX_LENGTH)
  idempotencyKey?: string;
}
