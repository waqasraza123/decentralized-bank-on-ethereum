import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { loadOptionalBlockchainContractReadRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  createJsonRpcProvider,
  createStakingEventContract
} from "@stealth-trails-bank/contracts-sdk";
import { ethers } from "ethers";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EthereumService implements OnModuleInit {
  private readonly logger = new Logger(EthereumService.name);
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly stakingContract: ethers.Contract | null;

  constructor(private readonly prismaService: PrismaService) {
    const runtimeConfig = loadOptionalBlockchainContractReadRuntimeConfig();

    this.provider = createJsonRpcProvider(runtimeConfig.rpcUrl);

    if (!runtimeConfig.stakingContractAddress) {
      if (runtimeConfig.environment === "production") {
        throw new Error(
          "STAKING_CONTRACT_ADDRESS is required in production when Ethereum event listeners are enabled."
        );
      }

      this.stakingContract = null;
      this.logger.warn(
        "Ethereum staking event listeners are disabled because STAKING_CONTRACT_ADDRESS is not configured."
      );
      return;
    }

    this.stakingContract = createStakingEventContract(
      runtimeConfig.stakingContractAddress,
      this.provider
    );
  }

  onModuleInit(): void {
    if (!this.stakingContract) {
      return;
    }

    this.listenToEvents();
  }

  private listenToEvents(): void {
    if (!this.stakingContract) {
      return;
    }

    this.stakingContract.on(
      "PoolCreated",
      async (
        poolId: ethers.BigNumber,
        _rewardRate: ethers.BigNumber,
        externalPoolId: ethers.BigNumber
      ) => {
        await this.prismaService.stakingPool.update({
          where: {
            id: externalPoolId.toNumber()
          },
          data: {
            blockchainPoolId: poolId.toNumber()
          }
        });
      }
    );

    this.stakingContract.on(
      "Deposited",
      (
        user: string,
        poolId: ethers.BigNumber,
        amount: ethers.BigNumber
      ) => {
        console.log("Deposited event received", {
          user,
          poolId: poolId.toNumber(),
          amount: amount.toString()
        });
      }
    );
  }
}
