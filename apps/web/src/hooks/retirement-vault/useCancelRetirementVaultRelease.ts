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

export type CancelMyRetirementVaultReleaseResult = {
  vault: RetirementVaultProjection;
  releaseRequest: RetirementVaultReleaseRequestProjection;
};

export function useCancelRetirementVaultRelease() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (releaseRequestId: string) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<CancelMyRetirementVaultReleaseResult>
      >(
        `${webRuntimeConfig.serverUrl}/retirement-vault/me/release-requests/${releaseRequestId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to cancel retirement vault unlock request."
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
