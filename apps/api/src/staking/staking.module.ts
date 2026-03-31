import { Module } from '@nestjs/common';
import { StakingController } from './staking.controller';
import { StakingService } from './staking.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Module({
  controllers: [StakingController],
  providers: [StakingService, PrismaService, AuthService],
})
export class StakingPoolModule {}
