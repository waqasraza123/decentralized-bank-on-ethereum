ALTER TYPE "ReleaseReadinessEvidenceType"
ADD VALUE IF NOT EXISTS 'contract_invariant_suite';

ALTER TYPE "ReleaseReadinessEvidenceType"
ADD VALUE IF NOT EXISTS 'backend_integration_suite';

ALTER TYPE "ReleaseReadinessEvidenceType"
ADD VALUE IF NOT EXISTS 'end_to_end_finance_flows';

ALTER TYPE "ReleaseReadinessEvidenceType"
ADD VALUE IF NOT EXISTS 'secret_handling_review';

ALTER TYPE "ReleaseReadinessEvidenceType"
ADD VALUE IF NOT EXISTS 'role_review';

ALTER TYPE "ReleaseReadinessEnvironment"
ADD VALUE IF NOT EXISTS 'development';

ALTER TYPE "ReleaseReadinessEnvironment"
ADD VALUE IF NOT EXISTS 'ci';
