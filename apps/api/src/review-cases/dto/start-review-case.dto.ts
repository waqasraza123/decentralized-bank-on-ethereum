import { IsOptional, IsString } from "class-validator";

export class StartReviewCaseDto {
  @IsOptional()
  @IsString()
  note?: string;
}
