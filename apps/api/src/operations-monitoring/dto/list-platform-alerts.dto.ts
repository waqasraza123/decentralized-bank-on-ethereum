import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

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
  @IsIn(["worker", "reconciliation", "queue", "chain", "treasury"])
  category?: "worker" | "reconciliation" | "queue" | "chain" | "treasury";

  @IsOptional()
  @IsIn(["unrouted", "routed"])
  routingStatus?: "unrouted" | "routed";
}
