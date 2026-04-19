import { IsIn, IsString } from "class-validator";

export class StartMfaChallengeDto {
  @IsString()
  @IsIn(["totp", "email_otp"], {
    message: "MFA challenge method must be totp or email_otp.",
  })
  method: "totp" | "email_otp" = "totp";

  @IsString()
  @IsIn(["withdrawal_step_up", "password_step_up"], {
    message:
      "MFA challenge purpose must be withdrawal_step_up or password_step_up.",
  })
  purpose: "withdrawal_step_up" | "password_step_up" = "withdrawal_step_up";
}
