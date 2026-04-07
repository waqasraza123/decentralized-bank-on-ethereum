import { IsOptional, IsString, MaxLength } from "class-validator";

export class RoutePlatformAlertToReviewCaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
