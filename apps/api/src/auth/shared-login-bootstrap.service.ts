import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { loadOperatorAuthRuntimeConfig } from "@stealth-trails-bank/config/api";
import { AuthService } from "./auth.service";

@Injectable()
export class SharedLoginBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SharedLoginBootstrapService.name);

  constructor(private readonly authService: AuthService) {}

  async onApplicationBootstrap(): Promise<void> {
    const { operatorRuntimeEnvironment } = loadOperatorAuthRuntimeConfig();

    if (operatorRuntimeEnvironment !== "development") {
      this.logger.log(
        `Shared login bootstrap is inactive for ${operatorRuntimeEnvironment}.`
      );
      return;
    }

    const result = await this.authService.ensureSharedLoginAccount();

    if (!result) {
      this.logger.log("Shared login bootstrap is disabled.");
      return;
    }

    this.logger.log(
      `Shared login account is ready for ${result.email} (${result.supabaseUserId}).`
    );
  }
}
