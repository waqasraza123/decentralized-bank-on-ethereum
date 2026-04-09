import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WebI18nProvider } from "@/i18n/provider";
import { useFormatters } from "@/i18n/use-formatters";

describe("useFormatters", () => {
  it("returns the provider-backed formatters", () => {
    const { result } = renderHook(() => useFormatters(), {
      wrapper: ({ children }) => <WebI18nProvider>{children}</WebI18nProvider>
    });

    expect(result.current.decimal("1234.5")).toBe("1,234.5");
    expect(result.current.count(12)).toBe("12");
    expect(result.current.date("2026-04-05T10:00:00.000Z")).toContain("2026");
    expect(result.current.dateTime("2026-04-05T10:00:00.000Z")).toContain("2026");
  });
});
