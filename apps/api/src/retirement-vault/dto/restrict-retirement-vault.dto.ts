import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RestrictRetirementVaultDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  readonly reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  readonly oversightIncidentId?: string;
}
