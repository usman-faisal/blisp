import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { acceptInvite, getInvitePreview } from '@/lib/api/collaboration';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import type { InvitePreviewPayload } from '@repo/types';

/**
 * Landing screen for `blisp://invite/CODE` deep links and manual code entry.
 *
 * Previews the project before joining, so the user knows what they are
 * accepting rather than being dropped into an unfamiliar project.
 */
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [preview, setPreview] = useState<InvitePreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!code) return;
    setIsLoading(true);
    try {
      const response = await getInvitePreview(code);
      setPreview(response.data);
      setError(null);
    } catch (err: any) {
      // The backend distinguishes unknown (404) from expired/used (410), so
      // show its message instead of a generic failure.
      setError(err?.response?.data?.message ?? 'This invite could not be opened.');
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      const response = await acceptInvite(code!);
      router.replace(`/project/${response.data.projectId}`);
    } catch (err: any) {
      Alert.alert(
        'Could not join',
        err?.response?.data?.message ?? 'Something went wrong. Please try again.',
      );
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Container>
    );
  }

  if (error || !preview) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#D94F3D" />
          <Text className="mt-4 text-center font-heading text-xl text-core-text-primary">
            Invite unavailable
          </Text>
          <Text className="mt-2 text-center text-sm text-core-text-secondary">{error}</Text>

          <Pressable
            onPress={() => router.replace('/(tabs)')}
            className="mt-8 rounded-[28px] bg-brand-ember px-8 py-4">
            <Text className="font-text text-lg font-semibold text-white">Go home</Text>
          </Pressable>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <View className="flex-1 justify-center px-6">
        <View className="rounded-3xl bg-core-surface p-6">
          <Text className="text-xs uppercase text-core-text-secondary">
            {preview.invitedBy} invited you to
          </Text>

          <Text className="mt-2 font-heading text-2xl text-core-text-primary">
            {preview.projectTitle}
          </Text>

          {preview.projectDescription && (
            <Text className="mt-2 text-sm text-core-text-secondary">
              {preview.projectDescription}
            </Text>
          )}

          <View className="mt-4 flex-row items-center gap-1.5">
            <Ionicons name="people-outline" size={16} color="#6B6560" />
            <Text className="text-xs text-core-text-secondary">
              {preview.memberCount} {preview.memberCount === 1 ? 'person' : 'people'} so far
            </Text>
          </View>
        </View>

        {preview.alreadyMember ? (
          <Pressable
            onPress={() => router.replace('/(tabs)/projects')}
            className="mt-6 items-center rounded-[28px] bg-core-surface p-4">
            <Text className="font-text text-lg font-semibold text-core-text-secondary">
              You are already a member
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleJoin}
            disabled={isJoining}
            className="mt-6 items-center rounded-[28px] bg-brand-ember p-4">
            {isJoining ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-text text-lg font-semibold text-white">Join project</Text>
            )}
          </Pressable>
        )}

        <Pressable onPress={() => router.replace('/(tabs)')} className="mt-3 items-center p-3">
          <Text className="text-sm text-core-text-secondary">Not now</Text>
        </Pressable>
      </View>
    </Container>
  );
}
