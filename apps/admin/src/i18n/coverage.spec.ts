import { collectTranslationKeys } from "@stealth-trails-bank/i18n";
import { describe, expect, it } from "vitest";
import { adminMessages } from "./messages/en";
import { adminMessagesAr } from "./messages/ar";

describe("admin translation coverage", () => {
  it("keeps English and Arabic catalogs in parity", () => {
    expect(collectTranslationKeys(adminMessagesAr)).toEqual(
      collectTranslationKeys(adminMessages)
    );
  });
});
