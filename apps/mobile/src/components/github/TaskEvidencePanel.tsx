import Text from '@/components/ui/Text';
import { taskReference } from '@/lib/api/github';
import type { EvidenceSourceValue, TaskEvidencePayload, VerificationVerdictValue } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Clipboard, Linking, Pressable, View } from 'react-native';
import { VerificationBadge, verdictBlurb } from './VerificationBadge';

const SOURCE_ICON: Record<EvidenceSourceValue, keyof typeof Ionicons.glyphMap> = {
  COMMIT: 'git-commit-outline',
  PULL_REQUEST: 'git-pull-request-outline',
  ISSUE: 'alert-circle-outline',
  MANUAL: 'link-outline',
};

/** "2 days ago" — relative time reads better than a date on a short list. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

/**
 * The reference a user puts in a commit message.
 *
 * This is the one piece of friction in the whole feature: BLISP cannot verify
 * what it cannot find, and it finds work by an explicit reference rather than
 * by guessing from commit text. So the token has to be visible exactly where
 * someone is about to go and do the work, and copyable in one tap — a
 * convention nobody is told about produces a project where nothing verifies.
 */
function ReferenceHint({ taskId }: { taskId: string }) {
  const [copied, setCopied] = useState(false);
  const reference = taskReference(taskId);

  const copy = () => {
    // React Native's built-in Clipboard rather than expo-clipboard: one less
    // dependency, and this is the only place the app needs it.
    Clipboard.setString(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View className="mt-3 rounded-xl bg-core-surface/60 p-3">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
        Link your work
      </Text>

      <Pressable
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${reference} to clipboard`}
        className="mt-2 flex-row items-center justify-between rounded-lg bg-core-background px-3 py-2.5 active:opacity-70"
      >
        <Text className="font-mono text-[13px] text-core-text-primary">{reference}</Text>
        <View className="flex-row items-center gap-x-1">
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? '#2E7D53' : '#6B6560'} />
          <Text className={`text-[10px] font-semibold ${copied ? 'text-semantic-success' : 'text-core-text-secondary'}`}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </View>
      </Pressable>

      <Text className="mt-2 text-[11px] leading-[16px] text-core-text-secondary">
        Add this to a commit message, push as usual, then sync the repository. BLISP only reads your
        commits — it never pushes.
      </Text>
    </View>
  );
}

/**
 * Verification for one task: the verdict, what was found, and how to link more.
 *
 * Every piece of evidence shows *why* it matched. A badge alone asks the user
 * to trust the system; "Commit message contains BLISP-4f2a1c08" lets them
 * check it, which is the difference between a verdict and an assertion.
 */
export function TaskEvidencePanel({
  taskId,
  verdict,
  summary,
  evidence,
  isLoading,
  isDone,
  isUpdating,
  onMarkDone,
}: {
  taskId: string;
  verdict: VerificationVerdictValue | null;
  summary: string | null;
  evidence: TaskEvidencePayload[];
  isLoading?: boolean;
  /** Whether the task currently claims to be complete. */
  isDone?: boolean;
  isUpdating?: boolean;
  /** Omitted when the viewer cannot change status. */
  onMarkDone?: () => void;
}) {
  if (isLoading) {
    return (
      <View className="mt-6">
        <View className="h-4 w-32 rounded bg-core-text-disabled/15" />
        <View className="mt-3 h-20 w-full rounded-xl bg-core-text-disabled/10" />
      </View>
    );
  }

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="shield-checkmark-outline" size={14} color="#C9A84C" />
          <Text className="text-xs font-semibold uppercase tracking-wide text-brand-flax">Verification</Text>
        </View>
        <VerificationBadge verdict={verdict} />
      </View>

      {/* The server's own sentence, shown verbatim: it names what was found
          ("2 commits reference this task"), which is more useful than a
          client-side restatement that could drift from the verdict. */}
      {(summary || verdict) && (
        <Text className="mt-2 text-[12px] leading-[18px] text-core-text-secondary">
          {summary ?? (verdict ? verdictBlurb(verdict) : '')}
        </Text>
      )}

      {/* Evidence exists but the task does not claim to be done.
          Surfaced as an offer, never an automatic completion: a commit can
          reference work that is only half finished, and letting it close the
          task would hand the claim to the evidence. The user decides; BLISP
          just points out that the evidence is already here. */}
      {!isDone && evidence.length > 0 && onMarkDone && (
        <View className="mt-3 rounded-xl bg-semantic-success/5 p-3">
          <View className="flex-row items-start gap-x-2">
            <Ionicons name="sparkles-outline" size={14} color="#2E7D53" style={{ marginTop: 1 }} />
            <View className="flex-1">
              <Text className="text-[12px] font-semibold text-core-text-primary">Evidence found</Text>
              <Text className="mt-0.5 text-[11px] leading-[16px] text-core-text-secondary">
                {evidence.length === 1 ? 'A commit references' : `${evidence.length} items reference`} this
                task. Mark it done if the work is finished.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onMarkDone}
            disabled={isUpdating}
            accessibilityRole="button"
            className={`mt-2.5 flex-row items-center justify-center gap-x-1.5 rounded-full bg-semantic-success py-2.5 ${
              isUpdating ? 'opacity-60' : 'active:opacity-80'
            }`}
          >
            <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
            <Text className="text-[12px] font-semibold text-white">Mark as done</Text>
          </Pressable>
        </View>
      )}

      {evidence.length > 0 && (
        <View className="mt-3">
          {evidence.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => void Linking.openURL(item.url)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${item.title} on GitHub`}
              className="mb-2 flex-row items-start gap-x-2.5 rounded-xl bg-core-surface/60 p-3 active:opacity-70"
            >
              <Ionicons name={SOURCE_ICON[item.source]} size={14} color="#6B6560" style={{ marginTop: 1 }} />

              <View className="flex-1">
                <Text className="text-[12px] leading-[17px] text-core-text-primary" numberOfLines={2}>
                  {item.title}
                </Text>

                <View className="mt-1 flex-row flex-wrap items-center gap-x-1.5">
                  {item.source === 'COMMIT' && (
                    <Text className="font-mono text-[10px] text-core-text-disabled">
                      {item.externalId.slice(0, 7)}
                    </Text>
                  )}
                  {item.authorLogin && (
                    <Text className="text-[10px] text-core-text-disabled">· {item.authorLogin}</Text>
                  )}
                  <Text className="text-[10px] text-core-text-disabled">· {relativeTime(item.occurredAt)}</Text>
                  {/* Manual links are marked, never passed off as observed:
                      a person chose this one. */}
                  {item.source === 'MANUAL' && (
                    <Text className="text-[10px] text-core-text-disabled">· added by hand</Text>
                  )}
                </View>

                {/* Why it matched, so the user can judge the match itself. */}
                <Text className="mt-1 text-[10px] italic leading-[14px] text-core-text-disabled">
                  {item.matchReason}
                </Text>
              </View>

              <Ionicons name="open-outline" size={12} color="#A8A29C" style={{ marginTop: 2 }} />
            </Pressable>
          ))}
        </View>
      )}

      {/* The hint is hidden once verified: the user clearly already knows the
          convention, and repeating it would be noise. */}
      {verdict !== 'VERIFIED' && <ReferenceHint taskId={taskId} />}
    </View>
  );
}
