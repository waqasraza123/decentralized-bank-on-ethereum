import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateDepositIntentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  readonly idempotencyKey!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  readonly assetSymbol!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/, {
    message:
      "amount must be a positive decimal string with up to 18 decimal places."
  })
  readonly amount!: string;
}
