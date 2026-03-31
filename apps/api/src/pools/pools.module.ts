import { Module } from '@nestjs/common';
import { PoolsController } from './pools.controller';
import { PoolsService } from './pools.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Module({
    controllers: [PoolsController],
    providers: [PoolsService, PrismaService, AuthService],
})
export class PoolsModule { }
