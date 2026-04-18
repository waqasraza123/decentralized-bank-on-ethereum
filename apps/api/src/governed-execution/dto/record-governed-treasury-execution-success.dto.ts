import { IsOptional, IsString } from "class-validator";

export class RecordGovernedTreasuryExecutionSuccessDto {
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
