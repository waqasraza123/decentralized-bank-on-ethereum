import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCustomerTrustedContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  kind: string = "trusted_contact";

  @IsString()
  @MaxLength(100)
  firstName: string = "";

  @IsString()
  @MaxLength(100)
  lastName: string = "";

  @IsString()
  @MaxLength(120)
  relationshipLabel: string = "";

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
