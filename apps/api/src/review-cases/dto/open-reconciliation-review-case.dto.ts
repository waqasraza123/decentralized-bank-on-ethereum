import { IsOptional, IsString } from "class-validator";

export class OpenReconciliationReviewCaseDto {
  @IsOptional()
  @IsString()
  note?: string;
}
