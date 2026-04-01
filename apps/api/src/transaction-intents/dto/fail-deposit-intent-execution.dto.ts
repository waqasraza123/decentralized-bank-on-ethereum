import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

export class FailDepositIntentExecutionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  readonly failureCode!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  readonly failureReason!: string;

  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: "txHash must be a valid 32-byte hex transaction hash."
  })
  readonly txHash?: string;

  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: "fromAddress must be a valid EVM address."
  })
  readonly fromAddress?: string;

  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: "toAddress must be a valid EVM address."
  })
  readonly toAddress?: string;
}
