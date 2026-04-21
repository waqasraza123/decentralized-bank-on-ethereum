import { resolveIntlLocale, type SupportedLocale } from "./locales";

type IntlFormatters = {
  readonly decimalSeparator: string;
  readonly digits: readonly string[];
  readonly groupSeparator: string;
  readonly dateFormatter: Intl.DateTimeFormat;
  readonly dateTimeFormatter: Intl.DateTimeFormat;
  readonly countFormatter: Intl.NumberFormat;
};

function buildDigitMap(locale: SupportedLocale): readonly string[] {
  const formatter = new Intl.NumberFormat(resolveIntlLocale(locale), {
    useGrouping: false
  });

  return Array.from({ length: 10 }, (_, index) => formatter.format(index));
}

function resolveDecimalSeparator(locale: SupportedLocale): string {
  const formatter = new Intl.NumberFormat(resolveIntlLocale(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const formatToParts = formatter.formatToParts;

  if (typeof formatToParts === "function") {
    const parts = formatToParts.call(formatter, 1.1);

    return parts.find((part) => part.type === "decimal")?.value ?? ".";
  }

  const sample = formatter.format(1.1);
  const parts = sample.match(/[^\p{Number}\p{Letter}\s]/u);

  return parts?.[0] ?? ".";
}

function resolveGroupSeparator(locale: SupportedLocale): string {
  const formatter = new Intl.NumberFormat(resolveIntlLocale(locale), {
    useGrouping: true
  });
  const formatToParts = formatter.formatToParts;

  if (typeof formatToParts === "function") {
    const parts = formatToParts.call(formatter, 1000);

    return parts.find((part) => part.type === "group")?.value ?? ",";
  }

  const sample = formatter.format(1000);
  const parts = sample.match(/[^\p{Number}\p{Letter}\s]/u);

  return parts?.[0] ?? ",";
}

function localizeWholeNumberString(
  value: string,
  digits: readonly string[],
  groupSeparator: string
): string {
  const groupedValue = value.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  return localizeDigits(groupedValue, digits);
}

function createIntlFormatters(locale: SupportedLocale): IntlFormatters {
  const intlLocale = resolveIntlLocale(locale);

  return {
    decimalSeparator: resolveDecimalSeparator(locale),
    digits: buildDigitMap(locale),
    groupSeparator: resolveGroupSeparator(locale),
    dateFormatter: new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    dateTimeFormatter: new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }),
    countFormatter: new Intl.NumberFormat(intlLocale)
  };
}

const formatterCache = new Map<SupportedLocale, IntlFormatters>();

function getCachedFormatters(locale: SupportedLocale): IntlFormatters {
  const cachedFormatters = formatterCache.get(locale);

  if (cachedFormatters) {
    return cachedFormatters;
  }

  const nextFormatters = createIntlFormatters(locale);
  formatterCache.set(locale, nextFormatters);
  return nextFormatters;
}

function localizeDigits(value: string, digits: readonly string[]): string {
  return value.replace(/\d/g, (digit) => digits[Number(digit)]);
}

export function formatDecimalString(
  value: string | null | undefined,
  locale: SupportedLocale,
  maxFractionDigits = 6
): string {
  if (!value) {
    return localizeDigits("0", getCachedFormatters(locale).digits);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return localizeDigits("0", getCachedFormatters(locale).digits);
  }

  const { digits, decimalSeparator, groupSeparator } = getCachedFormatters(locale);
  const isNegative = normalizedValue.startsWith("-");
  const unsignedValue = isNegative ? normalizedValue.slice(1) : normalizedValue;
  const [wholePartText = "0", fractionPartText = ""] = unsignedValue.split(".");
  const wholePart = wholePartText.replace(/^0+(?=\d)/, "") || "0";
  const localizedWholePart = localizeWholeNumberString(
    wholePart,
    digits,
    groupSeparator
  );
  const trimmedFractionPart = fractionPartText
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  const localizedFractionPart = trimmedFractionPart
    ? `${decimalSeparator}${localizeDigits(trimmedFractionPart, digits)}`
    : "";

  return `${isNegative ? "-" : ""}${localizedWholePart}${localizedFractionPart}`;
}

export function formatCount(
  value: number,
  locale: SupportedLocale
): string {
  return getCachedFormatters(locale).countFormatter.format(value);
}

export function formatDateLabel(
  value: string | Date,
  locale: SupportedLocale
): string {
  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return getCachedFormatters(locale).dateFormatter.format(parsedDate);
}

export function formatDateTimeLabel(
  value: string | Date | null | undefined,
  locale: SupportedLocale
): string {
  if (!value) {
    return locale === "ar" ? "غير متاح" : "Not available";
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return getCachedFormatters(locale).dateTimeFormatter.format(parsedDate);
}
