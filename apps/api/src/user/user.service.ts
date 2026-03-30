import {
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import type {
  AccountLifecycleStatusValue,
  UserProfileProjection
} from "@stealth-trails-bank/types";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  AuthService,
  type CustomerAccountProjection,
  type CustomerWalletProjection
} from "../auth/auth.service";
import { SupabaseService } from "../supabase/supabase.service";

type LegacyUserProfile = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

@Injectable()
export class UserService {
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly authService: AuthService
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  private formatOptionalDate(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private mapLegacyUserProfile(
    legacyUser: LegacyUserProfile
  ): UserProfileProjection {
    return {
      id: legacyUser.id,
      customerId: null,
      supabaseUserId: legacyUser.supabaseUserId,
      email: legacyUser.email,
      firstName: legacyUser.firstName,
      lastName: legacyUser.lastName,
      ethereumAddress: legacyUser.ethereumAddress ?? "",
      accountStatus: null,
      activatedAt: null,
      restrictedAt: null,
      frozenAt: null,
      closedAt: null
    };
  }

  private resolveProfileEthereumAddress(
    walletProjection: CustomerWalletProjection | null,
    legacyUser: LegacyUserProfile | null
  ): string {
    return walletProjection?.wallet.address ?? legacyUser?.ethereumAddress ?? "";
  }

  private mapCustomerProjectionWithWalletOverlay(
    projection: CustomerAccountProjection,
    walletProjection: CustomerWalletProjection | null,
    legacyUser: LegacyUserProfile | null
  ): UserProfileProjection {
    const accountStatus =
      projection.customerAccount.status as AccountLifecycleStatusValue;

    return {
      id: legacyUser?.id ?? null,
      customerId: projection.customer.id,
      supabaseUserId: projection.customer.supabaseUserId,
      email: projection.customer.email,
      firstName: projection.customer.firstName ?? "",
      lastName: projection.customer.lastName ?? "",
      ethereumAddress: this.resolveProfileEthereumAddress(
        walletProjection,
        legacyUser
      ),
      accountStatus,
      activatedAt: this.formatOptionalDate(
        projection.customerAccount.activatedAt
      ),
      restrictedAt: this.formatOptionalDate(
        projection.customerAccount.restrictedAt
      ),
      frozenAt: this.formatOptionalDate(projection.customerAccount.frozenAt),
      closedAt: this.formatOptionalDate(projection.customerAccount.closedAt)
    };
  }

  private async getLegacyUserProfileBySupabaseUserId(
    supabaseUserId: string
  ): Promise<LegacyUserProfile | null> {
    const { data, error } = await this.supabase
      .from("User")
      .select("*")
      .eq("supabaseUserId", supabaseUserId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException("Failed to load user profile.");
    }

    return data as LegacyUserProfile | null;
  }

  private async getCustomerWalletProjectionOrNull(
    supabaseUserId: string
  ): Promise<CustomerWalletProjection | null> {
    try {
      return await this.authService.getCustomerWalletProjectionBySupabaseUserId(
        supabaseUserId
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }

      throw error;
    }
  }

  async getUserById(supabaseUserId: string): Promise<UserProfileProjection> {
    const legacyUser =
      await this.getLegacyUserProfileBySupabaseUserId(supabaseUserId);

    try {
      const customerProjection =
        await this.authService.getCustomerAccountProjectionBySupabaseUserId(
          supabaseUserId
        );
      const walletProjection =
        await this.getCustomerWalletProjectionOrNull(supabaseUserId);

      return this.mapCustomerProjectionWithWalletOverlay(
        customerProjection,
        walletProjection,
        legacyUser
      );
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      if (!legacyUser) {
        throw new NotFoundException("User profile not found.");
      }

      return this.mapLegacyUserProfile(legacyUser);
    }
  }
}
