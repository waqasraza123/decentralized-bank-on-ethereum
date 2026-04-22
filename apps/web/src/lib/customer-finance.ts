import {
  formatDateLabel as formatLocalizedDateLabel,
  formatDecimalString,
  type SupportedLocale
} from "@stealth-trails-bank/i18n";
import {
  buildIntentTimeline as buildSharedIntentTimeline,
  getTransactionConfidenceLabel,
  getTransactionConfidenceTone,
  mapIntentStatusToConfidence,
  type TimelineEvent,
  type TransactionConfidenceStatus
} from "@stealth-trails-bank/ui-foundation";

export type CustomerIntentType =
  | "deposit"
  | "withdrawal"
  | "internal_balance_transfer"
  | "vault_subscription"
  | "vault_redemption";

const positiveDecimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export function formatTokenAmount(
  value: string | null | undefined,
  locale: SupportedLocale = "en",
  maxFractionDigits = 6
): string {
  return formatDecimalString(value, locale, maxFractionDigits);
}

function normalizeDecimalForCompare(value: string) {
  const trimmedValue = value.trim();
  const isNegative = trimmedValue.startsWith("-");
  const unsignedValue = isNegative ? trimmedValue.slice(1) : trimmedValue;
  const [wholePart = "0", fractionPart = ""] = unsignedValue.split(".");

  return {
    isNegative,
    wholePart: wholePart.replace(/^0+(?=\d)/, "") || "0",
    fractionPart: fractionPart.replace(/0+$/, "")
  };
}

export function compareDecimalStrings(left: string, right: string): number {
  const normalizedLeft = normalizeDecimalForCompare(left);
  const normalizedRight = normalizeDecimalForCompare(right);

  if (normalizedLeft.isNegative !== normalizedRight.isNegative) {
    return normalizedLeft.isNegative ? -1 : 1;
  }

  const comparisonSign = normalizedLeft.isNegative ? -1 : 1;

  if (
    normalizedLeft.wholePart.length !== normalizedRight.wholePart.length
  ) {
    return normalizedLeft.wholePart.length > normalizedRight.wholePart.length
      ? comparisonSign
      : -comparisonSign;
  }

  if (normalizedLeft.wholePart !== normalizedRight.wholePart) {
    return normalizedLeft.wholePart > normalizedRight.wholePart
      ? comparisonSign
      : -comparisonSign;
  }

  const fractionalLength = Math.max(
    normalizedLeft.fractionPart.length,
    normalizedRight.fractionPart.length
  );
  const paddedLeftFraction = normalizedLeft.fractionPart.padEnd(
    fractionalLength,
    "0"
  );
  const paddedRightFraction = normalizedRight.fractionPart.padEnd(
    fractionalLength,
    "0"
  );

  if (paddedLeftFraction === paddedRightFraction) {
    return 0;
  }

  return paddedLeftFraction > paddedRightFraction
    ? comparisonSign
    : -comparisonSign;
}

export function isPositiveDecimalString(value: string): boolean {
  const trimmedValue = value.trim();

  if (!positiveDecimalPattern.test(trimmedValue)) {
    return false;
  }

  return compareDecimalStrings(trimmedValue, "0") === 1;
}

export function formatDateLabel(
  value: string,
  locale: SupportedLocale = "en"
): string {
  return formatLocalizedDateLabel(value, locale);
}

export function formatShortAddress(
  value: string | null | undefined,
  unavailableLabel = "Not available",
  leading = 6,
  trailing = 4
): string {
  if (!value) {
    return unavailableLabel;
  }

  if (value.length <= leading + trailing) {
    return value;
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

export function normalizeIntentTypeLabel(
  intentType: CustomerIntentType,
  locale: SupportedLocale = "en",
  transferDirection: "sent" | "received" | null = null
): string {
  if (locale === "ar") {
    if (intentType === "deposit") {
      return "إيداع";
    }

    if (intentType === "withdrawal") {
      return "سحب";
    }

    if (intentType === "internal_balance_transfer") {
      return transferDirection === "received"
        ? "تحويل داخلي وارد"
        : "تحويل داخلي مرسل";
    }

    return intentType === "vault_subscription"
      ? "تمويل قبو التقاعد"
      : "إطلاق من قبو التقاعد";
  }

  if (intentType === "deposit") {
    return "Deposit";
  }

  if (intentType === "withdrawal") {
    return "Withdrawal";
  }

  if (intentType === "internal_balance_transfer") {
    return transferDirection === "received"
      ? "Internal transfer received"
      : "Internal transfer sent";
  }

  return intentType === "vault_subscription"
    ? "Retirement Vault funding"
    : "Retirement Vault release";
}

export function formatIntentAmount(
  amount: string,
  assetSymbol: string,
  intentType: CustomerIntentType,
  locale: SupportedLocale = "en",
  transferDirection: "sent" | "received" | null = null
): string {
  const prefix =
    intentType === "deposit" ||
    intentType === "vault_redemption" ||
    (intentType === "internal_balance_transfer" &&
      transferDirection === "received")
      ? "+"
      : "-";
  return `${prefix}${formatTokenAmount(amount, locale)} ${assetSymbol}`;
}

export function resolveIntentAddress(input: {
  intentType: CustomerIntentType;
  externalAddress: string | null;
  destinationWalletAddress: string | null;
  sourceWalletAddress: string | null;
  latestBlockchainTransaction:
    | {
        fromAddress: string | null;
        toAddress: string | null;
      }
    | null;
  counterpartyMaskedDisplay?: string | null;
  counterpartyMaskedEmail?: string | null;
}): string {
  if (
    input.intentType === "vault_subscription" ||
    input.intentType === "vault_redemption"
  ) {
    return input.latestBlockchainTransaction?.toAddress ?? "Vault ledger";
  }

  if (input.intentType === "withdrawal") {
    return (
      input.externalAddress ??
      input.latestBlockchainTransaction?.toAddress ??
      input.sourceWalletAddress ??
      "N/A"
    );
  }

  if (input.intentType === "internal_balance_transfer") {
    return (
      input.counterpartyMaskedEmail ??
      input.counterpartyMaskedDisplay ??
      "Internal customer"
    );
  }

  return (
    input.destinationWalletAddress ??
    input.latestBlockchainTransaction?.toAddress ??
    "N/A"
  );
}

export function formatIntentStatusLabel(
  status: string,
  locale: SupportedLocale = "en"
): string {
  return getTransactionConfidenceLabel(
    mapIntentStatusToConfidence(status),
    locale
  );
}

export function getIntentConfidenceStatus(
  status: string
): TransactionConfidenceStatus {
  return mapIntentStatusToConfidence(status);
}

export function getIntentStatusBadgeTone(status: string): string {
  switch (getTransactionConfidenceTone(mapIntentStatusToConfidence(status))) {
    case "positive":
      return "bg-emerald-50 text-emerald-700";
    case "critical":
      return "bg-red-50 text-red-700";
    case "technical":
      return "bg-indigo-50 text-indigo-700";
    case "warning":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function getIntentStatusTextTone(status: string): string {
  switch (getTransactionConfidenceTone(mapIntentStatusToConfidence(status))) {
    case "positive":
      return "text-emerald-700";
    case "critical":
      return "text-red-700";
    case "technical":
      return "text-indigo-700";
    case "warning":
      return "text-amber-700";
    default:
      return "text-slate-700";
  }
}

export function buildIntentTimeline(input: {
  id: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  latestBlockchainTransaction?: {
    txHash: string | null;
  } | null;
}): TimelineEvent[] {
  return buildSharedIntentTimeline({
    id: input.id,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    txHash: input.latestBlockchainTransaction?.txHash ?? null
  });
}

export function isEthereumAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function buildRequestIdempotencyKey(prefix: string): string {
  const now = new Date();
  const timestamp = [
    now.getUTCFullYear().toString(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");
  const randomSegment =
    globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix}_${timestamp}_${randomSegment}`;
}
