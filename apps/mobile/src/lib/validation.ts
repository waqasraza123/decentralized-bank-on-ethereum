const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isNonEmptyValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isEmailAddress(value: string | null | undefined): boolean {
  return typeof value === "string" && emailPattern.test(value.trim());
}

export function hasMinimumLength(
  value: string | null | undefined,
  minimumLength: number
): boolean {
  return typeof value === "string" && value.trim().length >= minimumLength;
}
