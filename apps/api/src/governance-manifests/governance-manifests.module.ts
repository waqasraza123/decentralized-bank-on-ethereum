import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GovernedCustodyManifestSyncService } from "./governed-custody-manifest-sync.service";

@Module({
  providers: [PrismaService, GovernedCustodyManifestSyncService]
})
export class GovernanceManifestsModule {}
