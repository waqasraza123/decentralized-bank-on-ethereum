import { IsOptional, IsString } from "class-validator";

export class ReleaseAccountRestrictionDto {
  @IsOptional()
  @IsString()
  note?: string;
}
