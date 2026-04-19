import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SharedLoginBootstrapService } from './shared-login-bootstrap.service';
import { OperatorIdentityService } from './operator-identity.service';
import { InternalOperatorApiKeyGuard } from './guards/internal-operator-api-key.guard';
import { InternalOperatorBearerGuard } from './guards/internal-operator-bearer.guard';

@Global()
@Module({
  imports: [],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtAuthGuard,
    SharedLoginBootstrapService,
    OperatorIdentityService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    OperatorIdentityService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard
  ]
})
export class AuthModule {}
