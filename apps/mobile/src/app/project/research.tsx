import { RejectSheet } from '@/components/research/RejectSheet';
import { ReportBody } from '@/components/research/ReportBody';
import {
  BetaBadge,
  ReportCancelled,
  ReportEmpty,
  ReportFailed,
  ReportPending,
  StatusBadge,
  VersionSwitcher,
} from '@/components/research/ReportStates';
import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { useResearchReport } from '@/hooks/useResearchReport';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

/** Skeleton for the initial load, before we know which state applies. */
function SkeletonReport() {
  return (
    <View className="px-5 pt-6">
      <View className="h-6 w-2/3 rounded-lg bg-core-text-disabled/20" />
      <View className="mt-4 h-24 w-full rounded-2xl bg-core-text-disabled/10" />
      {[1, 2, 3, 4].map((i) => (
        <View key={i} className="mt-3 h-12 w-full rounded-2xl bg-core-text-disabled/10" />
      ))}
    </View>
  );
}

/** Human date for the "researched" line; the raw ISO string is not useful here. */
function formatResearchedAt(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ResearchReportScreen() {
  const { projectId, projectTitle } = useLocalSearchParams<{
    projectId: string;
    projectTitle?: string;
  }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const {
    report,
    versions,
    selectedVersion,
    isLoading,
    isRequesting,
    isApproving,
    isRejecting,
    isCancelling,
    actionError,
    timedOut,
    generate,
    approve,
    reject,
    cancel,
    selectVersion,
    refresh,
  } = useResearchReport(projectId);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const researchedAt = formatResearchedAt(report?.researchedAt ?? null);
  const hasSections = report?.sections != null;

  // A failed report and a timed-out poll land in the same UI, since from the
  // user's side both mean "it did not finish and retrying is safe".
  const showFailure = report?.status === 'FAILED' || timedOut;

  return (
    <Container className="bg-core-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
        >
          <Ionicons name="arrow-back" size={20} color="#1A1714" />
        </Pressable>

        {/* Regenerate stays reachable once a report exists, so a user who wants
            a fresh pass does not have to scroll to the bottom for it. */}
        {report && report.status !== 'PENDING' && (
          <Pressable
            onPress={() => void generate()}
            disabled={isRequesting}
            hitSlop={12}
            className={`h-10 w-10 items-center justify-center rounded-full bg-core-surface ${
              isRequesting ? 'opacity-50' : 'active:opacity-70'
            }`}
          >
            {isRequesting ? (
              <ActivityIndicator size="small" color="#E8612A" />
            ) : (
              <Ionicons name="refresh" size={18} color="#1A1714" />
            )}
          </Pressable>
        )}
      </View>

      {isLoading && <SkeletonReport />}

      {!isLoading && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E8612A" />
          }
        >
          {/* Title block */}
          <Text className="mt-2 font-heading text-2xl leading-tight text-core-text-primary">
            Discovery report
          </Text>
          <View className="mt-1.5 flex-row items-center gap-x-2">
            <BetaBadge />
            {projectTitle && (
              <Text className="flex-1 text-[13px] text-core-text-secondary" numberOfLines={1}>
                {projectTitle}
              </Text>
            )}
          </View>

          {report && (
            <View className="mt-3 flex-row flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              <Text className="text-[11px] text-core-text-disabled">
                Version {report.version}
                {researchedAt ? ` · ${researchedAt}` : ''}
              </Text>
            </View>
          )}

          <VersionSwitcher
            versions={versions}
            selectedVersion={selectedVersion}
            onSelect={selectVersion}
          />

          {/* A failed request or approve — distinct from the report failing. */}
          {actionError && (
            <View className="mt-4 flex-row items-start gap-x-2 rounded-xl bg-semantic-danger/5 p-3">
              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#D94F3D"
                style={{ marginTop: 1 }}
              />
              <Text className="flex-1 text-xs leading-[18px] text-core-text-secondary">
                {actionError}
              </Text>
            </View>
          )}

          {/* ── States ─────────────────────────────────────────────────── */}

          {!report && <ReportEmpty onGenerate={() => void generate()} isRequesting={isRequesting} />}

          {report?.status === 'PENDING' && !timedOut && (
            <ReportPending
              version={report.version}
              onCancel={() => void cancel(report.version)}
              isCancelling={isCancelling}
            />
          )}

          {report?.status === 'CANCELLED' && (
            <ReportCancelled
              version={report.version}
              onGenerate={() => void generate()}
              isRequesting={isRequesting}
            />
          )}

          {showFailure && (
            <ReportFailed
              error={report?.error ?? null}
              onRetry={() => void generate()}
              isRetrying={isRequesting}
              timedOut={timedOut && report?.status !== 'FAILED'}
            />
          )}

          {!showFailure && hasSections && report?.sections && (
            <>
              <ReportBody
                sections={report.sections}
                sources={report.sources}
                verification={report.verification}
              />

              {/* A DRAFT is the only undecided state, so it is the only one
                  that offers both verdicts. The backend refuses to approve or
                  reject a PENDING or FAILED version. */}
              {report.status === 'DRAFT' && (
                <View className="mt-6 gap-y-2">
                  <Pressable
                    onPress={() => void approve(report.version)}
                    disabled={isApproving || isRejecting}
                    className={`flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3.5 ${
                      isApproving || isRejecting ? 'opacity-60' : 'active:opacity-80'
                    }`}
                  >
                    {isApproving ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                    )}
                    <Text className="text-sm font-semibold text-white">
                      {isApproving ? 'Approving…' : `Approve version ${report.version}`}
                    </Text>
                  </Pressable>

                  {/* Secondary, not destructive-looking: rejecting is a normal
                      editorial judgement here, and it loses nothing. */}
                  <Pressable
                    onPress={() => setRejectOpen(true)}
                    disabled={isApproving || isRejecting}
                    className={`flex-row items-center justify-center gap-x-2 rounded-full border border-semantic-border py-3.5 ${
                      isApproving || isRejecting ? 'opacity-60' : 'active:opacity-70'
                    }`}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#6B6560" />
                    <Text className="text-sm font-semibold text-core-text-secondary">
                      Reject this version
                    </Text>
                  </Pressable>
                </View>
              )}

              {report.status === 'APPROVED' && (
                <View className="mt-6 flex-row items-center justify-center gap-x-2 rounded-full bg-semantic-success/10 py-3.5">
                  <Ionicons name="checkmark-circle" size={16} color="#4A8C68" />
                  <Text className="text-sm font-semibold text-semantic-success">
                    Version {report.version} approved
                  </Text>
                </View>
              )}

              {/* A rejected version stays readable, and says why — that record
                  is the reason rejecting does not delete anything. */}
              {report.status === 'REJECTED' && (
                <View className="mt-6 rounded-2xl bg-semantic-danger/5 p-4">
                  <View className="flex-row items-center gap-x-2">
                    <Ionicons name="close-circle" size={15} color="#D94F3D" />
                    <Text className="text-sm font-semibold text-core-text-primary">
                      You rejected version {report.version}
                    </Text>
                  </View>
                  {report.rejectionReason ? (
                    <>
                      <Text className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
                        Your reason
                      </Text>
                      <Text className="mt-1 text-xs leading-[18px] text-core-text-secondary">
                        {report.rejectionReason}
                      </Text>
                      <Text className="mt-2 text-[11px] leading-4 text-core-text-disabled">
                        The next version you generate will be told to address this.
                      </Text>
                    </>
                  ) : (
                    <Text className="mt-2 text-xs leading-[18px] text-core-text-secondary">
                      No reason given. Generating a new version will not have anything specific to
                      act on.
                    </Text>
                  )}

                  <Pressable
                    onPress={() => void generate()}
                    disabled={isRequesting}
                    className={`mt-4 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3 ${
                      isRequesting ? 'opacity-60' : 'active:opacity-80'
                    }`}
                  >
                    {isRequesting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Ionicons name="refresh" size={15} color="#FFFFFF" />
                    )}
                    <Text className="text-sm font-semibold text-white">
                      {isRequesting ? 'Starting…' : 'Generate a new version'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* The model is recorded on the row; surfacing it keeps the
                  report honest about having been machine-generated. */}
              {report.model && (
                <Text className="mt-4 text-center text-[10px] text-core-text-disabled">
                  Generated by {report.model}
                </Text>
              )}
            </>
          )}

          {/* A terminal report with no sections should not silently render
              nothing — that would look like a blank screen bug. */}
          {!showFailure && report && report.status !== 'PENDING' && report.status !== 'CANCELLED' && !hasSections && (
            <View className="mt-8 items-center px-6">
              <Ionicons name="document-outline" size={32} color="#B0AAA3" />
              <Text className="mt-3 text-center text-sm text-core-text-disabled">
                This version has no content. Generating a new one is safe — earlier versions are
                kept.
              </Text>
              <Pressable
                onPress={() => void generate()}
                disabled={isRequesting}
                className={`mt-5 rounded-full bg-brand-ember px-6 py-3 ${
                  isRequesting ? 'opacity-60' : 'active:opacity-80'
                }`}
              >
                <Text className="text-sm font-semibold text-white">
                  {isRequesting ? 'Starting…' : 'Generate report'}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      <RejectSheet
        visible={rejectOpen}
        version={report?.version ?? 0}
        isRejecting={isRejecting}
        onCancel={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          setRejectOpen(false);
          if (report) void reject(report.version, reason);
        }}
      />
    </Container>
  );
}
