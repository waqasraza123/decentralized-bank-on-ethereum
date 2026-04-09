import { collectTranslationKeys } from "@stealth-trails-bank/i18n";
import { describe, expect, it } from "vitest";
import { webMessages } from "./messages/en";
import { webMessagesAr } from "./messages/ar";

describe("web translation coverage", () => {
  it("keeps English and Arabic catalogs in parity", () => {
    expect(collectTranslationKeys(webMessagesAr)).toEqual(
      collectTranslationKeys(webMessages)
    );
  });
});
