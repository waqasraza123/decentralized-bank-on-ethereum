import {
  applyLocaleToDocument,
  defaultLocale,
  createTranslator,
  localeMetadata,
  readStoredLocale,
  writeStoredLocale,
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
import { adminMessages, type AdminMessages } from "./messages/en";
import { adminMessagesAr } from "./messages/ar";

export const adminLocaleStorageKey = "stealth-trails-bank.admin.locale";

const catalogs: Record<SupportedLocale, AdminMessages> = {
  en: adminMessages,
  ar: adminMessagesAr
};

type AdminI18nContextValue = {
  locale: SupportedLocale;
  direction: "ltr" | "rtl";
  setLocale: (locale: SupportedLocale) => void;
  t: ReturnType<typeof createTranslator<AdminMessages>>;
};

const AdminI18nContext = createContext<AdminI18nContextValue | null>(null);

export function AdminI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<SupportedLocale>(() =>
    readStoredLocale(adminLocaleStorageKey, defaultLocale)
  );

  useEffect(() => {
    applyLocaleToDocument(locale);
    writeStoredLocale(adminLocaleStorageKey, locale);
  }, [locale]);

  const value = useMemo<AdminI18nContextValue>(() => {
    return {
      locale,
      direction: localeMetadata[locale].direction,
      setLocale,
      t: createTranslator(catalogs[locale])
    };
  }, [locale]);

  return (
    <AdminI18nContext.Provider value={value}>
      {children}
    </AdminI18nContext.Provider>
  );
}

export function useAdminI18n() {
  const context = useContext(AdminI18nContext);

  if (!context) {
    throw new Error("useAdminI18n must be used within AdminI18nProvider.");
  }

  return context;
}
