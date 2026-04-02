ALTER TABLE "ReviewCase"
ADD COLUMN IF NOT EXISTS "assignedOperatorId" TEXT,
ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ReviewCaseEventType'
  ) THEN
    CREATE TYPE "ReviewCaseEventType" AS ENUM (
      'opened',
      'started',
      'note_added',
      'handed_off',
      'resolved',
      'dismissed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ReviewCaseEvent" (
  "id" TEXT NOT NULL,
  "reviewCaseId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "eventType" "ReviewCaseEventType" NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReviewCaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReviewCase_reasonCode_idx"
ON "ReviewCase"("reasonCode");

CREATE INDEX IF NOT EXISTS "ReviewCase_status_assignedOperatorId_idx"
ON "ReviewCase"("status", "assignedOperatorId");

CREATE INDEX IF NOT EXISTS "ReviewCaseEvent_reviewCaseId_createdAt_idx"
ON "ReviewCaseEvent"("reviewCaseId", "createdAt");

CREATE INDEX IF NOT EXISTS "ReviewCaseEvent_eventType_createdAt_idx"
ON "ReviewCaseEvent"("eventType", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReviewCaseEvent_reviewCaseId_fkey'
  ) THEN
    ALTER TABLE "ReviewCaseEvent"
    ADD CONSTRAINT "ReviewCaseEvent_reviewCaseId_fkey"
    FOREIGN KEY ("reviewCaseId")
    REFERENCES "ReviewCase"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;
