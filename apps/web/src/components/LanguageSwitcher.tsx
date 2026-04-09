import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";

type LanguageSwitcherProps = {
  className?: string;
  tone?: "default" | "light";
};

export function LanguageSwitcher({
  className,
  tone = "default"
}: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const t = useT();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1 py-1 shadow-sm backdrop-blur",
        tone === "light"
          ? "border-white/15 bg-white/10 text-auth-foreground"
          : "border-border/70 bg-background/80 text-foreground",
        className
      )}
      aria-label={t("locale.switcherLabel")}
    >
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]",
          tone === "light" ? "text-auth-muted" : "text-muted-foreground"
        )}
      >
        <Globe2 className="h-3.5 w-3.5" />
        <span>{t("locale.switcherLabel")}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setLocale("en")}
        className={cn(
          "h-9 rounded-full px-4 text-sm",
          locale === "en"
            ? tone === "light"
              ? "bg-white text-slate-950 hover:bg-white"
              : "bg-foreground text-background hover:bg-foreground"
            : tone === "light"
              ? "text-auth-foreground/80 hover:bg-white/10 hover:text-auth-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {t("locale.switchToEnglish")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setLocale("ar")}
        className={cn(
          "h-9 rounded-full px-4 text-sm",
          locale === "ar"
            ? tone === "light"
              ? "bg-white text-slate-950 hover:bg-white"
              : "bg-foreground text-background hover:bg-foreground"
            : tone === "light"
              ? "text-auth-foreground/80 hover:bg-white/10 hover:text-auth-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {t("locale.switchToArabic")}
      </Button>
    </div>
  );
}
