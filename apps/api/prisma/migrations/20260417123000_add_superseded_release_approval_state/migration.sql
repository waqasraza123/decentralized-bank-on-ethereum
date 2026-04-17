ALTER TYPE "ReleaseReadinessApprovalStatus" ADD VALUE 'superseded';

ALTER TABLE "ReleaseReadinessApproval"
ADD COLUMN "supersededByOperatorId" TEXT,
ADD COLUMN "supersededByOperatorRole" TEXT,
ADD COLUMN "supersededAt" TIMESTAMP(3);
