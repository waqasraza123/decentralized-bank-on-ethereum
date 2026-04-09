import { useAdminI18n } from "./provider";

export function useLocale() {
  const { locale, direction, setLocale } = useAdminI18n();

  return {
    locale,
    direction,
    setLocale,
    isRtl: direction === "rtl"
  };
}
