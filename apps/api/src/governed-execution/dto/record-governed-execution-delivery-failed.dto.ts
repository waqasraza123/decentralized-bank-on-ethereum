import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class RecordGovernedExecutionDeliveryFailedDto {
  @IsString()
  @MaxLength(191)
  dispatchReference!: string;

  @IsString()
  @MaxLength(64)
  deliveryBackendType!: string;

  @IsString()
  @MaxLength(500)
  deliveryFailureReason!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  deliveryHttpStatus?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryBackendReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNote?: string;
}
