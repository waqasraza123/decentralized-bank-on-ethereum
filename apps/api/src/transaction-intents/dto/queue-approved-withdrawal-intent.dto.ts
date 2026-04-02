import { IsOptional, IsString } from "class-validator";

export class QueueApprovedWithdrawalIntentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
