import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import {
  TRANSACTION_INTENT_AMOUNT_PATTERN,
  TRANSACTION_INTENT_AMOUNT_PATTERN_MESSAGE,
  TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH,
  TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH,
  TRANSACTION_INTENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  TRANSACTION_INTENT_IDEMPOTENCY_KEY_MIN_LENGTH
} from "../../transaction-intents/dto/transaction-intent-request.validation";

export class FundRetirementVaultDto {
  @IsString()
  @MinLength(TRANSACTION_INTENT_IDEMPOTENCY_KEY_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_IDEMPOTENCY_KEY_MAX_LENGTH)
  readonly idempotencyKey!: string;

  @IsString()
  @MinLength(TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH)
  readonly assetSymbol!: string;

  @IsString()
  @Matches(TRANSACTION_INTENT_AMOUNT_PATTERN, {
    message: TRANSACTION_INTENT_AMOUNT_PATTERN_MESSAGE
  })
  readonly amount!: string;
}
