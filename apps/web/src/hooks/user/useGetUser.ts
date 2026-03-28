import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type UserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress?: string | null;
};

type UserResponse = {
  status?: "success" | "failed";
  message?: string;
  data?: UserRecord;
};

function mapUserRecordToStoreUser(user: UserRecord) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    privateKey: "",
    supabaseUserId: user.supabaseUserId,
    ethereumAddress: user.ethereumAddress ?? ""
  };
}

export function useGetUser(userId: string | undefined) {
  const token = useUserStore((state) => state.token);
  const setUser = useUserStore((state) => state.setUser);

  return useQuery({
    queryKey: ["user", userId],
    enabled: Boolean(userId && token),
    queryFn: async () => {
      if (!userId) {
        throw new Error("User id is required.");
      }

      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.get<UserResponse>(
        `${webRuntimeConfig.serverUrl}/user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const user = response.data.data;

      if (!user) {
        throw new Error(response.data.message || "User payload is missing.");
      }

      setUser(mapUserRecordToStoreUser(user));

      return user;
    }
  });
}
