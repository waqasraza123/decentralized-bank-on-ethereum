import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { StakingService } from './staking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomJsonResponse } from '../types/CustomJsonResponse';
import * as Joi from 'joi';
import { JoiPipe } from 'nestjs-joi';
import { ParseIntPipe } from '@nestjs/common';

const createPoolSchema = Joi.object({
  rewardRate: Joi.number().positive().required(),
});

const depositSchema = Joi.object({
  poolId: Joi.number().integer().positive().required(),
  amount: Joi.string().regex(/^\d+(\.\d+)?$/).required(),
});

const withdrawSchema = depositSchema;

const poolIdSchema = Joi.object({
  poolId: Joi.number().integer().positive().required(),
});

const addressPoolSchema = Joi.object({
  address: Joi.string().required(),
  poolId: Joi.number().integer().positive().required(),
});

@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) { }

  @Post('create-pool')
  async createPool(@Body(new JoiPipe(createPoolSchema)) body: { rewardRate: number }) {
    return this.stakingService.createPool(body.rewardRate);
  }

  @UseGuards(JwtAuthGuard)
  @Post('deposit')
  async deposit(@Req() req: any, @Body(new JoiPipe(depositSchema)) body: { poolId: number; amount: string }): Promise<CustomJsonResponse> {
    const supabaseUserId = req.user.id;
    return this.stakingService.deposit(body.poolId, body.amount, supabaseUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('withdraw')
  async withdraw(@Req() req: any, @Body(new JoiPipe(withdrawSchema)) body: { poolId: number; amount: string }) {
    const supabaseUserId = req.user.id;
    return this.stakingService.withdraw(body.poolId, body.amount, supabaseUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('claim-reward')
  async claimReward(@Req() req: any, @Body(new JoiPipe(poolIdSchema)) body: { poolId: number }) {
    return this.stakingService.claimReward(body.poolId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('emergency-withdraw')
  async emergencyWithdraw(@Req() req: any, @Body(new JoiPipe(poolIdSchema)) body: { poolId: number }) {
    return this.stakingService.emergencyWithdraw(body.poolId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('staked-balance/:address/:poolId')
  async getStakedBalance(
    @Req() req: any,
    @Param('address') address: string,
    @Param('poolId', ParseIntPipe) poolId: number
  ) {
    return this.stakingService.getStakedBalance(address, poolId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pending-reward/:address/:poolId')
  async getPendingReward(
    @Req() req: any,
    @Param('address') address: string,
    @Param('poolId', ParseIntPipe) poolId: number
  ) {
    return this.stakingService.getPendingReward(address, poolId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('total-staked/:poolId')
  async getTotalStaked(@Req() req: any, @Param('poolId', ParseIntPipe) poolId: number) {
    return this.stakingService.getTotalStaked(poolId);
  }
}
