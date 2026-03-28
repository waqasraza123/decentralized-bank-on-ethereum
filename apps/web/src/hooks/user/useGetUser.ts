import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useUserStore } from '@/stores/userStore';

const fetchUser = async (userId: string, token: string, setUser: (user: any) => void) => {
  if (!token) {
    throw new Error('User is not authenticated.');
  }

  const serverUrl = import.meta.env.VITE_SERVER_URL;
  const response = await axios.get(`${serverUrl}/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const userData = response.data.data;
  setUser(userData);
  return userData;
};

export const useGetUser = (userId: string) => {
  const token = useUserStore((state) => state.token);
  const setUser = useUserStore((state) => state.setUser);

  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId, token!, setUser),
    enabled: !!userId && !!token,
  });

  return {
    user,
    loading: isLoading,
    error: isError ? (error as Error).message : null,
  };
};
