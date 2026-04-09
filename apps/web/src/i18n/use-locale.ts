import { useWebI18n } from "./provider";

export function useLocale() {
  const { locale, direction, setLocale, toggleLocale } = useWebI18n();

  return {
    locale,
    direction,
    setLocale,
    toggleLocale,
    isRtl: direction === "rtl"
  };
}
