import { IsOptional, IsString } from "class-validator";

export class RejectCustomerAccountIncidentPackageReleaseDto {
  @IsOptional()
  @IsString()
  rejectionNote?: string;
}
