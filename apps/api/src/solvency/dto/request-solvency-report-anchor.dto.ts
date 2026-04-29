import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, Min, MinLength } from "class-validator";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export class RequestSolvencyReportAnchorDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly chainId?: number;

  @IsOptional()
  @IsString()
  @Matches(EVM_ADDRESS_PATTERN, {
    message: "contractAddress must be a valid EVM address."
  })
  readonly contractAddress?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  readonly anchorNote?: string;
}
