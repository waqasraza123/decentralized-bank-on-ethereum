import { IsOptional, IsString } from "class-validator";

export class ResolveReviewCaseDto {
  @IsOptional()
  @IsString()
  note?: string;
}
