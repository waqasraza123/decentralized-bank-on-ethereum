import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AccountLifecycleStatus,
  Prisma,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as jwt from "jsonwebtoken";
import {
  loadCustomerMfaPolicyRuntimeConfig,
  loadJwtRuntimeConfig,
  loadProductChainRuntimeConfig,
  loadSharedLoginBootstrapRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import {
  buildOtpAuthUri,
  createOtpHash,
  generateBase32Secret,
  generateEmailOtpCode,
  otpHashMatches,
  verifyTotpCode,
} from "./customer-mfa.util";
import { generateEthereumAddress } from "./auth.util";

type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

export type CustomerAccountProjection = {
  customer: {
    id: string;
    supabaseUserId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    passwordHash: string | null;
    mfaRequired: boolean;
    mfaTotpEnrolled: boolean;
    mfaEmailOtpEnrolled: boolean;
    mfaLastVerifiedAt: Date | null;
    mfaLockedUntil: Date | null;
    depositEmailNotificationsEnabled: boolean;
    withdrawalEmailNotificationsEnabled: boolean;
    loanEmailNotificationsEnabled: boolean;
    productUpdateEmailNotificationsEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  customerAccount: {
    id: string;
    status: AccountLifecycleStatus;
    activatedAt: Date | null;
    restrictedAt: Date | null;
    frozenAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type CustomerMfaStatus = {
  required: boolean;
  totpEnrolled: boolean;
  emailOtpEnrolled: boolean;
  requiresSetup: boolean;
  moneyMovementBlocked: boolean;
  stepUpFreshUntil: string | null;
  lockedUntil: string | null;
};

type CustomerMfaChallengeMethod = "totp" | "email_otp";
type CustomerMfaChallengePurpose =
  | "email_enrollment"
  | "withdrawal_step_up"
  | "password_step_up";

type CustomerMfaChallengeRecord = {
  id: string;
  purpose: CustomerMfaChallengePurpose;
  method: CustomerMfaChallengeMethod;
  codeHash: string | null;
  expiresAt: string;
  sentAt: string | null;
};

export type CustomerWalletProjection = {
  wallet: {
    id: string;
    customerAccountId: string | null;
    chainId: number;
    address: string;
    kind: WalletKind;
    custodyType: WalletCustodyType;
    status: WalletStatus;
    createdAt: Date;
    updatedAt: Date;
  };
};

type PublicSignedUpUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  ethereumAddress: string;
};

type PublicLoggedInUser = {
  id: number;
  supabaseUserId: string;
  email: string;
  ethereumAddress: string;
  firstName: string;
  lastName: string;
  mfa: CustomerMfaStatus;
};

type SignUpResponseData = {
  user: PublicSignedUpUser;
};

type LoginResponseData = {
  token: string;
  user: PublicLoggedInUser;
};

type UpdatePasswordResponseData = {
  passwordRotationAvailable: boolean;
};

type MfaStatusResponseData = {
  mfa: CustomerMfaStatus;
};

type StartTotpEnrollmentResponseData = {
  mfa: CustomerMfaStatus;
  secret: string;
  otpAuthUri: string;
};

type StartEmailEnrollmentResponseData = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  expiresAt: string;
  deliveryChannel: "email";
  previewCode: string | null;
};

type VerifyMfaResponseData = {
  mfa: CustomerMfaStatus;
};

type StartMfaChallengeResponseData = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  method: CustomerMfaChallengeMethod;
  purpose: CustomerMfaChallengePurpose;
  expiresAt: string;
  previewCode: string | null;
};

type SharedLoginBootstrapResult = {
  customerId: string;
  customerAccountId: string;
  supabaseUserId: string;
  email: string;
  ethereumAddress: string;
  createdLegacyUser: boolean;
  createdCustomer: boolean;
  createdCustomerAccount: boolean;
};

@Injectable()
export class AuthService {
  private readonly productChainId: number;
  private readonly emailOtpExpiryMs: number;
  private readonly stepUpFreshnessMs: number;
  private readonly totpEnrollmentExpiryMs: number;
  private readonly maxFailedAttempts: number;
  private readonly lockoutDurationMs: number;
  private readonly challengeStartCooldownMs: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    const customerMfaPolicy = loadCustomerMfaPolicyRuntimeConfig();
    this.emailOtpExpiryMs = customerMfaPolicy.emailOtpExpirySeconds * 1000;
    this.stepUpFreshnessMs = customerMfaPolicy.stepUpFreshnessSeconds * 1000;
    this.totpEnrollmentExpiryMs =
      customerMfaPolicy.totpEnrollmentExpirySeconds * 1000;
    this.maxFailedAttempts = customerMfaPolicy.maxFailedAttempts;
    this.lockoutDurationMs = customerMfaPolicy.lockoutSeconds * 1000;
    this.challengeStartCooldownMs =
      customerMfaPolicy.challengeStartCooldownSeconds * 1000;
  }

  private buildCustomerMfaStatus(input: {
    mfaRequired: boolean;
    mfaTotpEnrolled: boolean;
    mfaEmailOtpEnrolled: boolean;
    mfaLastVerifiedAt: Date | null;
    mfaLockedUntil?: Date | null;
  }): CustomerMfaStatus {
    const required = input.mfaRequired;
    const requiresSetup =
      required && (!input.mfaTotpEnrolled || !input.mfaEmailOtpEnrolled);
    const moneyMovementBlocked = requiresSetup;
    const stepUpFreshUntil = input.mfaLastVerifiedAt
      ? new Date(
          input.mfaLastVerifiedAt.getTime() + this.stepUpFreshnessMs,
        ).toISOString()
      : null;

    return {
      required,
      totpEnrolled: input.mfaTotpEnrolled,
      emailOtpEnrolled: input.mfaEmailOtpEnrolled,
      requiresSetup,
      moneyMovementBlocked,
      stepUpFreshUntil,
      lockedUntil: input.mfaLockedUntil?.toISOString() ?? null,
    };
  }

  private parseChallenge(value: unknown): CustomerMfaChallengeRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (
      typeof record.id !== "string" ||
      typeof record.purpose !== "string" ||
      typeof record.method !== "string" ||
      typeof record.expiresAt !== "string"
    ) {
      return null;
    }

    return {
      id: record.id,
      purpose: record.purpose as CustomerMfaChallengePurpose,
      method: record.method as CustomerMfaChallengeMethod,
      codeHash: typeof record.codeHash === "string" ? record.codeHash : null,
      expiresAt: record.expiresAt,
      sentAt: typeof record.sentAt === "string" ? record.sentAt : null,
    };
  }

  private serializeChallenge(
    challenge: CustomerMfaChallengeRecord,
  ): PrismaJsonValue {
    return {
      id: challenge.id,
      purpose: challenge.purpose,
      method: challenge.method,
      codeHash: challenge.codeHash,
      expiresAt: challenge.expiresAt,
      sentAt: challenge.sentAt,
    } as PrismaJsonValue;
  }

  private isEmailOtpPreviewEnabled(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  private assertChallengeActive(
    challenge: CustomerMfaChallengeRecord | null,
    purpose: CustomerMfaChallengePurpose,
    method: CustomerMfaChallengeMethod,
    challengeId?: string,
  ): CustomerMfaChallengeRecord {
    if (!challenge) {
      throw new BadRequestException("No active MFA challenge is available.");
    }

    if (
      challenge.purpose !== purpose ||
      challenge.method !== method ||
      (challengeId && challenge.id !== challengeId)
    ) {
      throw new BadRequestException("MFA challenge details do not match.");
    }

    if (Date.parse(challenge.expiresAt) <= Date.now()) {
      throw new BadRequestException(
        "MFA challenge expired. Start a new challenge.",
      );
    }

    return challenge;
  }

  private assertMoneyMovementEnabled(status: CustomerMfaStatus): void {
    if (status.lockedUntil && Date.parse(status.lockedUntil) > Date.now()) {
      throw new ForbiddenException(
        `Customer MFA is temporarily locked. Try again after ${status.lockedUntil}.`,
      );
    }

    if (status.moneyMovementBlocked) {
      throw new ForbiddenException(
        "Finish authenticator and email MFA setup before using send or withdraw.",
      );
    }
  }

  private assertStepUpFresh(status: CustomerMfaStatus): void {
    this.assertMoneyMovementEnabled(status);

    if (
      !status.stepUpFreshUntil ||
      Date.parse(status.stepUpFreshUntil) <= Date.now()
    ) {
      throw new ForbiddenException(
        "A fresh MFA verification is required before completing this action.",
      );
    }
  }

  private async appendAuditEvent(input: {
    customerId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: PrismaJsonValue;
  }): Promise<void> {
    await this.prismaService.auditEvent.create({
      data: {
        customerId: input.customerId,
        actorType: "customer",
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? input.customerId,
        metadata: input.metadata,
      },
    });
  }

  private assertMfaNotLocked(input: { mfaLockedUntil?: Date | null }): void {
    if (input.mfaLockedUntil && input.mfaLockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        `Customer MFA is temporarily locked. Try again after ${input.mfaLockedUntil.toISOString()}.`,
      );
    }
  }

  private assertChallengeCooldown(input: {
    mfaLastChallengeStartedAt?: Date | null;
  }): void {
    if (
      input.mfaLastChallengeStartedAt &&
      input.mfaLastChallengeStartedAt.getTime() +
        this.challengeStartCooldownMs >
        Date.now()
    ) {
      throw new BadRequestException(
        "Wait before starting another MFA challenge or verification code.",
      );
    }
  }

  private async recordFailedMfaAttempt(input: {
    customerId: string;
    currentFailedAttemptCount: number;
  }): Promise<Date | null> {
    const nextFailedAttemptCount = input.currentFailedAttemptCount + 1;
    const shouldLock = nextFailedAttemptCount >= this.maxFailedAttempts;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + this.lockoutDurationMs)
      : null;

    await this.prismaService.customer.update({
      where: { id: input.customerId },
      data: {
        mfaFailedAttemptCount: shouldLock ? 0 : nextFailedAttemptCount,
        mfaLockedUntil: lockedUntil,
      },
    });

    return lockedUntil;
  }

  private async getCustomerMfaRecordBySupabaseUserId(supabaseUserId: string) {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaTotpSecret: true,
        mfaPendingTotpSecret: true,
        mfaPendingTotpIssuedAt: true,
        mfaActiveChallenge: true,
        mfaLastVerifiedAt: true,
        mfaFailedAttemptCount: true,
        mfaLockedUntil: true,
        mfaLastChallengeStartedAt: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer MFA profile not found.");
    }

    return customer;
  }

  async getCustomerMfaStatus(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<MfaStatusResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);

    return {
      status: "success",
      message: "Customer MFA status retrieved successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(customer),
      },
    };
  }

  async startTotpEnrollment(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<StartTotpEnrollmentResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    this.assertChallengeCooldown(customer);
    const secret = generateBase32Secret();

    await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaPendingTotpSecret: secret,
        mfaPendingTotpIssuedAt: new Date(),
        mfaLastChallengeStartedAt: new Date(),
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_totp_enrollment_started",
      targetType: "Customer",
      metadata: {
        email: customer.email,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "TOTP enrollment initialized successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(customer),
        secret,
        otpAuthUri: buildOtpAuthUri(customer.email, secret),
      },
    };
  }

  async verifyTotpEnrollment(
    supabaseUserId: string,
    code: string,
  ): Promise<CustomJsonResponse<VerifyMfaResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);

    if (
      !customer.mfaPendingTotpSecret ||
      !customer.mfaPendingTotpIssuedAt ||
      customer.mfaPendingTotpIssuedAt.getTime() + this.totpEnrollmentExpiryMs <=
        Date.now()
    ) {
      throw new BadRequestException(
        "TOTP enrollment expired. Start authenticator setup again.",
      );
    }

    if (!verifyTotpCode(customer.mfaPendingTotpSecret, code.trim())) {
      const lockedUntil = await this.recordFailedMfaAttempt({
        customerId: customer.id,
        currentFailedAttemptCount: customer.mfaFailedAttemptCount,
      });
      throw new BadRequestException(
        lockedUntil
          ? `Authenticator code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
          : "Authenticator code is invalid.",
      );
    }

    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaTotpEnrolled: true,
        mfaTotpSecret: customer.mfaPendingTotpSecret,
        mfaPendingTotpSecret: null,
        mfaPendingTotpIssuedAt: null,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
      },
      select: {
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_totp_enrolled",
      targetType: "Customer",
      metadata: {
        email: customer.email,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Authenticator enrolled successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(updatedCustomer),
      },
    };
  }

  async startEmailEnrollment(
    supabaseUserId: string,
  ): Promise<CustomJsonResponse<StartEmailEnrollmentResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    this.assertChallengeCooldown(customer);
    const previewCode = generateEmailOtpCode();
    const challengeId = randomUUID();
    const challenge: CustomerMfaChallengeRecord = {
      id: challengeId,
      purpose: "email_enrollment",
      method: "email_otp",
      codeHash: createOtpHash(previewCode),
      expiresAt: new Date(Date.now() + this.emailOtpExpiryMs).toISOString(),
      sentAt: new Date().toISOString(),
    };

    await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaActiveChallenge: this.serializeChallenge(challenge),
        mfaLastChallengeStartedAt: new Date(),
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_email_enrollment_started",
      targetType: "Customer",
      metadata: {
        challengeId,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Email MFA enrollment challenge created successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(customer),
        challengeId,
        expiresAt: challenge.expiresAt,
        deliveryChannel: "email",
        previewCode: this.isEmailOtpPreviewEnabled() ? previewCode : null,
      },
    };
  }

  async verifyEmailEnrollment(
    supabaseUserId: string,
    challengeId: string,
    code: string,
  ): Promise<CustomJsonResponse<VerifyMfaResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    const challenge = this.assertChallengeActive(
      this.parseChallenge(customer.mfaActiveChallenge),
      "email_enrollment",
      "email_otp",
      challengeId,
    );

    if (
      !challenge.codeHash ||
      !otpHashMatches(code.trim(), challenge.codeHash)
    ) {
      const lockedUntil = await this.recordFailedMfaAttempt({
        customerId: customer.id,
        currentFailedAttemptCount: customer.mfaFailedAttemptCount,
      });
      throw new BadRequestException(
        lockedUntil
          ? `Email verification code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
          : "Email verification code is invalid.",
      );
    }

    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaEmailOtpEnrolled: true,
        mfaActiveChallenge: Prisma.DbNull,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
      },
      select: {
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_email_enrolled",
      targetType: "Customer",
      metadata: {
        challengeId,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "Backup email MFA enrolled successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(updatedCustomer),
      },
    };
  }

  async startMfaChallenge(
    supabaseUserId: string,
    purpose: CustomerMfaChallengePurpose,
    method: CustomerMfaChallengeMethod,
  ): Promise<CustomJsonResponse<StartMfaChallengeResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    this.assertChallengeCooldown(customer);
    const status = this.buildCustomerMfaStatus(customer);
    this.assertMoneyMovementEnabled(status);

    if (
      method === "totp" &&
      (!customer.mfaTotpEnrolled || !customer.mfaTotpSecret)
    ) {
      throw new ForbiddenException("Authenticator MFA is not enrolled.");
    }

    if (method === "email_otp" && !customer.mfaEmailOtpEnrolled) {
      throw new ForbiddenException("Email backup MFA is not enrolled.");
    }

    const previewCode = method === "email_otp" ? generateEmailOtpCode() : null;
    const challengeId = randomUUID();
    const challenge: CustomerMfaChallengeRecord = {
      id: challengeId,
      purpose,
      method,
      codeHash: previewCode ? createOtpHash(previewCode) : null,
      expiresAt: new Date(Date.now() + this.emailOtpExpiryMs).toISOString(),
      sentAt: previewCode ? new Date().toISOString() : null,
    };

    await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaActiveChallenge: this.serializeChallenge(challenge),
        mfaLastChallengeStartedAt: new Date(),
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_challenge_started",
      targetType: "Customer",
      metadata: {
        challengeId,
        purpose,
        method,
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "MFA challenge started successfully.",
      data: {
        mfa: status,
        challengeId,
        method,
        purpose,
        expiresAt: challenge.expiresAt,
        previewCode:
          method === "email_otp" && this.isEmailOtpPreviewEnabled()
            ? previewCode
            : null,
      },
    };
  }

  async verifyMfaChallenge(
    supabaseUserId: string,
    challengeId: string,
    purpose: CustomerMfaChallengePurpose,
    method: CustomerMfaChallengeMethod,
    code: string,
  ): Promise<CustomJsonResponse<VerifyMfaResponseData>> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMfaNotLocked(customer);
    const challenge = this.assertChallengeActive(
      this.parseChallenge(customer.mfaActiveChallenge),
      purpose,
      method,
      challengeId,
    );

    if (method === "totp") {
      if (
        !customer.mfaTotpSecret ||
        !verifyTotpCode(customer.mfaTotpSecret, code.trim())
      ) {
        const lockedUntil = await this.recordFailedMfaAttempt({
          customerId: customer.id,
          currentFailedAttemptCount: customer.mfaFailedAttemptCount,
        });
        throw new BadRequestException(
          lockedUntil
            ? `Authenticator code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
            : "Authenticator code is invalid.",
        );
      }
    } else if (
      !challenge.codeHash ||
      !otpHashMatches(code.trim(), challenge.codeHash)
    ) {
      const lockedUntil = await this.recordFailedMfaAttempt({
        customerId: customer.id,
        currentFailedAttemptCount: customer.mfaFailedAttemptCount,
      });
      throw new BadRequestException(
        lockedUntil
          ? `Email verification code was invalid. MFA is locked until ${lockedUntil.toISOString()}.`
          : "Email verification code is invalid.",
      );
    }

    const verifiedAt = new Date();
    const updatedCustomer = await this.prismaService.customer.update({
      where: { id: customer.id },
      data: {
        mfaLastVerifiedAt: verifiedAt,
        mfaActiveChallenge: Prisma.DbNull,
        mfaFailedAttemptCount: 0,
        mfaLockedUntil: null,
      },
      select: {
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    await this.appendAuditEvent({
      customerId: customer.id,
      actorId: customer.supabaseUserId,
      action: "customer_account.mfa_challenge_verified",
      targetType: "Customer",
      metadata: {
        challengeId,
        purpose,
        method,
        verifiedAt: verifiedAt.toISOString(),
      } as PrismaJsonValue,
    });

    return {
      status: "success",
      message: "MFA challenge verified successfully.",
      data: {
        mfa: this.buildCustomerMfaStatus(updatedCustomer),
      },
    };
  }

  async assertCustomerMoneyMovementEnabled(
    supabaseUserId: string,
  ): Promise<void> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertMoneyMovementEnabled(this.buildCustomerMfaStatus(customer));
  }

  async assertCustomerStepUpFresh(supabaseUserId: string): Promise<void> {
    const customer =
      await this.getCustomerMfaRecordBySupabaseUserId(supabaseUserId);
    this.assertStepUpFresh(this.buildCustomerMfaStatus(customer));
  }

  private signToken(sub: string, email: string): string {
    const { jwtSecret, jwtExpirySeconds } = loadJwtRuntimeConfig();
    return jwt.sign({ sub, email }, jwtSecret, { expiresIn: jwtExpirySeconds });
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException("Email is required.");
    }

    return normalizedEmail;
  }

  private async checkEmailAvailability(email: string): Promise<void> {
    const existing = await this.prismaService.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("Email already in use.");
    }
  }

  private async saveUserToDatabase(
    firstName: string,
    lastName: string,
    email: string,
    userId: string,
    ethereumAccountAddress: string,
  ): Promise<void> {
    try {
      await this.prismaService.user.create({
        data: {
          firstName,
          lastName,
          email,
          supabaseUserId: userId,
          ethereumAddress: ethereumAccountAddress,
        },
      });
    } catch {
      throw new InternalServerErrorException("Failed to save user profile.");
    }
  }

  private async syncCustomerWalletProjection(
    transaction: Prisma.TransactionClient,
    customerAccountId: string,
    ethereumAddress: string,
  ): Promise<void> {
    const walletLookup = {
      chainId_address: {
        chainId: this.productChainId,
        address: ethereumAddress,
      },
    } as const;

    const existingWallet = await transaction.wallet.findUnique({
      where: walletLookup,
    });

    if (
      existingWallet &&
      existingWallet.customerAccountId &&
      existingWallet.customerAccountId !== customerAccountId
    ) {
      throw new Error(
        "Wallet address is already linked to another customer account.",
      );
    }

    if (existingWallet) {
      await transaction.wallet.update({
        where: walletLookup,
        data: {
          customerAccountId,
          kind: WalletKind.embedded,
          custodyType: WalletCustodyType.platform_managed,
          status: WalletStatus.active,
        },
      });

      return;
    }

    await transaction.wallet.create({
      data: {
        customerAccountId,
        chainId: this.productChainId,
        address: ethereumAddress,
        kind: WalletKind.embedded,
        custodyType: WalletCustodyType.platform_managed,
        status: WalletStatus.active,
      },
    });
  }

  private async syncCustomerAccountProjection(
    firstName: string,
    lastName: string,
    email: string,
    supabaseUserId: string,
    ethereumAddress: string,
    passwordHash: string,
  ): Promise<void> {
    try {
      await this.prismaService.$transaction(async (transaction) => {
        const customer = await transaction.customer.upsert({
          where: { email },
          update: {
            supabaseUserId,
            email,
            firstName,
            lastName,
            passwordHash,
          },
          create: {
            supabaseUserId,
            email,
            firstName,
            lastName,
            passwordHash,
          },
        });

        const customerAccount = await transaction.customerAccount.upsert({
          where: { customerId: customer.id },
          update: {},
          create: {
            customerId: customer.id,
            status: AccountLifecycleStatus.registered,
          },
        });

        await this.syncCustomerWalletProjection(
          transaction,
          customerAccount.id,
          ethereumAddress,
        );
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException(
        "Failed to initialize customer account.",
      );
    }
  }

  async ensureSharedLoginAccount(): Promise<SharedLoginBootstrapResult | null> {
    const sharedLoginConfig = loadSharedLoginBootstrapRuntimeConfig();

    if (!sharedLoginConfig.enabled) {
      return null;
    }

    const email = this.normalizeEmail(sharedLoginConfig.email);
    const passwordHash = await bcrypt.hash(sharedLoginConfig.password, 12);

    return this.prismaService.$transaction(async (transaction) => {
      const existingCustomer = await transaction.customer.findUnique({
        where: { email },
        include: {
          accounts: {
            include: {
              wallets: {
                where: { chainId: this.productChainId },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      });
      const legacyUserByEmail = await transaction.user.findUnique({
        where: { email },
      });

      if (
        existingCustomer &&
        existingCustomer.supabaseUserId !== sharedLoginConfig.supabaseUserId
      ) {
        const conflictingCustomer = await transaction.customer.findUnique({
          where: { supabaseUserId: sharedLoginConfig.supabaseUserId },
          select: {
            id: true,
            email: true,
          },
        });

        if (conflictingCustomer && conflictingCustomer.email !== email) {
          throw new InternalServerErrorException(
            "Configured shared login supabase user id is already assigned to another customer.",
          );
        }
      }

      const supabaseUserId =
        existingCustomer?.supabaseUserId ??
        legacyUserByEmail?.supabaseUserId ??
        sharedLoginConfig.supabaseUserId;
      const existingCustomerAccount = existingCustomer?.accounts[0] ?? null;
      const existingWallet = existingCustomerAccount?.wallets[0] ?? null;
      const generatedEthereumAddress = generateEthereumAddress();
      const ethereumAddress =
        legacyUserByEmail?.ethereumAddress?.trim() ||
        existingWallet?.address?.trim() ||
        generatedEthereumAddress.address;

      const customer = await transaction.customer.upsert({
        where: { email },
        update: {
          supabaseUserId,
          email,
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          passwordHash,
        },
        create: {
          supabaseUserId,
          email,
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          passwordHash,
        },
      });

      const customerAccount = await transaction.customerAccount.upsert({
        where: { customerId: customer.id },
        update: {},
        create: {
          customerId: customer.id,
          status: AccountLifecycleStatus.registered,
        },
      });

      await this.syncCustomerWalletProjection(
        transaction,
        customerAccount.id,
        ethereumAddress,
      );

      const legacyUser = await transaction.user.upsert({
        where: { email },
        update: {
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          email,
          supabaseUserId,
          ethereumAddress,
        },
        create: {
          firstName: sharedLoginConfig.firstName,
          lastName: sharedLoginConfig.lastName,
          email,
          supabaseUserId,
          ethereumAddress,
        },
      });

      return {
        customerId: customer.id,
        customerAccountId: customerAccount.id,
        supabaseUserId,
        email,
        ethereumAddress,
        createdLegacyUser: legacyUserByEmail === null,
        createdCustomer: existingCustomer === null,
        createdCustomerAccount: existingCustomerAccount === null,
      };
    });
  }

  async getCustomerWalletProjectionBySupabaseUserId(
    supabaseUserId: string,
  ): Promise<CustomerWalletProjection> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: { supabaseUserId },
      },
      include: {
        wallets: {
          where: { chainId: this.productChainId },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account not found.");
    }

    const wallet = customerAccount.wallets[0];

    if (!wallet) {
      throw new NotFoundException("Customer wallet projection not found.");
    }

    return {
      wallet: {
        id: wallet.id,
        customerAccountId: wallet.customerAccountId,
        chainId: wallet.chainId,
        address: wallet.address,
        kind: wallet.kind,
        custodyType: wallet.custodyType,
        status: wallet.status,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    };
  }

  async getUserFromDatabaseById(
    supabaseUserId: string,
  ): Promise<LegacyUserRecord | null> {
    return this.prismaService.user.findFirst({
      where: { supabaseUserId },
    });
  }

  async getCustomerAccountProjectionBySupabaseUserId(
    supabaseUserId: string,
  ): Promise<CustomerAccountProjection> {
    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      include: { accounts: true },
    });

    if (!customer) {
      throw new NotFoundException("Customer projection not found.");
    }

    const customerAccount = customer.accounts[0];

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    return {
      customer: {
        id: customer.id,
        supabaseUserId: customer.supabaseUserId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        passwordHash: customer.passwordHash,
        mfaRequired: customer.mfaRequired,
        mfaTotpEnrolled: customer.mfaTotpEnrolled,
        mfaEmailOtpEnrolled: customer.mfaEmailOtpEnrolled,
        mfaLastVerifiedAt: customer.mfaLastVerifiedAt,
        mfaLockedUntil: customer.mfaLockedUntil,
        depositEmailNotificationsEnabled:
          customer.depositEmailNotificationsEnabled,
        withdrawalEmailNotificationsEnabled:
          customer.withdrawalEmailNotificationsEnabled,
        loanEmailNotificationsEnabled: customer.loanEmailNotificationsEnabled,
        productUpdateEmailNotificationsEnabled:
          customer.productUpdateEmailNotificationsEnabled,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      customerAccount: {
        id: customerAccount.id,
        status: customerAccount.status,
        activatedAt: customerAccount.activatedAt,
        restrictedAt: customerAccount.restrictedAt,
        frozenAt: customerAccount.frozenAt,
        closedAt: customerAccount.closedAt,
        createdAt: customerAccount.createdAt,
        updatedAt: customerAccount.updatedAt,
      },
    };
  }

  async validateToken(token: string): Promise<{ id: string; email: string }> {
    try {
      const { jwtSecret } = loadJwtRuntimeConfig();
      const payload = jwt.verify(token, jwtSecret);

      if (typeof payload === "string") {
        throw new UnauthorizedException("Invalid or expired token.");
      }

      const sub = payload["sub"];
      const email = payload["email"];

      if (typeof sub !== "string" || typeof email !== "string") {
        throw new UnauthorizedException("Invalid or expired token.");
      }

      return { id: sub, email };
    } catch {
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }

  async updatePassword(
    supabaseUserId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<CustomJsonResponse<UpdatePasswordResponseData>> {
    if (newPassword === currentPassword) {
      throw new BadRequestException(
        "New password must be different from the current password.",
      );
    }

    const customer = await this.prismaService.customer.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        supabaseUserId: true,
        passwordHash: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    if (!customer?.passwordHash) {
      throw new BadRequestException(
        "Password rotation is not available for this account.",
      );
    }

    this.assertStepUpFresh(this.buildCustomerMfaStatus(customer));

    const passwordValid = await bcrypt.compare(
      currentPassword,
      customer.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.prismaService.$transaction(async (transaction) => {
      await transaction.customer.update({
        where: { id: customer.id },
        data: {
          passwordHash: nextPasswordHash,
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: customer.id,
          actorType: "customer",
          actorId: customer.supabaseUserId,
          action: "customer_account.password_rotated",
          targetType: "Customer",
          targetId: customer.id,
          metadata: {
            passwordRotationAvailable: true,
          } as PrismaJsonValue,
        },
      });
    });

    return {
      status: "success",
      message: "Password updated successfully.",
      data: {
        passwordRotationAvailable: true,
      },
    };
  }

  async signUp(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<CustomJsonResponse<SignUpResponseData>> {
    const normalizedEmail = this.normalizeEmail(email);

    await this.checkEmailAvailability(normalizedEmail);

    const authUserId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const generatedEthereumAddress = generateEthereumAddress();

    await this.saveUserToDatabase(
      firstName,
      lastName,
      normalizedEmail,
      authUserId,
      generatedEthereumAddress.address,
    );

    await this.syncCustomerAccountProjection(
      firstName,
      lastName,
      normalizedEmail,
      authUserId,
      generatedEthereumAddress.address,
      passwordHash,
    );

    return {
      status: "success",
      message: "User signed up successfully.",
      data: {
        user: {
          id: authUserId,
          email: normalizedEmail,
          firstName,
          lastName,
          ethereumAddress: generatedEthereumAddress.address,
        },
      },
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<CustomJsonResponse<LoginResponseData>> {
    const normalizedEmail = this.normalizeEmail(email);
    const customer = await this.prismaService.customer.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        supabaseUserId: true,
        email: true,
        passwordHash: true,
        mfaRequired: true,
        mfaTotpEnrolled: true,
        mfaEmailOtpEnrolled: true,
        mfaLastVerifiedAt: true,
        mfaLockedUntil: true,
      },
    });

    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordValid = await bcrypt.compare(password, customer.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const user = await this.getUserFromDatabaseById(customer.supabaseUserId);

    if (!user) {
      throw new InternalServerErrorException("User profile not found.");
    }

    const token = this.signToken(customer.supabaseUserId, customer.email);

    return {
      status: "success",
      message: "User logged in successfully.",
      data: {
        token,
        user: {
          id: user.id,
          supabaseUserId: customer.supabaseUserId,
          email: user.email,
          ethereumAddress: user.ethereumAddress ?? "",
          firstName: user.firstName,
          lastName: user.lastName,
          mfa: this.buildCustomerMfaStatus(customer),
        },
      },
    };
  }
}
