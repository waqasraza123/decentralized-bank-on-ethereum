import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";
import { RetirementVaultReleaseRequestStatus } from "@prisma/client";

export class ListInternalRetirementVaultReleaseRequestsDto {
  @IsOptional()
  @IsEnum(RetirementVaultReleaseRequestStatus)
  readonly status?: RetirementVaultReleaseRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;
}
