import { Injectable } from "@nestjs/common";
import { loadBlockchainContractWriteRuntimeConfig } from "@stealth-trails-bank/config/api";
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
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly wallet: ethers.Wallet;
  private readonly stakingContract: ethers.Contract;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService
  ) {
    const runtimeConfig = loadBlockchainContractWriteRuntimeConfig();

    this.provider = new ethers.providers.JsonRpcProvider(runtimeConfig.rpcUrl);
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

  async createPool(rewardRate: number) {
    return createPool(
      this.stakingContract,
      this.prismaService,
      rewardRate
    );
  }

  async deposit(poolId: number, amount: string, supabaseUserId: string) {
    return deposit(
      this.stakingContract,
      this.prismaService,
      this.authService,
      poolId,
      amount,
      supabaseUserId
    );
  }

  async withdraw(poolId: number, amount: string, supabaseUserId: string) {
    return withdraw(
      this.stakingContract,
      this.prismaService,
      this.authService,
      poolId,
      amount,
      supabaseUserId
    );
  }

  async claimReward(databasePoolId: number) {
    return claimReward(
      this.stakingContract,
      this.prismaService,
      databasePoolId
    );
  }

  async emergencyWithdraw(databasePoolId: number) {
    return emergencyWithdraw(
      this.stakingContract,
      this.prismaService,
      databasePoolId
    );
  }

  async getStakedBalance(address: string, databasePoolId: number) {
    return getStakedBalance(
      this.stakingContract,
      this.prismaService,
      address,
      databasePoolId
    );
  }

  async getPendingReward(address: string, databasePoolId: number) {
    return getPendingReward(
      this.stakingContract,
      this.prismaService,
      address,
      databasePoolId
    );
  }

  async getTotalStaked(databasePoolId: number) {
    return getTotalStaked(
      this.stakingContract,
      this.prismaService,
      databasePoolId
    );
  }
}
