import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReplayWithdrawalSettlementStepDto {
  @IsString()
  @MaxLength(191)
  readonly approvalRequestId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
