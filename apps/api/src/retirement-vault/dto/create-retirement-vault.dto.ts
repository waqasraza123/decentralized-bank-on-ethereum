import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";
import {
  TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH,
  TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH
} from "../../transaction-intents/dto/transaction-intent-request.validation";

export class CreateRetirementVaultDto {
  @IsString()
  @MinLength(TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH)
  readonly assetSymbol!: string;

  @IsISO8601()
  readonly unlockAt!: string;

  @IsOptional()
  @IsBoolean()
  readonly strictMode?: boolean;
}
