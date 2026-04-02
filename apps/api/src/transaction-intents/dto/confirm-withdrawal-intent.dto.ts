import { IsOptional, IsString } from "class-validator";

export class ConfirmWithdrawalIntentDto {
  @IsOptional()
  @IsString()
  txHash?: string;
}
