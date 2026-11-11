import Text from '@/components/ui/Text';
import type { ResearchReportVersionPayload } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

/**
 * Shown while a report is PENDING.
 *
 * Generation genuinely takes 60-100 seconds, so the wait is stated up front
 * rather than left to a bare spinner that reads as a hang. The steps match the
 * real pipeline: four searches, then one structured generation.
 */
export function ReportPending({
  version,
  onCancel,
  isCancelling,
}: {
  version: number;
  onCancel?: () => void;
  isCancelling?: boolean;
}) {
  return (
    <View className="mt-6 items-center rounded-2xl bg-core-surface/60 px-6 py-8">
      <ActivityIndicator color="#E8612A" />
      <Text className="mt-4 text-center text-sm font-semibold text-core-text-primary">
        Researching your idea
      </Text>
      <Text className="mt-1.5 text-center text-xs leading-[18px] text-core-text-secondary">
        Searching for comparable products, then writing version {version}. This usually takes about
        a minute and a half — you can leave this screen and come back.
      </Text>

      <View className="mt-5 w-full gap-y-2">
        {[
          'Searching for comparable products',
          'Looking for user pain points',
          'Checking technical feasibility',
          'Finding gaps worth building into',
        ].map((step) => (
          <View key={step} className="flex-row items-center gap-x-2">
            <Ionicons name="ellipse-outline" size={11} color="#B0AAA3" />
            <Text className="text-xs text-core-text-secondary">{step}</Text>
          </View>
        ))}
      </View>

      {/* Understated, because stopping is a normal choice rather than an
          error, and nothing is lost by it. */}
      {onCancel && (
        <Pressable
          onPress={onCancel}
          disabled={isCancelling}
          className={`mt-5 flex-row items-center gap-x-1.5 ${isCancelling ? 'opacity-50' : 'active:opacity-60'}`}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#6B6560" />
          ) : (
            <Ionicons name="stop-circle-outline" size={14} color="#6B6560" />
          )}
          <Text className="text-xs font-medium text-core-text-secondary underline">
            {isCancelling ? 'Stopping…' : 'Stop generating'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * A report the user stopped.
 *
 * Deliberately not styled as an error: nothing went wrong, so there is no
 * apology and no "details" block — just the way forward.
 */
export function ReportCancelled({
  version,
  onGenerate,
  isRequesting,
}: {
  version: number;
  onGenerate: () => void;
  isRequesting: boolean;
}) {
  return (
    <View className="mt-6 rounded-2xl bg-core-surface/60 px-5 py-6">
      <View className="flex-row items-center gap-x-2">
        <Ionicons name="stop-circle-outline" size={16} color="#6B6560" />
        <Text className="text-sm font-semibold text-core-text-primary">
          You stopped version {version}
        </Text>
      </View>
      <Text className="mt-2 text-xs leading-[18px] text-core-text-secondary">
        Nothing was saved for this version. Earlier versions are untouched.
      </Text>

      <Pressable
        onPress={onGenerate}
        disabled={isRequesting}
        className={`mt-4 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3 ${
          isRequesting ? 'opacity-60' : 'active:opacity-80'
        }`}
      >
        {isRequesting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons name="sparkles" size={15} color="#FFFFFF" />
        )}
        <Text className="text-sm font-semibold text-white">
          {isRequesting ? 'Starting…' : 'Start a new report'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Marks the feature as beta.
 *
 * In the UI rather than only in documentation: citation checking is
 * excerpt-level and LLM-judged, so a reader should know the output is
 * reviewed-but-not-guaranteed before acting on it.
 */
export function BetaBadge() {
  return (
    <View className="flex-row items-center gap-x-1 self-start rounded-full bg-brand-flax/15 px-2 py-0.5">
      <Ionicons name="flask-outline" size={10} color="#C9A84C" />
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-flax">Beta</Text>
    </View>
  );
}

/**
 * A FAILED report, or a poll that gave up.
 *
 * The backend's error is shown rather than a generic message: for a quota or
 * key problem that string is the only thing that explains the failure. Retry
 * creates a new version, so nothing is lost by trying again.
 */
export function ReportFailed({
  error,
  onRetry,
  isRetrying,
  timedOut = false,
}: {
  error: string | null;
  onRetry: () => void;
  isRetrying: boolean;
  timedOut?: boolean;
}) {
  return (
    <View className="mt-6 rounded-2xl bg-semantic-danger/5 px-5 py-6">
      <View className="flex-row items-center gap-x-2">
        <Ionicons name="alert-circle-outline" size={16} color="#D94F3D" />
        <Text className="text-sm font-semibold text-core-text-primary">
          {timedOut ? 'This is taking too long' : 'Could not finish the report'}
        </Text>
      </View>

      <Text className="mt-2 text-xs leading-[18px] text-core-text-secondary">
        {timedOut
          ? 'The report has not finished in several minutes, which usually means the job stopped. Starting a new one is safe.'
          : 'Nothing was lost — trying again creates a new version and leaves earlier ones intact.'}
      </Text>

      {error && (
        <View className="mt-3 rounded-xl bg-core-background p-3">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
            Details
          </Text>
          <Text className="mt-1 text-xs leading-[18px] text-core-text-secondary">{error}</Text>
        </View>
      )}

      <Pressable
        onPress={onRetry}
        disabled={isRetrying}
        className={`mt-4 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3 ${
          isRetrying ? 'opacity-60' : 'active:opacity-80'
        }`}
      >
        {isRetrying ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons name="refresh" size={15} color="#FFFFFF" />
        )}
        <Text className="text-sm font-semibold text-white">
          {isRetrying ? 'Starting…' : 'Try again'}
        </Text>
      </Pressable>
    </View>
  );
}

/** No report has ever been generated for this project. */
export function ReportEmpty({
  onGenerate,
  isRequesting,
}: {
  onGenerate: () => void;
  isRequesting: boolean;
}) {
  return (
    <View className="mt-8 items-center px-4">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-ember-mist">
        <Ionicons name="telescope-outline" size={26} color="#E8612A" />
      </View>

      <Text className="mt-4 text-center font-heading text-xl leading-tight text-core-text-primary">
        See what's already out there
      </Text>
      <Text className="mt-2 text-center text-[13px] leading-5 text-core-text-secondary">
        A discovery report finds comparable products, what they do well, where they fall short, and
        which features are worth building for your users. Existing products are a good sign — they
        prove the problem is real.
      </Text>

      <Pressable
        onPress={onGenerate}
        disabled={isRequesting}
        className={`mt-6 w-full flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3.5 ${
          isRequesting ? 'opacity-60' : 'active:opacity-80'
        }`}
      >
        {isRequesting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons name="sparkles" size={15} color="#FFFFFF" />
        )}
        <Text className="text-sm font-semibold text-white">
          {isRequesting ? 'Starting…' : 'Generate report'}
        </Text>
      </Pressable>

      <Text className="mt-2.5 text-center text-[11px] text-core-text-disabled">
        Takes about a minute and a half
      </Text>
    </View>
  );
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED: { label: 'Approved', color: '#4A8C68', bg: 'bg-semantic-success/10' },
  REJECTED: { label: 'Rejected', color: '#D94F3D', bg: 'bg-semantic-danger/10' },
  CANCELLED: { label: 'Stopped', color: '#6B6560', bg: 'bg-core-surface-elevated' },
  DRAFT: { label: 'Draft', color: '#6B6560', bg: 'bg-core-surface-elevated' },
  PENDING: { label: 'Generating', color: '#E8612A', bg: 'bg-brand-ember-mist' },
  FAILED: { label: 'Failed', color: '#D94F3D', bg: 'bg-semantic-danger/10' },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT!;
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${config.bg}`}>
      <Text style={{ color: config.color }} className="text-[10px] font-semibold uppercase tracking-wide">
        {config.label}
      </Text>
    </View>
  );
}

/**
 * Horizontal version picker.
 *
 * Only rendered when more than one version exists — on a project with a single
 * report it would be chrome with no choice in it. Selecting the newest resets
 * to "follow the latest" (null) rather than pinning it, so a later generation
 * is picked up automatically.
 */
export function VersionSwitcher({
  versions,
  selectedVersion,
  onSelect,
}: {
  versions: ResearchReportVersionPayload[];
  selectedVersion: number | null;
  onSelect: (version: number | null) => void;
}) {
  if (versions.length < 2) return null;

  const latest = versions[0]?.version;
  const effective = selectedVersion ?? latest;

  return (
    <View className="mt-4">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
        Versions
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 8, paddingRight: 8 }}
      >
        {versions.map((entry) => {
          const isActive = entry.version === effective;
          return (
            <Pressable
              key={entry.id}
              onPress={() => onSelect(entry.version === latest ? null : entry.version)}
              className={`flex-row items-center gap-x-1.5 rounded-full px-3 py-1.5 ${
                isActive ? 'bg-brand-ember' : 'bg-core-surface active:opacity-70'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-core-text-secondary'}`}
              >
                v{entry.version}
              </Text>
              {entry.status === 'APPROVED' && (
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color={isActive ? '#FFFFFF' : '#4A8C68'}
                />
              )}
              {entry.status === 'FAILED' && (
                <Ionicons name="close-circle" size={12} color={isActive ? '#FFFFFF' : '#D94F3D'} />
              )}
              {entry.status === 'REJECTED' && (
                <Ionicons
                  name="close-circle-outline"
                  size={12}
                  color={isActive ? '#FFFFFF' : '#D94F3D'}
                />
              )}
              {entry.status === 'CANCELLED' && (
                <Ionicons name="stop-circle-outline" size={12} color={isActive ? '#FFFFFF' : '#6B6560'} />
              )}
              {entry.status === 'PENDING' && (
                <ActivityIndicator size="small" color={isActive ? '#FFFFFF' : '#E8612A'} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
