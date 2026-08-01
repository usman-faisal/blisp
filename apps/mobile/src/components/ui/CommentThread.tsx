import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import type { ProjectMemberResponse, TaskCommentResponse } from '@repo/types';
import { CommentBody } from './CommentBody';
import { MemberAvatar } from './MemberAvatar';
import Text from './Text';

/** Mirrors MAX_COMMENT_LENGTH in the backend's create-comment.dto.ts. */
const MAX_COMMENT_LENGTH = 2000;

/** Relative time, since a thread is read in the context of "just now". */
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(iso).toLocaleDateString();
}

interface CommentThreadProps {
  comments: TaskCommentResponse[];
  members: ProjectMemberResponse[];
  isLoading: boolean;
  /** True while the project owner is viewing — they may delete any comment. */
  canModerate: boolean;
  onDelete: (commentId: string) => Promise<void>;
}

export function CommentThread({
  comments,
  members,
  isLoading,
  canModerate,
  onDelete,
}: CommentThreadProps) {
  const confirmDelete = (comment: TaskCommentResponse) => {
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(comment.id),
      },
    ]);
  };

  return (
    <View className="mt-8">
      <View className="mb-3 flex-row items-center gap-x-2">
        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#6A8F7A" />
        <Text className="text-xs font-semibold uppercase tracking-wide text-brand-sage">
          Discussion
        </Text>
        {comments.length > 0 && (
          <View className="rounded-full bg-brand-sage/15 px-2 py-0.5">
            <Text className="text-xs font-semibold text-brand-sage">{comments.length}</Text>
          </View>
        )}
      </View>

      {isLoading && (
        <View className="py-6">
          <ActivityIndicator color="#6A8F7A" />
        </View>
      )}

      {!isLoading && comments.length === 0 && (
        <Text className="mb-4 text-sm text-core-text-disabled">
          No comments yet. Mention a teammate with @ to bring them in.
        </Text>
      )}

      {comments.map((comment) => (
        <View key={comment.id} className="mb-3 flex-row gap-3">
          <MemberAvatar name={comment.authorName} size={32} />

          <View className="flex-1 rounded-2xl bg-core-surface p-3">
            <View className="mb-1 flex-row items-center gap-x-2">
              <Text className="flex-1 text-xs font-semibold text-core-text-primary">
                {comment.authorName}
                {comment.isOwn ? ' (you)' : ''}
              </Text>
              <Text className="text-xs text-core-text-disabled">
                {timeAgo(comment.createdAt)}
                {comment.updatedAt !== comment.createdAt ? ' · edited' : ''}
              </Text>

              {/* The author, or the project owner moderating — the same rule
                  the backend enforces. */}
              {(comment.isOwn || canModerate) && (
                <Pressable onPress={() => confirmDelete(comment)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={14} color="#B0AAA3" />
                </Pressable>
              )}
            </View>

            <CommentBody body={comment.body} members={members} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The composer, separate from the thread so the screen can pin it below the
 * scroll view. Inside it, the keyboard covers it and the user cannot see what
 * they are typing.
 */
export function CommentComposer({
  onSubmit,
  /** Extra bottom padding when the keyboard is closed, to clear the home indicator. */
  bottomInset = 0,
}: {
  onSubmit: (body: string) => Promise<void>;
  bottomInset?: number;
}) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_COMMENT_LENGTH && !isSending;

  const handleSend = async () => {
    if (!canSend) return;

    // Clear the box up front so the thread reads as sent; onSubmit restores it
    // by rethrowing if the request fails.
    setDraft('');
    setIsSending(true);
    try {
      await onSubmit(trimmed);
    } catch {
      setDraft(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View
      style={{ paddingBottom: 12 + bottomInset }}
      className="flex-row items-end gap-2 border-t border-semantic-border bg-core-background px-5 pt-3">
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Add a comment…"
        placeholderTextColor="#B0AAA3"
        multiline
        maxLength={MAX_COMMENT_LENGTH}
        className="max-h-28 flex-1 rounded-2xl bg-core-surface px-4 py-3 text-sm text-core-text-primary"
      />

      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        className={`h-11 w-11 items-center justify-center rounded-full ${
          canSend ? 'bg-brand-ember' : 'bg-core-surface'
        }`}>
        {isSending ? (
          <ActivityIndicator size="small" color="#6B6560" />
        ) : (
          <Ionicons name="arrow-up" size={18} color={canSend ? '#FFFFFF' : '#B0AAA3'} />
        )}
      </Pressable>
    </View>
  );
}
