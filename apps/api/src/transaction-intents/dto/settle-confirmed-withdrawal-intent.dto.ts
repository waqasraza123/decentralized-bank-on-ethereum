import { IsOptional, IsString } from "class-validator";

export class SettleConfirmedWithdrawalIntentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
