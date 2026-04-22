import { IsAlphanumeric, IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export class PreviewBalanceTransferRecipientDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @Length(2, 16)
  @IsAlphanumeric()
  assetSymbol?: string;

  @IsOptional()
  @IsString()
  @Matches(POSITIVE_DECIMAL_PATTERN)
  amount?: string;
}
