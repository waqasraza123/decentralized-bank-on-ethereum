import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class HandoffReviewCaseDto {
  @IsString()
  @IsNotEmpty()
  nextOperatorId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
