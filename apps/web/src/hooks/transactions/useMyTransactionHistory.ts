import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

export type TransactionHistoryIntent = {
  id: string;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  sourceWalletAddress: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  intentType: "deposit" | "withdrawal";
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
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  latestBlockchainTransaction: {
    id: string;
    txHash: string | null;
    status: string;
    fromAddress: string | null;
    toAddress: string | null;
    createdAt: string;
    updatedAt: string;
    confirmedAt: string | null;
  } | null;
};

type ListMyTransactionHistoryResult = {
  intents: TransactionHistoryIntent[];
  limit: number;
};

export function useMyTransactionHistory(limit = 100) {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["transaction-history", limit],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.get<
        ApiResponse<ListMyTransactionHistoryResult>
      >(`${webRuntimeConfig.serverUrl}/transaction-intents/me/history`, {
        params: {
          limit
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load transaction history."
        );
      }

      return response.data.data;
    }
  });
}
