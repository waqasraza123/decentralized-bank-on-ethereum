import {
  IsEthereumAddress,
  IsNotEmpty,
  IsOptional,
  IsString
} from "class-validator";

export class RecordWithdrawalBroadcastDto {
  @IsString()
  @IsNotEmpty()
  txHash!: string;

  @IsOptional()
  @IsEthereumAddress()
  fromAddress?: string;

  @IsOptional()
  @IsEthereumAddress()
  toAddress?: string;
}
