import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useT();

  return (
    <div className="language-switcher" aria-label={t("locale.switcherLabel")}>
      <span className="language-switcher__label">
        {t("locale.switcherLabel")}
      </span>
      <button
        className={locale === "en" ? "active" : ""}
        onClick={() => setLocale("en")}
        type="button"
      >
        {t("locale.english")}
      </button>
      <button
        className={locale === "ar" ? "active" : ""}
        onClick={() => setLocale("ar")}
        type="button"
      >
        {t("locale.arabic")}
      </button>
    </div>
  );
}
