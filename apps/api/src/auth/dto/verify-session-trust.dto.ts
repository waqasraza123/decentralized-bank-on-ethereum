import { IsString, Length } from "class-validator";

export class VerifySessionTrustDto {
  @IsString()
  @Length(6, 6, {
    message: "Session verification code must be exactly 6 digits.",
  })
  code!: string;
}
