import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

export class GetTreasuryOverviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  walletLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  activityLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  alertLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(86400)
  staleAfterSeconds?: number;
}
