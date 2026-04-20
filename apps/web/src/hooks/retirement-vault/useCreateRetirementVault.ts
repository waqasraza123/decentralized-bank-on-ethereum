import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import type { RetirementVaultProjection } from "./useMyRetirementVaults";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type CreateRetirementVaultInput = {
  assetSymbol: string;
  unlockAt: string;
  strictMode?: boolean;
};

export type CreateMyRetirementVaultResult = {
  vault: RetirementVaultProjection;
  created: boolean;
};

export function useCreateRetirementVault() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRetirementVaultInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<CreateMyRetirementVaultResult>
      >(`${webRuntimeConfig.serverUrl}/retirement-vault/me`, input, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create retirement vault."
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["retirement-vaults"]
      });
    }
  });
}
