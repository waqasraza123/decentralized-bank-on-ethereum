import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import type { Customer } from "@prisma/client";

type ScriptOptions = {
  email?: string;
  limit?: number;
  onlyActionable: boolean;
  summaryOnly: boolean;
};

type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

type CoverageStatus =
  | "wallet_projected"
  | "wallet_legacy_mismatch"
  | "create_wallet_only"
  | "create_account_and_wallet"
  | "create_customer_account_and_wallet"
  | "missing_address"
  | "conflict";

type AddressSource = "wallet" | "legacy" | "none" | "conflict";

type SuggestedAction =
  | "none"
  | "backfill_wallet"
  | "backfill_account_and_wallet"
  | "backfill_customer_account_and_wallet"
  | "manual_review"
  | "repair_legacy_data";

type CoverageRecord = {
  legacyUserId: number;
  email: string;
  supabaseUserId: string;
  productChainId: number;
  status: CoverageStatus;
  addressSource: AddressSource;
  suggestedAction: SuggestedAction;
  legacyEthereumAddress: string | null;
  walletAddress: string | null;
  customerId: string | null;
  customerAccountId: string | null;
  reason: string | null;
};

type CoverageSummary = {
  productChainId: number;
  scanned: number;
  walletProjected: number;
  walletLegacyMismatch: number;
  createWalletOnly: number;
  createAccountAndWallet: number;
  createCustomerAccountAndWallet: number;
  missingAddress: number;
  conflicts: number;
  walletSourceProfiles: number;
  legacySourceProfiles: number;
  noAddressProfiles: number;
  actionableProfiles: number;
};

function parseOptions(argv: string[]): ScriptOptions {
  let email: string | undefined;
  let limit: number | undefined;
  let onlyActionable = false;
  let summaryOnly = false;

  for (const argument of argv) {
    if (argument === "--only-actionable") {
      onlyActionable = true;
      continue;
    }

    if (argument === "--summary-only") {
      summaryOnly = true;
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
    email,
    limit,
    onlyActionable,
    summaryOnly
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

function createSummary(productChainId: number): CoverageSummary {
  return {
    productChainId,
    scanned: 0,
    walletProjected: 0,
    walletLegacyMismatch: 0,
    createWalletOnly: 0,
    createAccountAndWallet: 0,
    createCustomerAccountAndWallet: 0,
    missingAddress: 0,
    conflicts: 0,
    walletSourceProfiles: 0,
    legacySourceProfiles: 0,
    noAddressProfiles: 0,
    actionableProfiles: 0
  };
}

function isActionableStatus(status: CoverageStatus): boolean {
  return status !== "wallet_projected";
}

function accumulateSummary(
  summary: CoverageSummary,
  record: CoverageRecord
): void {
  summary.scanned += 1;

  if (record.status === "wallet_projected") {
    summary.walletProjected += 1;
  }

  if (record.status === "wallet_legacy_mismatch") {
    summary.walletLegacyMismatch += 1;
  }

  if (record.status === "create_wallet_only") {
    summary.createWalletOnly += 1;
  }

  if (record.status === "create_account_and_wallet") {
    summary.createAccountAndWallet += 1;
  }

  if (record.status === "create_customer_account_and_wallet") {
    summary.createCustomerAccountAndWallet += 1;
  }

  if (record.status === "missing_address") {
    summary.missingAddress += 1;
  }

  if (record.status === "conflict") {
    summary.conflicts += 1;
  }

  if (record.addressSource === "wallet") {
    summary.walletSourceProfiles += 1;
  }

  if (record.addressSource === "legacy") {
    summary.legacySourceProfiles += 1;
  }

  if (record.addressSource === "none") {
    summary.noAddressProfiles += 1;
  }

  if (isActionableStatus(record.status)) {
    summary.actionableProfiles += 1;
  }
}

async function buildCoverageRecord(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<CoverageRecord> {
  const normalizedLegacyAddress = normalizeWalletAddress(
    legacyUser.ethereumAddress
  );

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
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "conflict",
      addressSource: "conflict",
      suggestedAction: "manual_review",
      legacyEthereumAddress: normalizedLegacyAddress,
      walletAddress: null,
      customerId: null,
      customerAccountId: null,
      reason: resolvedCustomer.reason
    };
  }

  if (!resolvedCustomer.customer) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: normalizedLegacyAddress
        ? "create_customer_account_and_wallet"
        : "missing_address",
      addressSource: normalizedLegacyAddress ? "legacy" : "none",
      suggestedAction: normalizedLegacyAddress
        ? "backfill_customer_account_and_wallet"
        : "repair_legacy_data",
      legacyEthereumAddress: normalizedLegacyAddress,
      walletAddress: null,
      customerId: null,
      customerAccountId: null,
      reason: normalizedLegacyAddress
        ? "Customer projection is missing."
        : "Customer projection is missing and legacy ethereumAddress is blank."
    };
  }

  const customerAccount = await prisma.customerAccount.findUnique({
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

  if (!customerAccount) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: normalizedLegacyAddress
        ? "create_account_and_wallet"
        : "missing_address",
      addressSource: normalizedLegacyAddress ? "legacy" : "none",
      suggestedAction: normalizedLegacyAddress
        ? "backfill_account_and_wallet"
        : "repair_legacy_data",
      legacyEthereumAddress: normalizedLegacyAddress,
      walletAddress: null,
      customerId: resolvedCustomer.customer.id,
      customerAccountId: null,
      reason: normalizedLegacyAddress
        ? "Customer account projection is missing."
        : "Customer account projection is missing and legacy ethereumAddress is blank."
    };
  }

  if (customerAccount.wallets.length > 1) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "conflict",
      addressSource: "conflict",
      suggestedAction: "manual_review",
      legacyEthereumAddress: normalizedLegacyAddress,
      walletAddress: null,
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      reason: "Multiple product-chain wallets exist for this customer account."
    };
  }

  const wallet = customerAccount.wallets[0] ?? null;
  const normalizedWalletAddress = wallet
    ? normalizeWalletAddress(wallet.address)
    : null;

  if (!wallet) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: normalizedLegacyAddress ? "create_wallet_only" : "missing_address",
      addressSource: normalizedLegacyAddress ? "legacy" : "none",
      suggestedAction: normalizedLegacyAddress
        ? "backfill_wallet"
        : "repair_legacy_data",
      legacyEthereumAddress: normalizedLegacyAddress,
      walletAddress: null,
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      reason: normalizedLegacyAddress
        ? "Customer account exists but wallet projection is missing."
        : "Customer account exists but wallet projection and legacy ethereumAddress are both missing."
    };
  }

  if (
    normalizedLegacyAddress &&
    normalizedWalletAddress &&
    normalizedLegacyAddress !== normalizedWalletAddress
  ) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "wallet_legacy_mismatch",
      addressSource: "wallet",
      suggestedAction: "manual_review",
      legacyEthereumAddress: normalizedLegacyAddress,
      walletAddress: normalizedWalletAddress,
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      reason:
        "Wallet projection exists but differs from legacy ethereumAddress."
    };
  }

  return {
    legacyUserId: legacyUser.id,
    email: legacyUser.email,
    supabaseUserId: legacyUser.supabaseUserId,
    productChainId,
    status: "wallet_projected",
    addressSource: "wallet",
    suggestedAction: "none",
    legacyEthereumAddress: normalizedLegacyAddress,
    walletAddress: normalizedWalletAddress,
    customerId: resolvedCustomer.customer.id,
    customerAccountId: customerAccount.id,
    reason: null
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const productChainId = loadProductChainRuntimeConfig().productChainId;
  const summary = createSummary(productChainId);
  const details: CoverageRecord[] = [];

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

    for (const legacyUser of legacyUsers) {
      const record = await buildCoverageRecord(
        prisma,
        legacyUser,
        productChainId
      );

      accumulateSummary(summary, record);

      if (options.summaryOnly) {
        continue;
      }

      if (options.onlyActionable && !isActionableStatus(record.status)) {
        continue;
      }

      details.push(record);
    }

    console.log(
      JSON.stringify(
        {
          summary,
          details: options.summaryOnly ? [] : details
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

  console.error("Wallet projection coverage audit failed.");
  process.exit(1);
});
