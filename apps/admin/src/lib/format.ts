import axios from "axios";
import {
  formatCount as formatLocaleCount,
  formatDateTimeLabel,
  readStoredLocale,
  type SupportedLocale
} from "@stealth-trails-bank/i18n";

const adminLocaleStorageKey = "stealth-trails-bank.admin.locale";

function getCurrentLocale(): SupportedLocale {
  return readStoredLocale(adminLocaleStorageKey, "en");
}

export function readApiErrorMessage(
  error: unknown,
  fallbackMessage = "Request failed."
): string {
  if (axios.isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : undefined;

    return responseMessage ?? error.message ?? fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDateTimeLabel(value, getCurrentLocale());
}

export function formatCount(value: number): string {
  return formatLocaleCount(value, getCurrentLocale());
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs <= 0) {
    return getCurrentLocale() === "ar" ? "مفتوح" : "Open";
  }

  const totalMinutes = Math.floor(durationMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

export function formatName(firstName?: string | null, lastName?: string | null): string {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);

  return parts.length > 0
    ? parts.join(" ")
    : getCurrentLocale() === "ar"
      ? "عنصر غير مسمى"
      : "Unnamed subject";
}

export function shortenValue(value: string | null | undefined, size = 8): string {
  if (!value) {
    return getCurrentLocale() === "ar" ? "غير متاح" : "Not available";
  }

  if (value.length <= size * 2) {
    return value;
  }

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function toTitleCase(value: string | null | undefined): string {
  if (!value) {
    return getCurrentLocale() === "ar" ? "غير معروف" : "Unknown";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function trimToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
