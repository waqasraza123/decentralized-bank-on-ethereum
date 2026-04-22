import { IsAlphanumeric, IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";

const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export class CreateBalanceTransferDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;

  @IsString()
  @Length(2, 16)
  @IsAlphanumeric()
  assetSymbol!: string;

  @IsString()
  @Matches(POSITIVE_DECIMAL_PATTERN)
  amount!: string;

  @IsEmail()
  @MaxLength(320)
  recipientEmail!: string;
}
