import { IsOptional, IsString, MaxLength } from "class-validator";

export class RetirementVaultOperatorNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
