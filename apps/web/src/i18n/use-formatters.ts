import { useWebI18n } from "./provider";

export function useFormatters() {
  return useWebI18n().formatters;
}
