import { IsOptional, IsString, MaxLength } from "class-validator";

export class ClearPlatformAlertSuppressionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
