import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { GetProfileResponse, UserResponsePayload } from '@repo/types';

async function fetchProfile(): Promise<UserResponsePayload> {
  const { data } = await apiClient.get<GetProfileResponse>('/auth/me');
  return data.data;
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });
}
