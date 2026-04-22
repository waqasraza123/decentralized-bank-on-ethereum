CREATE TYPE "CustomerAgeVerificationStatus" AS ENUM (
  'unverified',
  'self_attested',
  'verified',
  'rejected'
);

CREATE TYPE "CustomerTrustedContactKind" AS ENUM (
  'trusted_contact',
  'beneficiary'
);

CREATE TYPE "CustomerTrustedContactStatus" AS ENUM (
  'active',
  'removed'
);

ALTER TABLE "Customer"
ADD COLUMN "dateOfBirth" DATE,
ADD COLUMN "ageVerificationStatus" "CustomerAgeVerificationStatus" NOT NULL DEFAULT 'unverified',
ADD COLUMN "ageVerifiedAt" TIMESTAMP(3),
ADD COLUMN "ageVerifiedByOperatorId" TEXT,
ADD COLUMN "ageVerificationNote" TEXT;

CREATE TABLE "CustomerTrustedContact" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "kind" "CustomerTrustedContactKind" NOT NULL DEFAULT 'trusted_contact',
  "status" "CustomerTrustedContactStatus" NOT NULL DEFAULT 'active',
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "relationshipLabel" TEXT NOT NULL,
  "email" TEXT,
  "phoneNumber" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerTrustedContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerTrustedContact_customerId_status_kind_idx"
ON "CustomerTrustedContact"("customerId", "status", "kind");

CREATE INDEX "CustomerTrustedContact_customerId_createdAt_idx"
ON "CustomerTrustedContact"("customerId", "createdAt");

ALTER TABLE "CustomerTrustedContact"
ADD CONSTRAINT "CustomerTrustedContact_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
