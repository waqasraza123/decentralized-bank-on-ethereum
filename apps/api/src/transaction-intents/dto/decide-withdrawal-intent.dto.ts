import { IsIn, IsOptional, IsString } from "class-validator";

export class DecideWithdrawalIntentDto {
  @IsIn(["approved", "denied"])
  decision!: "approved" | "denied";

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  denialReason?: string;
}
