ALTER TABLE "ContractDeploymentManifest"
ADD COLUMN "deploymentTxHash" TEXT,
ADD COLUMN "governanceOwner" TEXT,
ADD COLUMN "authorizedAnchorer" TEXT,
ADD COLUMN "blockExplorerUrl" TEXT,
ADD COLUMN "anchoredSmokeTxHash" TEXT;

CREATE INDEX "ContractDeploymentManifest_deploymentTxHash_idx"
ON "ContractDeploymentManifest"("deploymentTxHash");

CREATE INDEX "ContractDeploymentManifest_authorizedAnchorer_idx"
ON "ContractDeploymentManifest"("authorizedAnchorer");
