import { IsOptional, IsString } from "class-validator";

export class DismissReviewCaseDto {
  @IsOptional()
  @IsString()
  note?: string;
}
