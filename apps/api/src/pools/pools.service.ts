import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StakingPool, PoolStatus } from '@prisma/client';

@Injectable()
export class PoolsService {
    constructor(private readonly prismaService: PrismaService) { }

    async getPools(status?: string): Promise<any[]> {
        const filters: { poolStatus?: PoolStatus } = {};
        if (status) {
            filters.poolStatus = status as PoolStatus;
        }

        const pools = await this.prismaService.stakingPool.findMany({
            where: filters,
            orderBy: {
                createdAt: 'desc',
            },
        });

        return pools.map(pool => ({
            ...pool,
            totalStakedAmount: pool.totalStakedAmount.toString(),
            totalRewardsPaid: pool.totalRewardsPaid.toString(),
        }));
    }

    async getPoolById(poolId: number): Promise<StakingPool | null> {
        return this.prismaService.stakingPool.findUnique({
            where: {
                id: poolId,
            },
        });
    }

    async createPool(rewardRate: number): Promise<StakingPool> {
        return this.prismaService.stakingPool.create({
            data: {
                rewardRate,
                totalStakedAmount: 0n,
                totalRewardsPaid: 0n,
                poolStatus: PoolStatus.disabled,
            },
        });
    }

    async updatePoolStatus(poolId: number, status: PoolStatus): Promise<StakingPool> {
        return this.prismaService.stakingPool.update({
            where: {
                id: poolId,
            },
            data: {
                poolStatus: status,
            },
        });
    }

}
