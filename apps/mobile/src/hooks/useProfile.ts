import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { User } from "@repo/db"

async function fetchProfile(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });
}
