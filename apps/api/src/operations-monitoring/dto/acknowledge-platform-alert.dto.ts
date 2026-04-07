import { IsOptional, IsString, MaxLength } from "class-validator";

export class AcknowledgePlatformAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
