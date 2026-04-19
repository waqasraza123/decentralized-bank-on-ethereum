-- CreateEnum
CREATE TYPE "CustomerAuthSessionPlatform" AS ENUM ('web', 'mobile', 'unknown');

-- CreateEnum
CREATE TYPE "CustomerAuthSessionRevocationReason" AS ENUM (
  'revoke_all',
  'password_rotation',
  'mfa_enrollment',
  'mfa_recovery',
  'operator_mfa_recovery',
  'session_revoked'
);

-- CreateTable
CREATE TABLE "CustomerAuthSession" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL,
  "clientPlatform" "CustomerAuthSessionPlatform" NOT NULL DEFAULT 'unknown',
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" "CustomerAuthSessionRevocationReason",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerAuthSession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomerAuthSession"
ADD CONSTRAINT "CustomerAuthSession_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CustomerAuthSession_customerId_revokedAt_idx"
ON "CustomerAuthSession"("customerId", "revokedAt");

-- CreateIndex
CREATE INDEX "CustomerAuthSession_customerId_createdAt_idx"
ON "CustomerAuthSession"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerAuthSession_customerId_lastSeenAt_idx"
ON "CustomerAuthSession"("customerId", "lastSeenAt");
