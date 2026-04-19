import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PoolsController } from "./pools.controller";
import { PoolsService } from "./pools.service";

@Module({
  controllers: [PoolsController],
  providers: [PoolsService, PrismaService],
})
export class PoolsModule {}
