import {
  defaultLocale,
  isSupportedLocale,
  resolveLocaleDirection,
  resolveHtmlLang,
  type SupportedLocale
} from "./locales";

export function readStoredLocale(
  storageKey: string,
  fallbackLocale: SupportedLocale = defaultLocale
): SupportedLocale {
  if (typeof window === "undefined") {
    return fallbackLocale;
  }

  try {
    const storedLocale = window.localStorage.getItem(storageKey);
    return isSupportedLocale(storedLocale) ? storedLocale : fallbackLocale;
  } catch {
    return fallbackLocale;
  }
}

export function writeStoredLocale(
  storageKey: string,
  locale: SupportedLocale
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, locale);
  } catch {
    // Swallow storage failures so locale switching still works in-memory.
  }
}

export function buildLocaleBootstrapScript(
  storageKey: string,
  fallbackLocale: SupportedLocale = defaultLocale
): string {
  const serializedFallbackLocale = JSON.stringify(fallbackLocale);
  const serializedStorageKey = JSON.stringify(storageKey);

  return `(function(){try{var key=${serializedStorageKey};var fallback=${serializedFallbackLocale};var stored=window.localStorage.getItem(key);var locale=(stored==="ar"||stored==="en")?stored:fallback;var html=document.documentElement;html.lang=locale==="ar"?"ar":"en";html.dir=locale==="ar"?"rtl":"ltr";html.setAttribute("data-locale",locale);}catch(_error){var html=document.documentElement;html.lang=${serializedFallbackLocale}==="ar"?"ar":"en";html.dir=${serializedFallbackLocale}==="ar"?"rtl":"ltr";html.setAttribute("data-locale",${serializedFallbackLocale});}})();`;
}

export function buildLocaleSnapshot(
  storageKey: string,
  fallbackLocale: SupportedLocale = defaultLocale
): {
  locale: SupportedLocale;
  direction: "ltr" | "rtl";
  htmlLang: string;
} {
  const locale = readStoredLocale(storageKey, fallbackLocale);

  return {
    locale,
    direction: resolveLocaleDirection(locale),
    htmlLang: resolveHtmlLang(locale)
  };
}
