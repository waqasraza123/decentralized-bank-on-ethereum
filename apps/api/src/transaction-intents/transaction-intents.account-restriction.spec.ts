import { ConflictException } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  WalletStatus
} from "@prisma/client";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionIntentsService } from "./transaction-intents.service";

describe("TransactionIntentsService account restriction checks", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("rejects deposit intent creation when the customer account is restricted", async () => {
    const prismaService = {
      customerAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: "account_1",
          status: AccountLifecycleStatus.restricted,
          customer: {
            id: "customer_1"
          },
          wallets: [
            {
              id: "wallet_1",
              address: "0x0000000000000000000000000000000000000fed",
              status: WalletStatus.active
            }
          ]
        })
      }
    } as unknown as PrismaService;

    const ledgerService = {} as LedgerService;
    const service = new TransactionIntentsService(prismaService, ledgerService);

    await expect(
      service.createDepositIntent("supabase_1", {
        idempotencyKey: "deposit_req_1",
        assetSymbol: "USDC",
        amount: "10"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
