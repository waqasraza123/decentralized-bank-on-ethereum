import { IsString, Matches } from "class-validator";

export class VerifyTotpEnrollmentDto {
  @IsString()
  @Matches(/^\d{6}$/u, {
    message: "Authenticator code must be a 6-digit number.",
  })
  code: string = "";
}
