import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import type { RetirementVaultProjection } from "./useMyRetirementVaults";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type FundRetirementVaultInput = {
  idempotencyKey: string;
  assetSymbol: string;
  amount: string;
};

type RetirementVaultFundingIntentProjection = {
  id: string;
  retirementVaultId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: "vault_subscription";
  status:
    | "requested"
    | "review_required"
    | "approved"
    | "queued"
    | "broadcast"
    | "confirmed"
    | "settled"
    | "failed"
    | "cancelled"
    | "manually_resolved";
  policyDecision: "pending" | "approved" | "denied" | "review_required";
  requestedAmount: string;
  settledAmount: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type FundMyRetirementVaultResult = {
  vault: RetirementVaultProjection;
  intent: RetirementVaultFundingIntentProjection;
  idempotencyReused: boolean;
};

export function useFundRetirementVault() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FundRetirementVaultInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<FundMyRetirementVaultResult>
      >(`${webRuntimeConfig.serverUrl}/retirement-vault/me/funding-requests`, input, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to fund retirement vault."
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["retirement-vaults"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["transaction-history"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["customer-balances"]
      });
    }
  });
}
