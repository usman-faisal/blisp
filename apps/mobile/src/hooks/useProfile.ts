import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
export interface Profile {
  id: string;
  email: string;
  name: string;
}

async function fetchProfile(): Promise<Profile> {
  const { data } = await apiClient.get<Profile>('/auth/me');
  return data;
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });
}
