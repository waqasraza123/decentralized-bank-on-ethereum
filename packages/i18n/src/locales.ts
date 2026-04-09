export const supportedLocales = ["en", "ar"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export type LocaleDirection = "ltr" | "rtl";

export type LocaleMetadata = {
  readonly locale: SupportedLocale;
  readonly direction: LocaleDirection;
  readonly htmlLang: string;
  readonly label: string;
  readonly nativeLabel: string;
};

export const localeMetadata: Record<SupportedLocale, LocaleMetadata> = {
  en: {
    locale: "en",
    direction: "ltr",
    htmlLang: "en",
    label: "English",
    nativeLabel: "English"
  },
  ar: {
    locale: "ar",
    direction: "rtl",
    htmlLang: "ar",
    label: "Arabic",
    nativeLabel: "العربية"
  }
};

export const defaultLocale: SupportedLocale = "en";

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}

export function resolveLocaleDirection(locale: SupportedLocale): LocaleDirection {
  return localeMetadata[locale].direction;
}

export function resolveHtmlLang(locale: SupportedLocale): string {
  return localeMetadata[locale].htmlLang;
}

export function resolveIntlLocale(locale: SupportedLocale): string {
  return locale === "ar" ? "ar" : "en-US";
}
