CREATE TABLE "ReleaseLaunchClosurePack" (
  "id" TEXT NOT NULL,
  "releaseIdentifier" TEXT NOT NULL,
  "environment" "ReleaseReadinessEnvironment" NOT NULL,
  "version" INTEGER NOT NULL,
  "generatedByOperatorId" TEXT NOT NULL,
  "generatedByOperatorRole" TEXT,
  "artifactChecksumSha256" TEXT NOT NULL,
  "artifactPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReleaseLaunchClosurePack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReleaseLaunchClosurePack_releaseIdentifier_environment_version_key"
ON "ReleaseLaunchClosurePack"("releaseIdentifier", "environment", "version");

CREATE INDEX "ReleaseLaunchClosurePack_releaseIdentifier_environment_createdAt_idx"
ON "ReleaseLaunchClosurePack"("releaseIdentifier", "environment", "createdAt");

CREATE INDEX "ReleaseLaunchClosurePack_generatedByOperatorId_createdAt_idx"
ON "ReleaseLaunchClosurePack"("generatedByOperatorId", "createdAt");
