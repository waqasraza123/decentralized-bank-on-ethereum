import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EthereumService implements OnModuleInit {
  private provider: ethers.providers.Provider;
  private stakingContract: ethers.Contract;

  private readonly stakingContractABI = [
    'event PoolCreated(uint256 poolId, uint256 rewardRate, uint256 externalPoolId)',
    'event Deposited(address indexed user, uint256 poolId, uint256 amount)',
  ];

  constructor(private readonly prismaService: PrismaService) {
    const rpcUrl = process.env.RPC_URL;
    const stakingContractAddress = process.env.STAKING_CONTRACT_ADDRESS;

    if (!rpcUrl || !stakingContractAddress) {
      throw new Error(
        'EthereumService requires RPC_URL and STAKING_CONTRACT_ADDRESS',
      );
    }

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    this.stakingContract = new ethers.Contract(
      stakingContractAddress,
      this.stakingContractABI,
      this.provider,
    );
  }

  onModuleInit() {
    this.listenToEvents();
  }

  private listenToEvents() {
    this.stakingContract.on(
      'PoolCreated',
      async (poolId, rewardRate, externalPoolId) => {
        console.log(
          `New pool created: ID=${poolId.toString()}, Reward Rate=${rewardRate.toString()}`,
        );
        console.log(`External Pool ID: ${externalPoolId.toString()}`);

        try {
          await this.prismaService.stakingPool.update({
            where: { id: externalPoolId.toNumber() },
            data: {
              blockchainPoolId: poolId.toNumber(),
            },
          });
          console.log(
            `Database updated with blockchainPoolId: ${poolId.toString()}`,
          );
        } catch (error) {
          console.error('Error updating the database:', error);
        }
      },
    );

    this.stakingContract.on(
      'Deposited',
      async (userAddress, poolId, amount) => {
        console.log(
          `New deposit: User ${userAddress}, Pool ID: ${poolId}, Amount: ${amount.toString()}`,
        );
      },
    );

    console.log('Listening for PoolCreated and Deposited events...');
  }
}
