import { IsEmail, IsOptional, IsString } from "class-validator";

export class IssueOperatorTokenDto {
  @IsOptional()
  @IsString()
  operatorId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
