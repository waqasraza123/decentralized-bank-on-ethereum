import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import type {
  RetirementVaultProjection,
  RetirementVaultReleaseRequestProjection,
} from "./useMyRetirementVaults";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type RequestRetirementVaultReleaseInput = {
  assetSymbol: string;
  amount: string;
  reasonCode?: string;
  reasonNote?: string;
  evidenceNote?: string;
};

export type RequestMyRetirementVaultReleaseResult = {
  vault: RetirementVaultProjection;
  releaseRequest: RetirementVaultReleaseRequestProjection;
  reviewCaseReused: boolean;
};

export function useRequestRetirementVaultRelease() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RequestRetirementVaultReleaseInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<RequestMyRetirementVaultReleaseResult>
      >(`${webRuntimeConfig.serverUrl}/retirement-vault/me/release-requests`, input, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to request retirement vault unlock."
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["retirement-vaults"],
      });
    },
  });
}
