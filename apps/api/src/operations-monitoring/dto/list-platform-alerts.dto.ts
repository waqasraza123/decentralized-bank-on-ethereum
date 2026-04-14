import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH } from "../../review-cases/dto/operator-case-input.validation";

export class ListPlatformAlertsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(86400)
  staleAfterSeconds?: number;

  @IsOptional()
  @IsIn(["open", "resolved"])
  status?: "open" | "resolved";

  @IsOptional()
  @IsIn(["warning", "critical"])
  severity?: "warning" | "critical";

  @IsOptional()
  @IsIn(["worker", "reconciliation", "queue", "chain", "treasury", "operations"])
  category?:
    | "worker"
    | "reconciliation"
    | "queue"
    | "chain"
    | "treasury"
    | "operations";

  @IsOptional()
  @IsIn(["unrouted", "routed"])
  routingStatus?: "unrouted" | "routed";

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  ownerOperatorId?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  acknowledged?: "true" | "false";

  @IsOptional()
  @IsIn(["true", "false"])
  suppressed?: "true" | "false";
}
