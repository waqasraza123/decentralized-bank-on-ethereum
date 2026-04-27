import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ReleaseReadinessEnvironment } from "@prisma/client";
import { loadGovernedCustodyRuntimeConfig } from "@stealth-trails-bank/config/api";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";

function mapReleaseEnvironment(
  environment: string
): ReleaseReadinessEnvironment {
  switch (environment) {
    case "staging":
      return ReleaseReadinessEnvironment.staging;
    case "production_like":
      return ReleaseReadinessEnvironment.production_like;
    case "production":
      return ReleaseReadinessEnvironment.production;
    default:
      return ReleaseReadinessEnvironment.development;
  }
}

function resolveAllowedMethods(scope: string): string[] {
  switch (scope) {
    case "staking_execution":
      return [
        "bindPositionBeneficiary",
        "recordDeposit",
        "recordWithdrawal",
        "recordRewardAccrual",
        "claimReward"
      ];
    case "loan_execution":
      return [
        "createAgreement",
        "lockCollateral",
        "fundAgreement",
        "recordRepayment",
        "startGracePeriod",
        "markDefaulted",
        "startLiquidationReview",
        "approveLiquidation",
        "executeLiquidation",
        "releaseCollateral",
        "closeAgreement"
      ];
    case "policy_withdrawal_authorization":
      return ["signWithdrawalAuthorization"];
    case "policy_withdrawal_executor":
      return ["executeAuthorizedTransfer"];
    case "solvency_anchor_execution":
      return ["anchorSolvencyReport"];
    default:
      return [];
  }
}

@Injectable()
export class GovernedCustodyManifestSyncService implements OnModuleInit {
  private readonly logger = new Logger(GovernedCustodyManifestSyncService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async onModuleInit(): Promise<void> {
    let manifest;

    try {
      manifest = loadGovernedCustodyRuntimeConfig();
    } catch (error) {
      this.logger.warn(
        `Governed custody manifest sync skipped during bootstrap: ${error instanceof Error ? error.message : "unknown error"}.`
      );
      return;
    }

    if (!manifest) {
      this.logger.log(
        "Governed custody manifest sync skipped because no manifest is configured."
      );
      return;
    }

    const environment = mapReleaseEnvironment(manifest.releaseEnvironment);
    const manifestPayload = manifest.rawManifest as PrismaJsonValue;

    await this.prismaService.$transaction(async (transaction) => {
      await transaction.contractDeploymentManifest.deleteMany({
        where: {
          environment,
          chainId: manifest.chainId
        }
      });
      await transaction.governedSignerInventory.deleteMany({
        where: {
          environment,
          chainId: manifest.chainId
        }
      });
      await transaction.governanceAuthorityManifest.deleteMany({
        where: {
          environment,
          chainId: manifest.chainId
        }
      });

      const authorityIds = new Map<string, string>();

      for (const authority of manifest.authorities) {
        const createdAuthority =
          await transaction.governanceAuthorityManifest.create({
            data: {
              environment,
              chainId: authority.chainId,
              authorityType: authority.authorityType,
              address: authority.address,
              manifestStatus: "active",
              manifestPayload: authority as unknown as PrismaJsonValue
            }
          });

        authorityIds.set(authority.authorityType, createdAuthority.id);
      }

      if (manifest.signers.length > 0) {
        await transaction.governedSignerInventory.createMany({
          data: manifest.signers.map((signer) => ({
            environment,
            chainId: manifest.chainId,
            signerScope: signer.scope,
            backendKind: "kms",
            keyReference: signer.keyReference,
            signerAddress: signer.signerAddress,
            allowedMethods: resolveAllowedMethods(signer.scope),
            manifestVersion: null,
            environmentBinding: manifest.releaseEnvironment,
            active: true
          }))
        });
      }

      if (manifest.contracts.length > 0) {
        await transaction.contractDeploymentManifest.createMany({
          data: manifest.contracts.map((contract) => ({
            environment,
            chainId: manifest.chainId,
            productSurface: contract.productSurface,
            contractVersion: contract.version,
            contractAddress: contract.address,
            abiChecksumSha256: contract.abiChecksumSha256,
            manifestStatus: "active",
            legacyPath: contract.legacyPath,
            governanceAuthorityId:
              authorityIds.get("governance_safe") ?? null,
            treasuryAuthorityId: authorityIds.get("treasury_safe") ?? null,
            emergencyAuthorityId: authorityIds.get("emergency_safe") ?? null,
            deploymentManifestPayload: {
              contract,
              authorities: manifest.authorities,
              signers: manifest.signers
            } as unknown as PrismaJsonValue
          }))
        });
      }
    });

    this.logger.log(
      `Synced governed custody manifest for ${environment} chain ${manifest.chainId}.`
    );
  }
}
