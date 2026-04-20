import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  TRANSACTION_INTENT_AMOUNT_PATTERN,
  TRANSACTION_INTENT_AMOUNT_PATTERN_MESSAGE,
  TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH,
  TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH,
} from "../../transaction-intents/dto/transaction-intent-request.validation";

export class RequestRetirementVaultReleaseDto {
  @IsString()
  @MinLength(TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH)
  readonly assetSymbol!: string;

  @IsString()
  @Matches(TRANSACTION_INTENT_AMOUNT_PATTERN, {
    message: TRANSACTION_INTENT_AMOUNT_PATTERN_MESSAGE,
  })
  readonly amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly reasonNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly evidenceNote?: string;
}
