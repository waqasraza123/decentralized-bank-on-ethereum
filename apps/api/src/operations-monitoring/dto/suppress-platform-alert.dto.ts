import { Type } from "class-transformer";
import { IsDate, IsOptional, IsString, MaxLength } from "class-validator";

export class SuppressPlatformAlertDto {
  @Type(() => Date)
  @IsDate()
  suppressedUntil!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
