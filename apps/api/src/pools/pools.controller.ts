import { Controller, Get, Param, Query, Post, Body, UseGuards } from '@nestjs/common';
import { PoolsService } from './pools.service';
import { SupabaseAuthGuard } from '../supabase/supabase-auth.guard';
import { CustomJsonResponse } from '../types/CustomJsonResponse';
import { PoolStatus } from '@prisma/client';
import { ParseIntPipe } from '@nestjs/common';

@Controller('pools')
export class PoolsController {
    constructor(private readonly poolsService: PoolsService) { }

    @UseGuards(SupabaseAuthGuard)
    @Get()
    async getPools(@Query('status') status: string | undefined): Promise<CustomJsonResponse> {
        try {
            const pools = await this.poolsService.getPools(status);
            return {
                status: 'success',
                data: pools,
                message: 'Pools fetched successfully',
            };
        } catch (error: any) {
            return {
                status: 'failed',
                error: error instanceof Error ? { message: error.message } : error,
                message: 'Failed to fetch pools',
            };
        }
    }

    @Get(':poolId')
    async getPoolById(@Param('poolId', ParseIntPipe) poolId: number): Promise<CustomJsonResponse> {
        try {
            const pool = await this.poolsService.getPoolById(poolId);
            if (!pool) {
                return {
                    status: 'failed',
                    message: 'Pool not found',
                };
            }
            return {
                status: 'success',
                data: pool,
                message: 'Pool fetched successfully',
            };
        } catch (error: any) {
            return {
                status: 'failed',
                error: error instanceof Error ? { message: error.message } : error,
                message: 'Failed to fetch pool',
            };
        }
    }

    @Post('create')
    async createPool(@Body() body: { rewardRate: number }): Promise<CustomJsonResponse> {
        try {
            const { rewardRate } = body;
            const newPool = await this.poolsService.createPool(rewardRate);
            return {
                status: 'success',
                data: newPool,
                message: 'Pool created successfully',
            };
        } catch (error: any) {
            return {
                status: 'failed',
                error: error instanceof Error ? { message: error.message } : error,
                message: 'Failed to create pool',
            };
        }
    }

    @Post(':poolId/update-status')
    @UseGuards(SupabaseAuthGuard)
    async updatePoolStatus(
        @Param('poolId', ParseIntPipe) poolId: number,
        @Body() body: { status: PoolStatus }
    ): Promise<CustomJsonResponse> {
        try {
            const { status } = body;
            const updatedPool = await this.poolsService.updatePoolStatus(poolId, status);
            return {
                status: 'success',
                data: updatedPool,
                message: 'Pool status updated successfully',
            };
        } catch (error: any) {
            return {
                status: 'failed',
                error: error instanceof Error ? { message: error.message } : error,
                message: 'Failed to update pool status',
            };
        }
    }
}
