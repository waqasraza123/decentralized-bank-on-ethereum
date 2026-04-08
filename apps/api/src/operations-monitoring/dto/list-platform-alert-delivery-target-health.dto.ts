import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

export class ListPlatformAlertDeliveryTargetHealthDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  lookbackHours?: number;
}
