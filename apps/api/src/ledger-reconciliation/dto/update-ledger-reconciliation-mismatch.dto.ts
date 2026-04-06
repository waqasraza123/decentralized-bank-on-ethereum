import { IsOptional, IsString } from "class-validator";

export class UpdateLedgerReconciliationMismatchDto {
  @IsOptional()
  @IsString()
  note?: string;
}
