import { IsOptional, IsString, MaxLength } from "class-validator";

export class AssignPlatformAlertOwnerDto {
  @IsString()
  @MaxLength(120)
  ownerOperatorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
