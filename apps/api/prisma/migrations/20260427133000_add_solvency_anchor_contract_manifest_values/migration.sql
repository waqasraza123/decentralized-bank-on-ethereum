ALTER TYPE "GovernedSignerScope"
ADD VALUE IF NOT EXISTS 'solvency_anchor_execution';

ALTER TYPE "ContractProductSurface"
ADD VALUE IF NOT EXISTS 'solvency_report_anchor_registry_v1';
