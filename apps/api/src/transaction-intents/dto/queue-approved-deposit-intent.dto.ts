import { IsOptional, IsString, MaxLength } from "class-validator";

export class QueueApprovedDepositIntentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
