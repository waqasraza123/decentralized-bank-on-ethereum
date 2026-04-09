import { useWebI18n } from "./provider";

export function useT() {
  return useWebI18n().t;
}
