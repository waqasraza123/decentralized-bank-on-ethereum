import { loadDatabaseRuntimeConfig } from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import {
  AccountLifecycleStatus,
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
};

type BackfillAction =
  | "already_projected"
  | "create_customer_and_account"
  | "create_account_only"
  | "conflict";

type BackfillPlan = {
  action: BackfillAction;
  legacyUser: LegacyUserRecord;
  customerId?: string;
  reason?: string;
};

type BackfillSummary = {
  mode: "dry-run" | "apply";
  scanned: number;
  alreadyProjected: number;
  createCustomerAndAccount: number;
  createAccountOnly: number;
  conflicts: number;
  appliedCustomerCreates: number;
  appliedCustomerAccountCreates: number;
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

async function buildBackfillPlan(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  legacyUser: LegacyUserRecord
): Promise<BackfillPlan> {
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
      reason: resolvedCustomer.reason
    };
  }

  if (!resolvedCustomer.customer) {
    return {
      action: "create_customer_and_account",
      legacyUser
    };
  }

  const customerAccount = await prisma.customerAccount.findUnique({
    where: {
      customerId: resolvedCustomer.customer.id
    }
  });

  if (customerAccount) {
    return {
      action: "already_projected",
      legacyUser,
      customerId: resolvedCustomer.customer.id
    };
  }

  return {
    action: "create_account_only",
    legacyUser,
    customerId: resolvedCustomer.customer.id
  };
}

async function applyBackfillPlan(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  plan: BackfillPlan
): Promise<{ customerCreated: boolean; customerAccountCreated: boolean }> {
  if (plan.action === "already_projected" || plan.action === "conflict") {
    return {
      customerCreated: false,
      customerAccountCreated: false
    };
  }

  if (plan.action === "create_customer_and_account") {
    await prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.create({
        data: {
          supabaseUserId: plan.legacyUser.supabaseUserId,
          email: plan.legacyUser.email,
          firstName: plan.legacyUser.firstName,
          lastName: plan.legacyUser.lastName
        }
      });

      await transaction.customerAccount.create({
        data: {
          customerId: customer.id,
          status: AccountLifecycleStatus.registered
        }
      });
    });

    return {
      customerCreated: true,
      customerAccountCreated: true
    };
  }

  if (!plan.customerId) {
    throw new Error("Customer id is required to create a missing account.");
  }

  await prisma.customerAccount.create({
    data: {
      customerId: plan.customerId,
      status: AccountLifecycleStatus.registered
    }
  });

  return {
    customerCreated: false,
    customerAccountCreated: true
  };
}

function createSummary(mode: "dry-run" | "apply"): BackfillSummary {
  return {
    mode,
    scanned: 0,
    alreadyProjected: 0,
    createCustomerAndAccount: 0,
    createAccountOnly: 0,
    conflicts: 0,
    appliedCustomerCreates: 0,
    appliedCustomerAccountCreates: 0
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const summary = createSummary(options.applyChanges ? "apply" : "dry-run");
  const conflicts: Array<{
    email: string;
    supabaseUserId: string;
    reason: string;
  }> = [];
  const plannedActions: Array<{
    email: string;
    supabaseUserId: string;
    action: BackfillAction;
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
      const plan = await buildBackfillPlan(prisma, legacyUser);

      plannedActions.push({
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        action: plan.action
      });

      if (plan.action === "already_projected") {
        summary.alreadyProjected += 1;
        continue;
      }

      if (plan.action === "create_customer_and_account") {
        summary.createCustomerAndAccount += 1;
      }

      if (plan.action === "create_account_only") {
        summary.createAccountOnly += 1;
      }

      if (plan.action === "conflict") {
        summary.conflicts += 1;
        conflicts.push({
          email: legacyUser.email,
          supabaseUserId: legacyUser.supabaseUserId,
          reason: plan.reason ?? "Unknown conflict."
        });
        continue;
      }

      if (!options.applyChanges) {
        continue;
      }

      const appliedResult = await applyBackfillPlan(prisma, plan);

      if (appliedResult.customerCreated) {
        summary.appliedCustomerCreates += 1;
      }

      if (appliedResult.customerAccountCreated) {
        summary.appliedCustomerAccountCreates += 1;
      }
    }

    console.log("Customer account backfill summary");
    console.log(JSON.stringify(summary, null, 2));

    if (plannedActions.length > 0) {
      console.log("Customer account backfill planned actions");
      console.log(JSON.stringify(plannedActions, null, 2));
    }

    if (conflicts.length > 0) {
      console.log("Customer account backfill conflicts");
      console.log(JSON.stringify(conflicts, null, 2));
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Customer account backfill failed.");
  }

  process.exit(1);
});
