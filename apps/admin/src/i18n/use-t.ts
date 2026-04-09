import { useAdminI18n } from "./provider";

export function useT() {
  return useAdminI18n().t;
}
