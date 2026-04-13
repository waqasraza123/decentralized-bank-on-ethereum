import {
  IsEthereumAddress,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import {
  TRANSACTION_INTENT_AMOUNT_PATTERN,
  TRANSACTION_INTENT_AMOUNT_PATTERN_MESSAGE,
  TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH,
  TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH,
  TRANSACTION_INTENT_IDEMPOTENCY_KEY_MAX_LENGTH,
  TRANSACTION_INTENT_IDEMPOTENCY_KEY_MIN_LENGTH
} from "./transaction-intent-request.validation";

export class CreateWithdrawalIntentDto {
  @IsString()
  @MinLength(TRANSACTION_INTENT_IDEMPOTENCY_KEY_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_IDEMPOTENCY_KEY_MAX_LENGTH)
  idempotencyKey!: string;

  @IsString()
  @MinLength(TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH)
  assetSymbol!: string;

  @IsString()
  @Matches(TRANSACTION_INTENT_AMOUNT_PATTERN, {
    message: TRANSACTION_INTENT_AMOUNT_PATTERN_MESSAGE
  })
  amount!: string;

  @IsEthereumAddress()
  destinationAddress!: string;
}
