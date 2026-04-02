import { IsOptional, IsString } from "class-validator";

export class ReplayWithdrawalSettlementStepDto {
  @IsOptional()
  @IsString()
  note?: string;
}
