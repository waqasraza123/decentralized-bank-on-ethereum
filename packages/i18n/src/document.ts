import {
  defaultLocale,
  localeMetadata,
  resolveLocaleDirection,
  type SupportedLocale
} from "./locales";

export const localeDocumentAttribute = "data-locale";

export function applyLocaleToDocument(locale: SupportedLocale): void {
  if (typeof document === "undefined") {
    return;
  }

  const html = document.documentElement;
  const metadata = localeMetadata[locale] ?? localeMetadata[defaultLocale];

  html.lang = metadata.htmlLang;
  html.dir = resolveLocaleDirection(locale);
  html.setAttribute(localeDocumentAttribute, locale);
}
