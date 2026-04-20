import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export type RetirementVaultProjection = {
  id: string;
  customerAccountId: string;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  status: "active" | "restricted" | "released";
  strictMode: boolean;
  unlockAt: string;
  lockedBalance: string;
  fundedAt: string | null;
  lastFundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListMyRetirementVaultsResult = {
  customerAccountId: string;
  vaults: RetirementVaultProjection[];
};

export function useMyRetirementVaults() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["retirement-vaults"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response =
        await axios.get<ApiResponse<ListMyRetirementVaultsResult>>(
          `${webRuntimeConfig.serverUrl}/retirement-vault/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load retirement vaults."
        );
      }

      return response.data.data;
    }
  });
}
