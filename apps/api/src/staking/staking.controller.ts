import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import * as Joi from "joi";
import { JoiPipe } from "nestjs-joi";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { StakingPoolGovernanceService } from "./staking-pool-governance.service";
import { StakingService } from "./staking.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

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

@Controller("staking")
export class StakingController {
  constructor(
    private readonly stakingService: StakingService,
    private readonly stakingPoolGovernanceService: StakingPoolGovernanceService
  ) {}

  @UseGuards(InternalOperatorApiKeyGuard)
  @Post("create-pool")
  async createPool(
    @Req() request: InternalOperatorRequest,
    @Body(new JoiPipe(createPoolSchema)) body: { rewardRate: number }
  ) {
    const result = await this.stakingPoolGovernanceService.createRequest(
      {
        rewardRate: body.rewardRate
      },
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message:
        "Staking pool governance request created successfully. Approval and execution are required before the pool exists on chain.",
      data: result
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/snapshot")
  async getMySnapshot(
    @Req() req: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    return this.stakingService.getMySnapshot(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("deposit")
  async deposit(
    @Req() req: AuthenticatedRequest,
    @Body(new JoiPipe(depositSchema)) body: { poolId: number; amount: string }
  ): Promise<CustomJsonResponse> {
    const supabaseUserId = req.user.id;
    return this.stakingService.deposit(body.poolId, body.amount, supabaseUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("withdraw")
  async withdraw(
    @Req() req: AuthenticatedRequest,
    @Body(new JoiPipe(withdrawSchema)) body: { poolId: number; amount: string }
  ): Promise<CustomJsonResponse> {
    const supabaseUserId = req.user.id;
    return this.stakingService.withdraw(body.poolId, body.amount, supabaseUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("claim-reward")
  async claimReward(
    @Req() req: AuthenticatedRequest,
    @Body(new JoiPipe(poolIdSchema)) body: { poolId: number }
  ): Promise<CustomJsonResponse> {
    return this.stakingService.claimReward(body.poolId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("emergency-withdraw")
  async emergencyWithdraw(
    @Req() req: AuthenticatedRequest,
    @Body(new JoiPipe(poolIdSchema)) body: { poolId: number }
  ): Promise<CustomJsonResponse> {
    return this.stakingService.emergencyWithdraw(body.poolId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/staked-balance/:poolId")
  async getStakedBalance(
    @Req() req: AuthenticatedRequest,
    @Param("poolId", ParseIntPipe) poolId: number
  ): Promise<CustomJsonResponse> {
    return this.stakingService.getStakedBalance(req.user.id, poolId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/pending-reward/:poolId")
  async getPendingReward(
    @Req() req: AuthenticatedRequest,
    @Param("poolId", ParseIntPipe) poolId: number
  ): Promise<CustomJsonResponse> {
    return this.stakingService.getPendingReward(req.user.id, poolId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("total-staked/:poolId")
  async getTotalStaked(
    @Param("poolId", ParseIntPipe) poolId: number
  ): Promise<CustomJsonResponse> {
    return this.stakingService.getTotalStaked(poolId);
  }
}
