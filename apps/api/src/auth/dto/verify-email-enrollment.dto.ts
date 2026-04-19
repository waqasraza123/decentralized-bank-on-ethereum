import { IsString, Matches, MinLength } from "class-validator";

export class VerifyEmailEnrollmentDto {
  @IsString()
  @MinLength(1, { message: "Challenge id is required." })
  challengeId: string = "";

  @IsString()
  @Matches(/^\d{6}$/u, {
    message: "Email verification code must be a 6-digit number.",
  })
  code: string = "";
}
