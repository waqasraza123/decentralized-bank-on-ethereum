import { ConflictException } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  WalletStatus
} from "@prisma/client";
import { loadDepositRiskPolicyRuntimeConfig } from "@stealth-trails-bank/config/api";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionIntentsService } from "./transaction-intents.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadDepositRiskPolicyRuntimeConfig: jest.fn(() => ({
    autoApproveThresholds: []
  })),
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadSensitiveOperatorActionPolicyRuntimeConfig: () => ({
    transactionIntentDecisionAllowedOperatorRoles: [
      "operations_admin",
      "risk_manager"
    ],
    custodyOperationAllowedOperatorRoles: [
      "operations_admin",
      "senior_operator",
      "treasury"
    ],
    stakingGovernanceAllowedOperatorRoles: [
      "treasury",
      "risk_manager",
      "compliance_lead"
    ]
  })
}));

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
    const service = new TransactionIntentsService(
      prismaService,
      ledgerService,
      {
        openOrReuseReviewCase: jest.fn()
      } as never
    );

    await expect(
      service.createDepositIntent("supabase_1", {
        idempotencyKey: "deposit_req_1",
        assetSymbol: "USDC",
        amount: "10"
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(loadDepositRiskPolicyRuntimeConfig).toHaveBeenCalled();
  });
});
