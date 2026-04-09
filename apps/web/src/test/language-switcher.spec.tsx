import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WebI18nProvider, webLocaleStorageKey } from "@/i18n/provider";

describe("language switcher", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  });

  it("switches locale in the default tone", async () => {
    const user = userEvent.setup();

    render(
      <WebI18nProvider>
        <LanguageSwitcher />
      </WebI18nProvider>
    );

    expect(screen.getByLabelText("Language")).toHaveClass(
      "border-border/70",
      "bg-background/80",
      "text-foreground"
    );
    expect(screen.getByRole("button", { name: "English" })).toHaveClass(
      "bg-foreground",
      "text-background"
    );

    await user.click(screen.getByRole("button", { name: "العربية" }));

    expect(screen.getByLabelText("اللغة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "العربية" })).toHaveClass(
      "bg-foreground",
      "text-background"
    );
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(localStorage.getItem(webLocaleStorageKey)).toBe("ar");
  });

  it("renders the light tone with the Arabic locale active", async () => {
    const user = userEvent.setup();
    localStorage.setItem(webLocaleStorageKey, "ar");

    render(
      <WebI18nProvider>
        <LanguageSwitcher tone="light" />
      </WebI18nProvider>
    );

    expect(screen.getByLabelText("اللغة")).toHaveClass(
      "border-white/15",
      "bg-white/10",
      "text-auth-foreground"
    );
    expect(screen.getByRole("button", { name: "العربية" })).toHaveClass(
      "bg-white",
      "text-slate-950"
    );
    expect(screen.getByRole("button", { name: "English" })).toHaveClass(
      "text-auth-foreground/80"
    );

    await user.click(screen.getByRole("button", { name: "English" }));

    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem(webLocaleStorageKey)).toBe("en");
  });
});
