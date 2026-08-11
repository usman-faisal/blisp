import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useProjectInvites } from '@/hooks/useProjectInvites';
import {
  createInvite,
  removeMember,
  revokeInvite,
  sendUserInvite,
} from '@/lib/api/collaboration';
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
  TextInput,
  View,
} from 'react-native';

/**
 * Matches the backend's IsEmail well enough to catch a typo before spending a
 * round trip on it. Deliberately loose — the server is the authority, and a
 * regex strict enough to reject every invalid address also rejects valid ones.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kept in step with ProjectAccessService.MAX_MEMBERS on the backend. */
const MAX_MEMBERS = 3;

export default function ProjectMembersScreen() {
  // Query param rather than a path segment: project/[id].tsx already owns the
  // [id] route, so a project/[id]/members.tsx would collide with it.
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = projectId;
  const router = useRouter();

  const { data: members, isLoading, mutate } = useProjectMembers(id!);
  const {
    data: outgoingInvites,
    setData: setOutgoingInvites,
    mutate: mutateInvites,
  } = useProjectInvites(id!);

  const [refreshing, setRefreshing] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const isOwner = members.some((member) => member.isSelf && member.role === 'OWNER');

  // A pending invite is a claim on a seat, so it counts toward the cap. Counting
  // members alone would let three invites go out for one free seat, and two of
  // those recipients would hit a 403 when they tried to accept — the failure
  // landing on the invitee, who did nothing wrong.
  const seatsTaken = members.length + outgoingInvites.length;
  const isFull = seatsTaken >= MAX_MEMBERS;

  const trimmedEmail = email.trim();
  const canSend = EMAIL_PATTERN.test(trimmedEmail) && !isSending && !isFull;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([mutate(), mutateInvites()]);
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

  /**
   * Sends a targeted invite by email.
   *
   * The backend distinguishes the failure modes that matter — no such account,
   * already a member, already invited, project full — so its message is shown
   * rather than a generic one. The single case worth handling specially is 404:
   * the person may simply not have signed up yet, and the share code is the way
   * to reach someone who has no account to be invited to.
   */
  const handleSendInvite = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      await sendUserInvite(id!, trimmedEmail);
      setEmail('');

      // Both lists move: the invite appears under "awaiting reply", and the seat
      // count it now occupies feeds the capacity check.
      await mutateInvites();
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ?? 'Something went wrong. Please try again.';

      if (status === 404) {
        Alert.alert('No account with that email', `${message}\n\nSend them a share code instead?`, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Share a code', onPress: handleInvite },
        ]);
      } else {
        Alert.alert('Could not send invitation', message);
      }
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Withdraws an invitation, optimistically. Restored on failure — a row that
   * silently vanishes reads as success when the invite is in fact still live.
   */
  const handleRevoke = (inviteId: string, name: string) => {
    Alert.alert(
      `Withdraw the invitation to ${name}?`,
      'They will stop seeing it, and can be invited again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            const previous = outgoingInvites;
            setRevokingId(inviteId);
            setOutgoingInvites((rows) => rows.filter((row) => row.id !== inviteId));

            try {
              await revokeInvite(inviteId);
              await mutateInvites();
            } catch (error: any) {
              setOutgoingInvites(previous);
              Alert.alert(
                'Could not withdraw',
                error?.response?.data?.message ?? 'Something went wrong.',
              );
            } finally {
              setRevokingId(null);
            }
          },
        },
      ],
    );
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
          {outgoingInvites.length > 0 &&
            ` ${outgoingInvites.length} ${
              outgoingInvites.length === 1 ? 'invitation' : 'invitations'
            } awaiting a reply.`}
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

        {/* Outgoing invitations. Absent once answered or expired — the endpoint
            returns pending and unexpired only, so a declined invite leaves no
            ghost row behind. */}
        {outgoingInvites.length > 0 && (
          <View className="mt-2">
            <Text className="mb-2 text-xs uppercase tracking-wide text-core-text-secondary">
              Awaiting reply
            </Text>

            {outgoingInvites.map((invite) => (
              <View
                key={invite.id}
                className="mb-3 flex-row items-center gap-3 rounded-2xl border border-semantic-border bg-core-background p-4">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-core-surface">
                  <Ionicons name="hourglass-outline" size={20} color="#B0AAA3" />
                </View>

                <View className="flex-1">
                  <Text className="font-semibold text-core-text-primary">
                    {invite.invitedUserName}
                  </Text>
                  <Text className="text-xs text-core-text-secondary">
                    {invite.invitedUserEmail}
                  </Text>
                </View>

                {revokingId === invite.id ? (
                  <ActivityIndicator size="small" color="#6B6560" />
                ) : (
                  // Shown to any member: the backend allows the sender or the
                  // owner, and rejects anyone else. A member who sees a control
                  // they cannot use is worse than one who never sees it, so this
                  // is limited to the owner and the person who sent it.
                  (isOwner || invite.invitedBy === members.find((m) => m.isSelf)?.name) && (
                    <Pressable
                      onPress={() => handleRevoke(invite.id, invite.invitedUserName)}
                      hitSlop={8}>
                      <Ionicons name="close-circle-outline" size={22} color="#D94F3D" />
                    </Pressable>
                  )
                )}
              </View>
            ))}
          </View>
        )}

        {/* Invite by email — the in-app path. The share code below stays as the
            fallback for someone who has no account yet. */}
        {!isFull && (
          <View className="mt-4 rounded-2xl bg-core-surface p-4">
            <Text className="mb-2 text-xs uppercase tracking-wide text-core-text-secondary">
              Invite by email
            </Text>

            <View className="flex-row items-center gap-2">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor="#B0AAA3"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={handleSendInvite}
                editable={!isSending}
                className="flex-1 rounded-xl bg-core-background px-3 py-3 font-text text-base text-core-text-primary"
              />

              <Pressable
                onPress={handleSendInvite}
                disabled={!canSend}
                className={`h-12 w-12 items-center justify-center rounded-xl ${
                  canSend ? 'bg-brand-ember' : 'bg-core-surface-elevated'
                }`}>
                {isSending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="send" size={17} color={canSend ? '#FFFFFF' : '#B0AAA3'} />
                )}
              </Pressable>
            </View>

            <Text className="mt-2 text-xs text-core-text-secondary">
              They&apos;ll get an invitation in the app. No code to share.
            </Text>
          </View>
        )}

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
                {/* "Full" now covers seats held by unanswered invitations, so it
                    would be wrong to blame the member count for it. */}
                {isFull
                  ? members.length >= MAX_MEMBERS
                    ? 'Project is full'
                    : 'All seats claimed'
                  : 'Share a code instead'}
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </Container>
  );
}
