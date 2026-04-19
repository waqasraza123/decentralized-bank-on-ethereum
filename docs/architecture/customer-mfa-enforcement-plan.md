# Customer MFA Enforcement Plan

## Policy

- Customer signs in with email and password first.
- MFA setup is enforced immediately after login across `apps/mobile` and `apps/web`.
- Read-only access remains available while MFA is incomplete.
- Money-out remains blocked until both factors are enrolled:
  - TOTP authenticator app
  - email OTP backup factor
- Existing customers follow the same rule on their next login.

## API Changes

- Extend customer auth/session state with MFA posture:
  - `required`
  - `totpEnrolled`
  - `emailOtpEnrolled`
  - `requiresSetup`
  - `moneyMovementBlocked`
  - `stepUpFreshUntil`
- Add customer MFA endpoints:
  - `GET /auth/mfa/status`
  - `POST /auth/mfa/totp/enrollment/start`
  - `POST /auth/mfa/totp/enrollment/verify`
  - `POST /auth/mfa/email/enrollment/start`
  - `POST /auth/mfa/email/enrollment/verify`
  - `POST /auth/mfa/challenge/start`
  - `POST /auth/mfa/challenge/verify`
- Enforce MFA server-side for:
  - withdrawal creation
  - password rotation

## UI Changes

- `apps/mobile`
  - route newly signed-in customers with incomplete MFA to Profile first
  - add MFA setup and password step-up controls to Profile
  - block wallet send/withdraw until MFA setup and fresh step-up are complete
- `apps/web`
  - route newly signed-in customers with incomplete MFA to Profile first
  - add MFA setup and password step-up controls to Profile
  - block wallet withdraw/send until MFA setup and fresh step-up are complete

## Security Notes

- Browsing, balances, history, and profile reads stay available before full MFA enrollment.
- Money movement depends on both enrollment completion and a recent step-up verification.
- Non-production flows may expose preview OTP codes for local testing when outbound email delivery is unavailable.
