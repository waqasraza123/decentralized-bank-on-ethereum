import {
  applyLocaleToDocument,
  defaultLocale,
  formatCount,
  formatDateLabel,
  formatDateTimeLabel,
  formatDecimalString,
  localeMetadata,
  readStoredLocale,
  writeStoredLocale,
  createTranslator,
  type SupportedLocale
} from "@stealth-trails-bank/i18n";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { webMessages, type WebMessages } from "./messages/en";
import { webMessagesAr } from "./messages/ar";

export const webLocaleStorageKey = "stealth-trails-bank.web.locale";

const catalogs: Record<SupportedLocale, WebMessages> = {
  en: webMessages,
  ar: webMessagesAr
};

type WebI18nContextValue = {
  locale: SupportedLocale;
  direction: "ltr" | "rtl";
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  t: ReturnType<typeof createTranslator<WebMessages>>;
  formatters: {
    decimal: (value: string | null | undefined, maxFractionDigits?: number) => string;
    count: (value: number) => string;
    date: (value: string | Date) => string;
    dateTime: (value: string | Date | null | undefined) => string;
  };
};

const WebI18nContext = createContext<WebI18nContextValue | null>(null);

export function WebI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    readStoredLocale(webLocaleStorageKey, defaultLocale)
  );

  useEffect(() => {
    applyLocaleToDocument(locale);
    writeStoredLocale(webLocaleStorageKey, locale);
  }, [locale]);

  const value = useMemo<WebI18nContextValue>(() => {
    const t = createTranslator(catalogs[locale]);

    return {
      locale,
      direction: localeMetadata[locale].direction,
      setLocale: setLocaleState,
      toggleLocale: () => setLocaleState((current) => (current === "en" ? "ar" : "en")),
      t,
      formatters: {
        decimal: (value, maxFractionDigits) =>
          formatDecimalString(value, locale, maxFractionDigits),
        count: (value) => formatCount(value, locale),
        date: (value) => formatDateLabel(value, locale),
        dateTime: (value) => formatDateTimeLabel(value, locale)
      }
    };
  }, [locale]);

  return (
    <WebI18nContext.Provider value={value}>{children}</WebI18nContext.Provider>
  );
}

export function useWebI18n() {
  const context = useContext(WebI18nContext);

  if (!context) {
    throw new Error("useWebI18n must be used within WebI18nProvider.");
  }

  return context;
}
