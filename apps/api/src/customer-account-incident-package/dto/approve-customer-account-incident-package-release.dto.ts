import { IsOptional, IsString } from "class-validator";

export class ApproveCustomerAccountIncidentPackageReleaseDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;
}
