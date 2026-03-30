jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

import { NotFoundException } from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService.getCustomerWalletProjectionBySupabaseUserId", () => {
  function createService() {
    const supabaseService = {
      getClient: jest.fn().mockReturnValue({})
    };

    const prismaService = {
      customerAccount: {
        findFirst: jest.fn()
      }
    };

    const service = new AuthService(
      supabaseService as never,
      prismaService as never
    );

    return {
      service,
      prismaService
    };
  }

  it("returns the configured product-chain wallet projection", async () => {
    const { service, prismaService } = createService();
    const createdAt = new Date("2026-03-29T00:00:00.000Z");
    const updatedAt = new Date("2026-03-29T00:05:00.000Z");

    prismaService.customerAccount.findFirst.mockResolvedValue({
      wallets: [
        {
          id: "wallet_1",
          customerAccountId: "account_1",
          chainId: 8453,
          address: "0xwallet",
          kind: "embedded",
          custodyType: "platform_managed",
          status: "active",
          createdAt,
          updatedAt
        }
      ]
    });

    const result =
      await service.getCustomerWalletProjectionBySupabaseUserId("supabase_1");

    expect(prismaService.customerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        customer: {
          supabaseUserId: "supabase_1"
        }
      },
      include: {
        wallets: {
          where: {
            chainId: 8453
          },
          orderBy: {
            createdAt: "asc"
          },
          take: 1
        }
      }
    });

    expect(result).toEqual({
      wallet: {
        id: "wallet_1",
        customerAccountId: "account_1",
        chainId: 8453,
        address: "0xwallet",
        kind: "embedded",
        custodyType: "platform_managed",
        status: "active",
        createdAt,
        updatedAt
      }
    });
  });

  it("throws when the customer account projection does not exist", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.getCustomerWalletProjectionBySupabaseUserId("missing_user")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws when the customer account exists but has no product-chain wallet", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      wallets: []
    });

    await expect(
      service.getCustomerWalletProjectionBySupabaseUserId("supabase_1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
