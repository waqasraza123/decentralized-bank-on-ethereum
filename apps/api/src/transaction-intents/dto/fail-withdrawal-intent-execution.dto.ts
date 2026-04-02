import {
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString
} from "class-validator";

export class FailWithdrawalIntentExecutionDto {
  @IsString()
  @IsNotEmpty()
  failureCode!: string;

  @IsString()
  @IsNotEmpty()
  failureReason!: string;

  @IsOptional()
  @IsString()
  txHash?: string;

  @IsOptional()
  @IsEthereumAddress()
  fromAddress?: string;

  @IsOptional()
  @IsEthereumAddress()
  toAddress?: string;
}
