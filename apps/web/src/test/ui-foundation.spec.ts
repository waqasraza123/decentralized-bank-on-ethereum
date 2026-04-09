import { describe, expect, it } from "vitest";
import {
  formatReferenceValue,
  getTransactionConfidenceLabel,
  mapIntentStatusToConfidence
} from "@stealth-trails-bank/ui-foundation";

describe("ui foundation helpers", () => {
  it("maps backend intent states into customer confidence states", () => {
    expect(mapIntentStatusToConfidence("requested")).toBe("submitted");
    expect(mapIntentStatusToConfidence("broadcast")).toBe("sent_to_network");
    expect(mapIntentStatusToConfidence("settled")).toBe("complete");
  });

  it("formats shared presentation labels and references", () => {
    expect(getTransactionConfidenceLabel("under_review")).toBe("Under review");
    expect(formatReferenceValue("reference_abcdefghijklmnopqrstuvwxyz", "None", 6)).toBe(
      "refere...uvwxyz"
    );
  });
});
