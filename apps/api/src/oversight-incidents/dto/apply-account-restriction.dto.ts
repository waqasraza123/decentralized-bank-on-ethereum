import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ApplyAccountRestrictionDto {
  @IsString()
  @IsNotEmpty()
  restrictionReasonCode!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
