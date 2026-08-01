import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { createInvite, removeMember } from '@/lib/api/collaboration';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  View,
} from 'react-native';

/** Kept in step with ProjectAccessService.MAX_MEMBERS on the backend. */
const MAX_MEMBERS = 3;

export default function ProjectMembersScreen() {
  // Query param rather than a path segment: project/[id].tsx already owns the
  // [id] route, so a project/[id]/members.tsx would collide with it.
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = projectId;
  const router = useRouter();

  const { data: members, isLoading, mutate } = useProjectMembers(id!);

  const [refreshing, setRefreshing] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const isOwner = members.some((member) => member.isSelf && member.role === 'OWNER');
  const isFull = members.length >= MAX_MEMBERS;

  const onRefresh = async () => {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
  };

  const handleInvite = async () => {
    setIsInviting(true);
    try {
      const response = await createInvite(id!);
      setInviteCode(response.data.code);

      await Share.share({
        message: `Join me on blisp — use invite code ${response.data.code}\n${response.data.shareUrl}`,
      });
    } catch (error: any) {
      // The backend rejects a code it could not honour, so surface its reason
      // rather than a generic failure.
      Alert.alert(
        'Could not create invite',
        error?.response?.data?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = (userId: string, name: string) => {
    Alert.alert(
      `Remove ${name}?`,
      'They will lose access to this project. Their tasks return to the backlog.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(id!, userId);
              await mutate();
            } catch (error: any) {
              Alert.alert(
                'Could not remove',
                error?.response?.data?.message ?? 'Something went wrong.',
              );
            }
          },
        },
      ],
    );
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

  return (
    <Container>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View className="flex-row items-center gap-3 py-4">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#2B2724" />
          </Pressable>
          <Text className="font-heading text-2xl text-core-text-primary">Collaborators</Text>
        </View>

        <Text className="mb-5 text-sm text-core-text-secondary">
          {members.length} of {MAX_MEMBERS} people on this project.
        </Text>

        {members.map((member) => (
          <View
            key={member.userId}
            className="mb-3 flex-row items-center gap-3 rounded-2xl bg-core-surface p-4">
            <MemberAvatar name={member.name} size={44} />

            <View className="flex-1">
              <Text className="font-semibold text-core-text-primary">
                {member.name}
                {member.isSelf ? ' (you)' : ''}
              </Text>
              <Text className="text-xs text-core-text-secondary">{member.email}</Text>
            </View>

            {member.role === 'OWNER' ? (
              <View className="rounded-full bg-brand-flax/15 px-2.5 py-0.5">
                <Text className="text-xs font-semibold text-brand-flax">Owner</Text>
              </View>
            ) : (
              // Only the owner can remove, and never themselves — matches the
              // backend rule rather than relying on it to reject the request.
              isOwner && (
                <Pressable onPress={() => handleRemove(member.userId, member.name)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={22} color="#D94F3D" />
                </Pressable>
              )
            )}
          </View>
        ))}

        {inviteCode && (
          <View className="mt-4 rounded-2xl border border-brand-ember-mist bg-brand-ember-mist/30 p-4">
            <Text className="mb-1 text-xs uppercase text-core-text-secondary">Invite code</Text>
            <Text className="font-heading text-3xl tracking-widest text-core-text-primary">
              {inviteCode}
            </Text>
            <Text className="mt-2 text-xs text-core-text-secondary">
              Valid for 7 days, single use.
            </Text>
          </View>
        )}

        <Pressable
          onPress={handleInvite}
          disabled={isFull || isInviting}
          className={`mt-6 flex-row items-center justify-center gap-2 rounded-[28px] p-4 ${
            isFull ? 'bg-core-surface' : 'bg-brand-ember'
          }`}>
          {isInviting ? (
            <ActivityIndicator color={isFull ? '#6B6560' : '#FFFFFF'} />
          ) : (
            <>
              <Ionicons
                name="person-add-outline"
                size={18}
                color={isFull ? '#6B6560' : '#FFFFFF'}
              />
              <Text
                className={`font-text text-lg font-semibold ${
                  isFull ? 'text-core-text-secondary' : 'text-white'
                }`}>
                {isFull ? 'Project is full' : 'Invite someone'}
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </Container>
  );
}
