import {
  hasMinimumLength,
  isEmailAddress,
  isNonEmptyValue
} from "./validation";

describe("validation", () => {
  it("accepts non-empty trimmed values", () => {
    expect(isNonEmptyValue(" value ")).toBe(true);
    expect(isNonEmptyValue("   ")).toBe(false);
    expect(isNonEmptyValue(null)).toBe(false);
  });

  it("validates email addresses", () => {
    expect(isEmailAddress("customer@example.com")).toBe(true);
    expect(isEmailAddress(" customer@example.com ")).toBe(true);
    expect(isEmailAddress("customer")).toBe(false);
    expect(isEmailAddress("customer@")).toBe(false);
  });

  it("checks minimum length after trimming", () => {
    expect(hasMinimumLength("12345678", 8)).toBe(true);
    expect(hasMinimumLength(" 1234567 ", 8)).toBe(false);
    expect(hasMinimumLength(undefined, 8)).toBe(false);
  });
});
