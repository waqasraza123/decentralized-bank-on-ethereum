import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReplayDepositSettlementStepDto {
  @IsString()
  @MaxLength(191)
  readonly approvalRequestId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
