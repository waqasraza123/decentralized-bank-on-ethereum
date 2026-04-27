import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

export class RecordSolvencyReportAnchorConfirmedDto {
  @IsString()
  @Matches(TX_HASH_PATTERN, {
    message: "txHash must be a valid 32-byte transaction hash."
  })
  readonly txHash!: string;

  @IsOptional()
  @IsString()
  @Matches(EVM_ADDRESS_PATTERN, {
    message: "contractAddress must be a valid EVM address."
  })
  readonly contractAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly blockNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly logIndex?: number;
}
