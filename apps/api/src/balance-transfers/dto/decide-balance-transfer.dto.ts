import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class DecideBalanceTransferDto {
  @IsIn(["approved", "denied"])
  decision!: "approved" | "denied";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  denialReason?: string;
}
