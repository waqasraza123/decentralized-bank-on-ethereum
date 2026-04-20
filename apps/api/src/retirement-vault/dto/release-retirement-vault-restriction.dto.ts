import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReleaseRetirementVaultRestrictionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
