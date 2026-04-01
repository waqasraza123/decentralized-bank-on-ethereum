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
  type Customer,
  type Prisma
} from "@prisma/client";
import { ethers } from "ethers";

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
  | "repair_customer_account_and_wallet"
  | "missing_wallet_address"
  | "invalid_wallet_address"
  | "customer_exists"
  | "conflict";

type RepairMethod = "create_wallet" | "attach_existing_wallet";

type RepairPlan = {
  action: RepairAction;
  legacyUser: LegacyUserRecord;
  normalizedAddress?: string;
  repairMethod?: RepairMethod;
  reason?: string;
};

type RepairSummary = {
  mode: "dry-run" | "apply";
  chainId: number;
  scanned: number;
  repairCustomerAccountAndWallet: number;
  missingWalletAddress: number;
  invalidWalletAddress: number;
  customerExists: number;
  conflicts: number;
  plannedWalletCreates: number;
  plannedWalletAttachments: number;
  appliedCustomerCreates: number;
  appliedCustomerAccountCreates: number;
  appliedWalletCreates: number;
  appliedWalletAttachments: number;
};

type PrismaClientLike = ReturnType<typeof createStealthTrailsPrismaClient>;

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

function normalizeWalletAddress(address: string | null): {
  normalizedAddress: string | null;
  reason?: string;
} {
  const rawAddress = address?.trim() ?? "";

  if (!rawAddress) {
    return {
      normalizedAddress: null
    };
  }

  if (!ethers.utils.isAddress(rawAddress)) {
    return {
      normalizedAddress: null,
      reason: "Legacy ethereumAddress is not a valid EVM address."
    };
  }

  return {
    normalizedAddress: ethers.utils.getAddress(rawAddress).toLowerCase()
  };
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
  prisma: PrismaClientLike,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<RepairPlan> {
  const normalizedWallet = normalizeWalletAddress(legacyUser.ethereumAddress);

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
      normalizedAddress: normalizedWallet.normalizedAddress ?? undefined,
      reason: resolvedCustomer.reason
    };
  }

  if (resolvedCustomer.customer) {
    return {
      action: "customer_exists",
      legacyUser,
      normalizedAddress: normalizedWallet.normalizedAddress ?? undefined,
      reason:
        "Customer projection already exists. Use narrower account or wallet repair flows instead."
    };
  }

  if (!normalizedWallet.normalizedAddress) {
    if (normalizedWallet.reason) {
      return {
        action: "invalid_wallet_address",
        legacyUser,
        reason: normalizedWallet.reason
      };
    }

    return {
      action: "missing_wallet_address",
      legacyUser,
      reason:
        "Missing customer projection repair requires a usable legacy ethereumAddress."
    };
  }

  const normalizedAddress = normalizedWallet.normalizedAddress;

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
      normalizedAddress,
      reason: "Wallet address is already linked to another customer account."
    };
  }

  return {
    action: "repair_customer_account_and_wallet",
    legacyUser,
    normalizedAddress,
    repairMethod: existingWallet ? "attach_existing_wallet" : "create_wallet"
  };
}

async function applyRepairPlan(
  prisma: PrismaClientLike,
  plan: RepairPlan,
  productChainId: number
): Promise<{
  customerCreated: boolean;
  customerAccountCreated: boolean;
  walletCreated: boolean;
  walletAttached: boolean;
}> {
  if (plan.action !== "repair_customer_account_and_wallet") {
    return {
      customerCreated: false,
      customerAccountCreated: false,
      walletCreated: false,
      walletAttached: false
    };
  }

  if (!plan.normalizedAddress) {
    throw new Error(
      "Normalized address is required for missing customer projection repair."
    );
  }

  const normalizedAddress = plan.normalizedAddress;

  return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const customerBySupabaseUserId = await transaction.customer.findUnique({
      where: {
        supabaseUserId: plan.legacyUser.supabaseUserId
      }
    });

    const customerByEmail = await transaction.customer.findUnique({
      where: {
        email: plan.legacyUser.email
      }
    });

    const resolvedCustomer = resolveExistingCustomer(
      plan.legacyUser,
      customerBySupabaseUserId,
      customerByEmail
    );

    if (!resolvedCustomer.customer && resolvedCustomer.reason) {
      throw new Error(resolvedCustomer.reason);
    }

    if (resolvedCustomer.customer) {
      throw new Error(
        "Customer projection already exists. Use narrower account or wallet repair flows instead."
      );
    }

    const existingWallet = await transaction.wallet.findUnique({
      where: {
        chainId_address: {
          chainId: productChainId,
          address: normalizedAddress
        }
      }
    });

    if (existingWallet?.customerAccountId) {
      throw new Error(
        "Wallet address is already linked to another customer account."
      );
    }

    const customer = await transaction.customer.create({
      data: {
        supabaseUserId: plan.legacyUser.supabaseUserId,
        email: plan.legacyUser.email,
        firstName: plan.legacyUser.firstName,
        lastName: plan.legacyUser.lastName
      }
    });

    const customerAccount = await transaction.customerAccount.create({
      data: {
        status: AccountLifecycleStatus.registered,
        customer: {
          connect: {
            id: customer.id
          }
        }
      }
    });

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
        customerCreated: true,
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
      customerCreated: true,
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
    repairCustomerAccountAndWallet: 0,
    missingWalletAddress: 0,
    invalidWalletAddress: 0,
    customerExists: 0,
    conflicts: 0,
    plannedWalletCreates: 0,
    plannedWalletAttachments: 0,
    appliedCustomerCreates: 0,
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

      if (plan.action === "repair_customer_account_and_wallet") {
        summary.repairCustomerAccountAndWallet += 1;

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

        if (applied.customerCreated) {
          summary.appliedCustomerCreates += 1;
        }

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

      if (plan.action === "invalid_wallet_address") {
        summary.invalidWalletAddress += 1;
        conflicts.push({
          email: legacyUser.email,
          supabaseUserId: legacyUser.supabaseUserId,
          reason: plan.reason ?? "Legacy ethereumAddress is not a valid EVM address."
        });
        continue;
      }

      if (plan.action === "customer_exists") {
        summary.customerExists += 1;
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

  console.error("Missing customer projection repair failed.");
  process.exit(1);
});
