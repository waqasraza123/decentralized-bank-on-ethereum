import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import {
  AccountLifecycleStatus,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  type Customer
} from "@prisma/client";

type ScriptOptions = {
  applyChanges: boolean;
  email?: string;
  limit?: number;
};

type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

type RepairAction =
  | "already_projected"
  | "repair_account_and_wallet"
  | "missing_wallet_address"
  | "missing_customer_projection"
  | "customer_account_exists"
  | "conflict";

type RepairMethod = "create_wallet" | "attach_existing_wallet";

type RepairPlan = {
  action: RepairAction;
  legacyUser: LegacyUserRecord;
  customerId?: string;
  normalizedAddress?: string;
  repairMethod?: RepairMethod;
  reason?: string;
};

type RepairSummary = {
  mode: "dry-run" | "apply";
  chainId: number;
  scanned: number;
  alreadyProjected: number;
  repairAccountAndWallet: number;
  missingWalletAddress: number;
  missingCustomerProjection: number;
  customerAccountExists: number;
  conflicts: number;
  plannedWalletCreates: number;
  plannedWalletAttachments: number;
  appliedCustomerAccountCreates: number;
  appliedWalletCreates: number;
  appliedWalletAttachments: number;
};

function parseOptions(argv: string[]): ScriptOptions {
  let applyChanges = false;
  let email: string | undefined;
  let limit: number | undefined;

  for (const argument of argv) {
    if (argument === "--apply") {
      applyChanges = true;
      continue;
    }

    if (argument.startsWith("--email=")) {
      const emailValue = argument.slice("--email=".length).trim();

      if (!emailValue) {
        throw new Error("The --email option requires a non-empty value.");
      }

      email = emailValue;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      const rawLimit = argument.slice("--limit=".length).trim();
      const parsedLimit = Number(rawLimit);

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        throw new Error("The --limit option must be a positive integer.");
      }

      limit = parsedLimit;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    applyChanges,
    email,
    limit
  };
}

function normalizeWalletAddress(address: string | null): string | null {
  const normalizedAddress = address?.trim().toLowerCase() ?? "";
  return normalizedAddress || null;
}

function resolveExistingCustomer(
  legacyUser: LegacyUserRecord,
  customerBySupabaseUserId: Customer | null,
  customerByEmail: Customer | null
): { customer: Customer | null; reason?: string } {
  if (
    customerBySupabaseUserId &&
    customerByEmail &&
    customerBySupabaseUserId.id !== customerByEmail.id
  ) {
    return {
      customer: null,
      reason:
        "Conflicting customer records found for supabaseUserId and email."
    };
  }

  if (customerBySupabaseUserId) {
    if (customerBySupabaseUserId.email !== legacyUser.email) {
      return {
        customer: null,
        reason: "Existing customer email does not match legacy user email."
      };
    }

    return {
      customer: customerBySupabaseUserId
    };
  }

  if (customerByEmail) {
    if (customerByEmail.supabaseUserId !== legacyUser.supabaseUserId) {
      return {
        customer: null,
        reason:
          "Existing customer supabaseUserId does not match legacy user supabaseUserId."
      };
    }

    return {
      customer: customerByEmail
    };
  }

  return {
    customer: null
  };
}

async function buildRepairPlan(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<RepairPlan> {
  const normalizedAddress = normalizeWalletAddress(legacyUser.ethereumAddress);

  const customerBySupabaseUserId = await prisma.customer.findUnique({
    where: {
      supabaseUserId: legacyUser.supabaseUserId
    }
  });

  const customerByEmail = await prisma.customer.findUnique({
    where: {
      email: legacyUser.email
    }
  });

  const resolvedCustomer = resolveExistingCustomer(
    legacyUser,
    customerBySupabaseUserId,
    customerByEmail
  );

  if (!resolvedCustomer.customer && resolvedCustomer.reason) {
    return {
      action: "conflict",
      legacyUser,
      normalizedAddress: normalizedAddress ?? undefined,
      reason: resolvedCustomer.reason
    };
  }

  if (!resolvedCustomer.customer) {
    return {
      action: "missing_customer_projection",
      legacyUser,
      normalizedAddress: normalizedAddress ?? undefined,
      reason: "Customer projection does not exist."
    };
  }

  const existingCustomerAccount = await prisma.customerAccount.findUnique({
    where: {
      customerId: resolvedCustomer.customer.id
    },
    include: {
      wallets: {
        where: {
          chainId: productChainId
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (existingCustomerAccount) {
    if (existingCustomerAccount.wallets.length > 1) {
      return {
        action: "conflict",
        legacyUser,
        customerId: resolvedCustomer.customer.id,
        normalizedAddress: normalizedAddress ?? undefined,
        reason: "Multiple product-chain wallets exist for this customer account."
      };
    }

    if (existingCustomerAccount.wallets.length === 1) {
      return {
        action: "already_projected",
        legacyUser,
        customerId: resolvedCustomer.customer.id,
        normalizedAddress: normalizedAddress ?? undefined
      };
    }

    return {
      action: "customer_account_exists",
      legacyUser,
      customerId: resolvedCustomer.customer.id,
      normalizedAddress: normalizedAddress ?? undefined,
      reason:
        "Customer account already exists. Use the wallet-only repair flow instead."
    };
  }

  if (!normalizedAddress) {
    return {
      action: "missing_wallet_address",
      legacyUser,
      customerId: resolvedCustomer.customer.id,
      reason:
        "Customer exists but legacy ethereumAddress is missing, so account-and-wallet repair cannot proceed."
    };
  }

  const existingWallet = await prisma.wallet.findUnique({
    where: {
      chainId_address: {
        chainId: productChainId,
        address: normalizedAddress
      }
    }
  });

  if (existingWallet?.customerAccountId) {
    return {
      action: "conflict",
      legacyUser,
      customerId: resolvedCustomer.customer.id,
      normalizedAddress,
      reason: "Wallet address is already linked to another customer account."
    };
  }

  return {
    action: "repair_account_and_wallet",
    legacyUser,
    customerId: resolvedCustomer.customer.id,
    normalizedAddress,
    repairMethod: existingWallet ? "attach_existing_wallet" : "create_wallet"
  };
}

async function applyRepairPlan(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  plan: RepairPlan,
  productChainId: number
): Promise<{
  customerAccountCreated: boolean;
  walletCreated: boolean;
  walletAttached: boolean;
}> {
  if (plan.action !== "repair_account_and_wallet") {
    return {
      customerAccountCreated: false,
      walletCreated: false,
      walletAttached: false
    };
  }

  if (!plan.customerId || !plan.normalizedAddress) {
    throw new Error(
      "Customer id and normalized address are required for account-and-wallet repair."
    );
  }

  const customerId = plan.customerId;
  const normalizedAddress = plan.normalizedAddress;

  return prisma.$transaction(async (transaction) => {
    const existingCustomerAccount = await transaction.customerAccount.findUnique({
      where: {
        customerId
      }
    });

    if (existingCustomerAccount) {
      throw new Error(
        "Customer account already exists. Use the wallet-only repair flow instead."
      );
    }

    const customerAccount = await transaction.customerAccount.create({
      data: {
        status: AccountLifecycleStatus.registered,
        customer: {
          connect: {
            id: customerId
          }
        }
      }
    });

    const existingWallet = await transaction.wallet.findUnique({
      where: {
        chainId_address: {
          chainId: productChainId,
          address: normalizedAddress
        }
      }
    });

    if (
      existingWallet &&
      existingWallet.customerAccountId &&
      existingWallet.customerAccountId !== customerAccount.id
    ) {
      throw new Error(
        "Wallet address is already linked to another customer account."
      );
    }

    if (existingWallet) {
      await transaction.wallet.update({
        where: {
          chainId_address: {
            chainId: productChainId,
            address: normalizedAddress
          }
        },
        data: {
          customerAccountId: customerAccount.id,
          kind: WalletKind.embedded,
          custodyType: WalletCustodyType.platform_managed,
          status: WalletStatus.active
        }
      });

      return {
        customerAccountCreated: true,
        walletCreated: false,
        walletAttached: true
      };
    }

    await transaction.wallet.create({
      data: {
        customerAccountId: customerAccount.id,
        chainId: productChainId,
        address: normalizedAddress,
        kind: WalletKind.embedded,
        custodyType: WalletCustodyType.platform_managed,
        status: WalletStatus.active
      }
    });

    return {
      customerAccountCreated: true,
      walletCreated: true,
      walletAttached: false
    };
  });
}

function createSummary(
  mode: "dry-run" | "apply",
  chainId: number
): RepairSummary {
  return {
    mode,
    chainId,
    scanned: 0,
    alreadyProjected: 0,
    repairAccountAndWallet: 0,
    missingWalletAddress: 0,
    missingCustomerProjection: 0,
    customerAccountExists: 0,
    conflicts: 0,
    plannedWalletCreates: 0,
    plannedWalletAttachments: 0,
    appliedCustomerAccountCreates: 0,
    appliedWalletCreates: 0,
    appliedWalletAttachments: 0
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const productChainId = loadProductChainRuntimeConfig().productChainId;
  const summary = createSummary(
    options.applyChanges ? "apply" : "dry-run",
    productChainId
  );
  const conflicts: Array<{
    email: string;
    supabaseUserId: string;
    reason: string;
  }> = [];
  const plannedActions: Array<{
    email: string;
    supabaseUserId: string;
    action: RepairAction;
    repairMethod: RepairMethod | null;
    normalizedAddress: string | null;
  }> = [];

  try {
    const legacyUsers = await prisma.user.findMany({
      where: options.email
        ? {
            email: options.email
          }
        : undefined,
      orderBy: {
        id: "asc"
      },
      take: options.limit
    });

    summary.scanned = legacyUsers.length;

    for (const legacyUser of legacyUsers) {
      const plan = await buildRepairPlan(prisma, legacyUser, productChainId);

      plannedActions.push({
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        action: plan.action,
        repairMethod: plan.repairMethod ?? null,
        normalizedAddress: plan.normalizedAddress ?? null
      });

      if (plan.action === "already_projected") {
        summary.alreadyProjected += 1;
        continue;
      }

      if (plan.action === "repair_account_and_wallet") {
        summary.repairAccountAndWallet += 1;

        if (plan.repairMethod === "create_wallet") {
          summary.plannedWalletCreates += 1;
        }

        if (plan.repairMethod === "attach_existing_wallet") {
          summary.plannedWalletAttachments += 1;
        }

        if (!options.applyChanges) {
          continue;
        }

        const applied = await applyRepairPlan(prisma, plan, productChainId);

        if (applied.customerAccountCreated) {
          summary.appliedCustomerAccountCreates += 1;
        }

        if (applied.walletCreated) {
          summary.appliedWalletCreates += 1;
        }

        if (applied.walletAttached) {
          summary.appliedWalletAttachments += 1;
        }

        continue;
      }

      if (plan.action === "missing_wallet_address") {
        summary.missingWalletAddress += 1;
        continue;
      }

      if (plan.action === "missing_customer_projection") {
        summary.missingCustomerProjection += 1;
        continue;
      }

      if (plan.action === "customer_account_exists") {
        summary.customerAccountExists += 1;
        continue;
      }

      summary.conflicts += 1;
      conflicts.push({
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        reason: plan.reason ?? "Unknown conflict."
      });
    }

    console.log(
      JSON.stringify(
        {
          summary,
          plannedActions,
          conflicts
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    process.exit(1);
  }

  console.error("Customer account and wallet projection repair failed.");
  process.exit(1);
});
