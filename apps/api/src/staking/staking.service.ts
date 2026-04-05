import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { loadOptionalBlockchainContractWriteRuntimeConfig } from "@stealth-trails-bank/config/api";
import { ethers } from "ethers";
import stakingAbi from "../abis/staking.abi.json";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { claimReward } from "./methods/claimReward";
import { createPool } from "./methods/createPool";
import { deposit } from "./methods/deposit";
import { emergencyWithdraw } from "./methods/emergencyWithdraw";
import { getPendingReward } from "./methods/getPendingReward";
import { getStakedBalance } from "./methods/getStakedBalance";
import { getTotalStaked } from "./methods/getTotalStaked";
import { withdraw } from "./methods/withdraw";

@Injectable()
export class StakingService {
  private readonly logger = new Logger(StakingService.name);
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly wallet: ethers.Wallet | null;
  private readonly stakingContract: ethers.Contract | null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService
  ) {
    const runtimeConfig = loadOptionalBlockchainContractWriteRuntimeConfig();

    this.provider = new ethers.providers.JsonRpcProvider(runtimeConfig.rpcUrl);

    if (
      !runtimeConfig.stakingContractAddress ||
      !runtimeConfig.ethereumPrivateKey
    ) {
      if (runtimeConfig.environment === "production") {
        throw new Error(
          "STAKING_CONTRACT_ADDRESS and ETHEREUM_PRIVATE_KEY are required in production when staking write operations are enabled."
        );
      }

      this.wallet = null;
      this.stakingContract = null;
      this.logger.warn(
        "Staking write operations are disabled because contract or signer configuration is missing."
      );
      return;
    }

    this.wallet = new ethers.Wallet(
      runtimeConfig.ethereumPrivateKey,
      this.provider
    );
    this.stakingContract = new ethers.Contract(
      runtimeConfig.stakingContractAddress,
      stakingAbi,
      this.wallet
    );
  }

  private requireStakingContract(): ethers.Contract {
    if (!this.stakingContract) {
      throw new ServiceUnavailableException(
        "Staking integration is not configured in this environment."
      );
    }

    return this.stakingContract;
  }

  async createPool(rewardRate: number) {
    const stakingContract = this.requireStakingContract();
    return createPool(
      stakingContract,
      this.prismaService,
      rewardRate
    );
  }

  async deposit(poolId: number, amount: string, supabaseUserId: string) {
    const stakingContract = this.requireStakingContract();
    return deposit(
      stakingContract,
      this.prismaService,
      this.authService,
      poolId,
      amount,
      supabaseUserId
    );
  }

  async withdraw(poolId: number, amount: string, supabaseUserId: string) {
    const stakingContract = this.requireStakingContract();
    return withdraw(
      stakingContract,
      this.prismaService,
      this.authService,
      poolId,
      amount,
      supabaseUserId
    );
  }

  async claimReward(databasePoolId: number) {
    const stakingContract = this.requireStakingContract();
    return claimReward(
      stakingContract,
      this.prismaService,
      databasePoolId
    );
  }

  async emergencyWithdraw(databasePoolId: number) {
    const stakingContract = this.requireStakingContract();
    return emergencyWithdraw(
      stakingContract,
      this.prismaService,
      databasePoolId
    );
  }

  async getStakedBalance(address: string, databasePoolId: number) {
    const stakingContract = this.requireStakingContract();
    return getStakedBalance(
      stakingContract,
      this.prismaService,
      address,
      databasePoolId
    );
  }

  async getPendingReward(address: string, databasePoolId: number) {
    const stakingContract = this.requireStakingContract();
    return getPendingReward(
      stakingContract,
      this.prismaService,
      address,
      databasePoolId
    );
  }

  async getTotalStaked(databasePoolId: number) {
    const stakingContract = this.requireStakingContract();
    return getTotalStaked(
      stakingContract,
      this.prismaService,
      databasePoolId
    );
  }
}
