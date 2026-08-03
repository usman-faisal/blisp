import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { useNotifications } from '@/hooks/useNotifications';
import { usePendingInvites } from '@/hooks/usePendingInvites';
import {
  acceptTargetedInvite,
  declineInvite,
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';
import { Ionicons } from '@expo/vector-icons';
import type { NotificationResponse, PendingInvitePayload } from '@repo/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

/**
 * Icon and tint per notification kind.
 *
 * Keyed on `type` rather than the title string. Before 8A added the enum, kind
 * was only recoverable by matching literal titles — which meant a copy edit on
 * the backend would silently change the icon here.
 */
const KIND: Record<
  NotificationResponse['type'],
  { icon: keyof typeof Ionicons.glyphMap; tint: string }
> = {
  PROJECT_INVITE: { icon: 'mail-outline', tint: '#E8612A' },
  MEMBER_JOINED: { icon: 'person-add-outline', tint: '#6A8F7A' },
  TASK_ASSIGNED: { icon: 'checkbox-outline', tint: '#4A7FA5' },
  TASK_COMPLETED: { icon: 'checkmark-done-outline', tint: '#4A8C68' },
  TASK_COMMENTED: { icon: 'chatbubble-outline', tint: '#6B6560' },
  TASK_MENTIONED: { icon: 'at-outline', tint: '#C9A84C' },
  GENERIC: { icon: 'notifications-outline', tint: '#6B6560' },
};

/** "3h", "2d" — compact enough for a row that already carries a message. */
function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);

  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();

  const {
    data: notifications,
    setData: setNotifications,
    unreadCount,
    setUnreadCount,
    isLoading,
    mutate,
  } = useNotifications();

  const { data: invites, setData: setInvites, mutate: mutateInvites } = usePendingInvites();

  const [refreshing, setRefreshing] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  // A tab screen stays mounted once visited, so without this it would keep
  // showing whatever it fetched the first time. Silent — the list is already on
  // screen and a spinner on every tab switch would read as a reload.
  useFocusEffect(
    useCallback(() => {
      mutate();
      mutateInvites();
    }, [mutate, mutateInvites]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([mutate(), mutateInvites()]);
    setRefreshing(false);
  };

  /**
   * Marks read optimistically, then navigates. Waiting on the round trip before
   * moving would make every tap feel slow for a change the user cannot see.
   */
  const handlePress = async (notification: NotificationResponse) => {
    // Invites are answered in place; the buttons on the row do the work.
    if (notification.type === 'PROJECT_INVITE' && notification.inviteId) {
      return;
    }

    if (!notification.readAt) {
      setNotifications((rows) =>
        rows.map((row) =>
          row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));

      // Failure is not surfaced: the row is cosmetic and the next fetch corrects
      // it. Blocking navigation on it would be worse than a stale dot.
      markNotificationRead(notification.id).catch((error) =>
        console.error('Error marking notification read:', error),
      );
    }

    if (notification.url) {
      router.push(notification.url as never);
    }
  };

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString();
    const previous = notifications;

    setNotifications((rows) => rows.map((row) => row.readAt ? row : { ...row, readAt: now }));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
    } catch (error) {
      // Reverting matters here, unlike a single row: the user asked for this
      // explicitly, so silently doing nothing would be misleading.
      setNotifications(previous);
      await mutate();
      Alert.alert('Could not mark all as read', 'Please try again.');
    }
  };

  const handleDismiss = async (id: string) => {
    const previous = notifications;
    const wasUnread = !notifications.find((row) => row.id === id)?.readAt;

    setNotifications((rows) => rows.filter((row) => row.id !== id));
    if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await dismissNotification(id);
    } catch (error) {
      setNotifications(previous);
      await mutate();
    }
  };

  /**
   * Accept and decline both remove the invite optimistically and put it back on
   * failure. An invitation that silently vanishes when the call fails reads as
   * data loss.
   */
  const handleInviteResponse = async (
    invite: PendingInvitePayload,
    action: 'accept' | 'decline',
  ) => {
    setBusyInviteId(invite.id);
    const previous = invites;

    setInvites((rows) => rows.filter((row) => row.id !== invite.id));

    try {
      if (action === 'accept') {
        await acceptTargetedInvite(invite.id);
      } else {
        await declineInvite(invite.id);
      }

      // The invite's notification is stale either way — it offered a choice that
      // has now been made.
      await Promise.all([mutate(), mutateInvites()]);

      if (action === 'accept') {
        router.push(`/project/${invite.projectId}` as never);
      }
    } catch (error: any) {
      setInvites(previous);
      Alert.alert(
        action === 'accept' ? 'Could not join' : 'Could not decline',
        error?.response?.data?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setBusyInviteId(null);
    }
  };

  // Invite notifications are represented by the invite cards above, so showing
  // both would ask the same question twice.
  const rows = notifications.filter(
    (row) => !(row.type === 'PROJECT_INVITE' && row.inviteId),
  );

  const isEmpty = rows.length === 0 && invites.length === 0;

  return (
    <Container className="bg-core-background">
      {/* No back button: this is a tab, reached by tapping Alerts rather than
          pushed onto a stack. */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text className="font-heading text-2xl text-core-text-primary">Notifications</Text>

        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text className="font-text text-sm font-medium text-brand-ember">
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#E8612A" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8612A" />
          }
        >
          {isEmpty ? (
            <View className="mt-24 items-center px-8">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-core-surface">
                <Ionicons name="notifications-off-outline" size={28} color="#B0AAA3" />
              </View>
              <Text className="text-center font-heading text-xl text-core-text-primary">
                You&apos;re all caught up
              </Text>
              <Text className="mt-1 text-center font-text text-sm text-core-text-secondary">
                Invitations, mentions and task updates will appear here.
              </Text>
            </View>
          ) : (
            <>
              {/* Invitations first: they need an answer, and would otherwise
                  scroll away beneath older "task completed" rows. */}
              {invites.length > 0 && (
                <View className="mb-2 mt-2">
                  <Text className="mb-2 font-text text-xs uppercase tracking-wide text-core-text-secondary">
                    Invitations
                  </Text>

                  {invites.map((invite) => (
                    <View
                      key={invite.id}
                      className="mb-3 rounded-2xl border border-brand-ember/20 bg-brand-ember-mist p-4"
                    >
                      <View className="flex-row items-center gap-x-2">
                        <Ionicons name="mail-outline" size={16} color="#E8612A" />
                        <Text className="font-text text-xs text-core-text-secondary">
                          {invite.invitedBy} invited you
                        </Text>
                      </View>

                      <Text className="mt-1.5 font-heading text-lg text-core-text-primary">
                        {invite.projectTitle}
                      </Text>

                      {invite.projectDescription ? (
                        <Text
                          numberOfLines={2}
                          className="mt-0.5 font-text text-sm text-core-text-secondary"
                        >
                          {invite.projectDescription}
                        </Text>
                      ) : null}

                      <Text className="mt-1 font-text text-xs text-core-text-secondary">
                        {invite.memberCount}{' '}
                        {invite.memberCount === 1 ? 'person' : 'people'} already here
                      </Text>

                      <View className="mt-3 flex-row gap-x-2">
                        <Pressable
                          disabled={busyInviteId === invite.id}
                          onPress={() => handleInviteResponse(invite, 'accept')}
                          className="flex-1 items-center rounded-xl bg-brand-ember py-2.5"
                        >
                          {busyInviteId === invite.id ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text className="font-text text-sm font-semibold text-white">
                              Join project
                            </Text>
                          )}
                        </Pressable>

                        <Pressable
                          disabled={busyInviteId === invite.id}
                          onPress={() => handleInviteResponse(invite, 'decline')}
                          className="items-center rounded-xl border border-semantic-border bg-core-surface px-5 py-2.5"
                        >
                          <Text className="font-text text-sm font-medium text-core-text-secondary">
                            Decline
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {rows.length > 0 && (
                <>
                  {invites.length > 0 && (
                    <Text className="mb-2 mt-2 font-text text-xs uppercase tracking-wide text-core-text-secondary">
                      Earlier
                    </Text>
                  )}

                  {rows.map((row) => {
                    const kind = KIND[row.type] ?? KIND.GENERIC;
                    const isUnread = !row.readAt;

                    return (
                      <Pressable
                        key={row.id}
                        onPress={() => handlePress(row)}
                        className={`mb-2 flex-row items-start gap-x-3 rounded-2xl p-3 ${
                          isUnread ? 'bg-core-surface' : 'bg-transparent'
                        }`}
                      >
                        <View
                          className="mt-0.5 h-9 w-9 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${kind.tint}1A` }}
                        >
                          <Ionicons name={kind.icon} size={17} color={kind.tint} />
                        </View>

                        <View className="flex-1">
                          <View className="flex-row items-center justify-between">
                            <Text
                              className={`flex-1 font-text text-sm ${
                                isUnread
                                  ? 'font-semibold text-core-text-primary'
                                  : 'text-core-text-secondary'
                              }`}
                            >
                              {row.title}
                            </Text>
                            <Text className="ml-2 font-text text-xs text-core-text-disabled">
                              {relativeTime(row.createdAt)}
                            </Text>
                          </View>

                          {row.message ? (
                            <Text
                              className="mt-0.5 font-text text-sm text-core-text-secondary"
                              numberOfLines={3}
                            >
                              {row.message}
                            </Text>
                          ) : null}
                        </View>

                        <Pressable
                          onPress={() => handleDismiss(row.id)}
                          hitSlop={10}
                          className="mt-0.5 p-1"
                        >
                          <Ionicons name="close" size={15} color="#B0AAA3" />
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </Container>
  );
}
