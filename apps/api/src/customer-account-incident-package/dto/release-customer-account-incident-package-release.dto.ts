import { IsOptional, IsString } from "class-validator";

export class ReleaseCustomerAccountIncidentPackageReleaseDto {
  @IsOptional()
  @IsString()
  releaseNote?: string;
}
