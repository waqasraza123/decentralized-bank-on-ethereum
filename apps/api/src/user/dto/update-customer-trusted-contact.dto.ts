import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCustomerTrustedContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relationshipLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
