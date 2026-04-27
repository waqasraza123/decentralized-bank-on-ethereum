import { IsString, MinLength } from "class-validator";

export class RecordSolvencyReportAnchorFailedDto {
  @IsString()
  @MinLength(1)
  readonly failureReason!: string;
}
