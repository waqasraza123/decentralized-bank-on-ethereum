import { IsOptional, IsString } from "class-validator";

export class RecordGovernedTreasuryExecutionFailureDto {
  @IsString()
  failureReason!: string;

  @IsOptional()
  @IsString()
  executionNote?: string;

  @IsOptional()
  @IsString()
  blockchainTransactionHash?: string;

  @IsOptional()
  @IsString()
  externalExecutionReference?: string;
}
