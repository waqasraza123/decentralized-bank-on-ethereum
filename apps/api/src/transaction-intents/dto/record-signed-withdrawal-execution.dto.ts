import {
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min
} from "class-validator";

export class RecordSignedWithdrawalExecutionDto {
  @IsString()
  @IsNotEmpty()
  txHash!: string;

  @IsInt()
  @Min(0)
  nonce!: number;

  @IsString()
  @IsNotEmpty()
  serializedTransaction!: string;

  @IsOptional()
  @IsEthereumAddress()
  fromAddress?: string;

  @IsOptional()
  @IsEthereumAddress()
  toAddress?: string;
}
