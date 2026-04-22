import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type ThresholdOutcome = "settled_immediately" | "review_required";

export type PreviewBalanceTransferRecipientResult = {
  normalizedEmail: string;
  available: boolean;
  maskedEmail: string | null;
  maskedDisplay: string | null;
  thresholdOutcome: ThresholdOutcome | null;
};

type PreviewBalanceTransferRecipientInput = {
  email: string;
  assetSymbol?: string;
  amount?: string;
};

type BalanceTransferIntentProjection = {
  id: string;
  customerAccountId: string | null;
  recipientCustomerAccountId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: "internal_balance_transfer";
  status: string;
  policyDecision: string;
  requestedAmount: string;
  settledAmount: string | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureReason: string | null;
  recipientMaskedDisplay: string | null;
  recipientMaskedEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBalanceTransferResult = {
  intent: BalanceTransferIntentProjection;
  idempotencyReused: boolean;
  thresholdOutcome: ThresholdOutcome;
};

type CreateBalanceTransferInput = {
  idempotencyKey: string;
  assetSymbol: string;
  amount: string;
  recipientEmail: string;
};

export function usePreviewBalanceTransferRecipient() {
  const token = useUserStore((state) => state.token);

  return useMutation({
    mutationFn: async (input: PreviewBalanceTransferRecipientInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<PreviewBalanceTransferRecipientResult>
      >(`${webRuntimeConfig.serverUrl}/balance-transfers/me/recipient-preview`, input, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to preview internal transfer recipient."
        );
      }

      return response.data.data;
    },
  });
}

export function useCreateBalanceTransfer() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBalanceTransferInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<ApiResponse<CreateBalanceTransferResult>>(
        `${webRuntimeConfig.serverUrl}/balance-transfers/me`,
        input,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create internal balance transfer."
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["transaction-history"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["customer-balances"],
      });
    },
  });
}
