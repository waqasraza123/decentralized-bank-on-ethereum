import {
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { AccountLifecycleStatus } from "@prisma/client";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  AuthService,
  type CustomerAccountProjection
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

type CustomerAccountUserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string;
  accountStatus: AccountLifecycleStatus;
  activatedAt: Date | null;
  restrictedAt: Date | null;
  frozenAt: Date | null;
  closedAt: Date | null;
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

  private mapCustomerProjectionToUserProfile(
    projection: CustomerAccountProjection
  ): CustomerAccountUserProfile {
    return {
      id: projection.customer.id,
      firstName: projection.customer.firstName ?? "",
      lastName: projection.customer.lastName ?? "",
      email: projection.customer.email,
      supabaseUserId: projection.customer.supabaseUserId,
      ethereumAddress: "",
      accountStatus: projection.customerAccount.status,
      activatedAt: projection.customerAccount.activatedAt,
      restrictedAt: projection.customerAccount.restrictedAt,
      frozenAt: projection.customerAccount.frozenAt,
      closedAt: projection.customerAccount.closedAt
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

  async getUserById(supabaseUserId: string) {
    try {
      const customerProjection =
        await this.authService.getCustomerAccountProjectionBySupabaseUserId(
          supabaseUserId
        );

      return this.mapCustomerProjectionToUserProfile(customerProjection);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }

      return this.getLegacyUserProfileBySupabaseUserId(supabaseUserId);
    }
  }
}
