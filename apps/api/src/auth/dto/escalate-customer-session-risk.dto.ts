import { IsOptional, IsString, MaxLength } from "class-validator";

export class EscalateCustomerSessionRiskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
