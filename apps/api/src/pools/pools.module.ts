import { Module } from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { PoolsController } from "./pools.controller";
import { PoolsService } from "./pools.service";

@Module({
    controllers: [PoolsController],
    providers: [PoolsService, PrismaService, AuthService, InternalOperatorBearerGuard],
})
export class PoolsModule { }
