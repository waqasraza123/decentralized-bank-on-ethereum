import { IsOptional, IsString } from "class-validator";

export class OpenDeniedWithdrawalReviewCaseDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;
}
