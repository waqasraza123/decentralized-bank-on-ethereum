import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DepositModule } from './deposit/deposit.module';
import { UserModule } from './user/user.module';
import { StakingPoolModule } from './staking/staking.module';
import { EthereumModule } from './ethereum/ethereum.module';
import { PoolsModule } from './pools/pools.module';

@Module({
  imports: [AuthModule, DepositModule, UserModule, StakingPoolModule, EthereumModule, PoolsModule],
})
export class AppModule { }
