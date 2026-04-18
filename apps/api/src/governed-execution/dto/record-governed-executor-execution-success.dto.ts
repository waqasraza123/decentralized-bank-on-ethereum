import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class RecordGovernedExecutorExecutionSuccessDto {
  @IsString()
  dispatchReference!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  transactionChainId!: number;

  @IsString()
  transactionToAddress!: string;

  @IsOptional()
  @IsString()
  executionNote?: string;

  @IsOptional()
  @IsString()
  blockchainTransactionHash?: string;

  @IsOptional()
  @IsString()
  externalExecutionReference?: string;

  @IsOptional()
  @IsString()
  contractLoanId?: string;

  @IsOptional()
  @IsString()
  contractAddress?: string;
}
