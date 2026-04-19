# Customer MFA API Runbook

## Runtime Controls

- `CUSTOMER_MFA_EMAIL_OTP_EXPIRY_SECONDS`
- `CUSTOMER_MFA_TOTP_ENROLLMENT_EXPIRY_SECONDS`
- `CUSTOMER_MFA_STEP_UP_FRESHNESS_SECONDS`
- `CUSTOMER_MFA_MAX_FAILED_ATTEMPTS`
- `CUSTOMER_MFA_LOCKOUT_SECONDS`
- `CUSTOMER_MFA_CHALLENGE_START_COOLDOWN_SECONDS`

## Current Behavior

- Read-only customer access remains available when MFA is incomplete.
- Withdraw, send, and password rotation require a completed MFA posture.
- Sensitive verification paths now enforce:
  - failed-attempt counting
  - temporary lockout after too many bad codes
  - cooldown between challenge/code starts
  - automatic reset of failed-attempt state after successful verification

## Support Handling

- If a customer is blocked by setup posture:
  - confirm TOTP enrollment is complete
  - confirm email backup enrollment is complete
- If a customer is blocked by lockout:
  - wait until `lockedUntil` passes
  - do not manually modify DB state except under governed incident handling
- If local/dev testing needs email OTP:
  - non-production responses may include `previewCode`
  - production must rely on real delivery and should not expose preview codes

## Verification Paths

- `GET /auth/mfa/status`
- `POST /auth/mfa/totp/enrollment/start`
- `POST /auth/mfa/totp/enrollment/verify`
- `POST /auth/mfa/email/enrollment/start`
- `POST /auth/mfa/email/enrollment/verify`
- `POST /auth/mfa/challenge/start`
- `POST /auth/mfa/challenge/verify`
