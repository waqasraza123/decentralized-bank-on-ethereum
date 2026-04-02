import {
  IsEthereumAddress,
  IsNotEmpty,
  IsString
} from "class-validator";

export class CreateWithdrawalIntentDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsString()
  @IsNotEmpty()
  assetSymbol!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsEthereumAddress()
  destinationAddress!: string;
}
