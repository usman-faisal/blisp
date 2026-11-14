import { MilestoneCard, TaskRow } from '@/components/roadmap/MilestoneCard';
import { PlanScopeSheet } from '@/components/roadmap/PlanScopeSheet';
import { ProgressBar, WeekStrip } from '@/components/roadmap/ProgressBar';
import { ScheduleFitCard, ShrinkScopeSheet } from '@/components/roadmap/ScheduleFitCard';
import { SettingsSheet } from '@/components/roadmap/SettingsSheet';
import { RepositorySheet } from '@/components/github/RepositorySheet';
import { VerificationSummaryLine } from '@/components/github/VerificationBadge';
import { useRepositories } from '@/hooks/useRepositories';
import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { useRoadmap } from '@/hooks/useRoadmap';
import type { ScopeItemPayload, ShrinkScopeRemedyPayload } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

function SkeletonRoadmap() {
  return (
    <View className="px-5 pt-6">
      <View className="h-6 w-2/3 rounded-lg bg-core-text-disabled/20" />
      <View className="mt-5 h-16 w-full rounded-2xl bg-core-text-disabled/10" />
      {[1, 2, 3].map((i) => (
        <View key={i} className="mt-3 h-20 w-full rounded-2xl bg-core-text-disabled/10" />
      ))}
    </View>
  );
}

export default function RoadmapScreen() {
  const { projectId, projectTitle } = useLocalSearchParams<{ projectId: string; projectTitle?: string }>();
  const router = useRouter();

  const {
    roadmap,
    today,
    history,
    streak,
    isLoading,
    isSaving,
    actionError,
    refresh,
    saveSettings,
    build,
    loadSuggestedScope,
    defer,
    restore,
  } = useRoadmap(projectId);

  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [suggestedHours, setSuggestedHours] = useState<number | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [suggestedScope, setSuggestedScope] = useState<ScopeItemPayload[]>([]);
  const [fromReportVersion, setFromReportVersion] = useState<number | null>(null);
  const [shrinkRemedy, setShrinkRemedy] = useState<ShrinkScopeRemedyPayload | null>(null);
  const [repoOpen, setRepoOpen] = useState(false);

  // Linked repositories and how many completions they corroborate.
  const {
    repositories,
    verification,
    lastSync,
    isSaving: isRepoSaving,
    error: repoError,
    link: linkRepo,
    sync: syncRepo,
    unlink: unlinkRepo,
  } = useRepositories(projectId);

  // Task status changes happen on the task detail screen; without a refetch on
  // return the progress figures would still show the pre-change state.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const openPlanner = useCallback(async () => {
    setPlanLoading(true);
    setPlanOpen(true);
    const result = await loadSuggestedScope();
    setSuggestedScope(result.scope);
    setFromReportVersion(result.fromReportVersion);
    setPlanLoading(false);
  }, [loadSuggestedScope]);

  const hasRoadmap = (roadmap?.milestones.length ?? 0) > 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Container className="bg-core-background">
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
        >
          <Ionicons name="arrow-back" size={20} color="#1A1714" />
        </Pressable>

        <View className="flex-row gap-x-2">
          <Pressable
            onPress={() => {
              setSuggestedHours(null);
              setSettingsOpen(true);
            }}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
          >
            <Ionicons name="options-outline" size={18} color="#1A1714" />
          </Pressable>
          <Pressable
            onPress={() => setRepoOpen(true)}
            hitSlop={12}
            accessibilityLabel="Linked repositories"
            className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
          >
            <Ionicons name="logo-github" size={18} color="#1A1714" />
          </Pressable>
          {hasRoadmap && (
            <Pressable
              onPress={() => void openPlanner()}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full bg-core-surface active:opacity-70"
            >
              <Ionicons name="refresh" size={18} color="#1A1714" />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading && <SkeletonRoadmap />}

      {!isLoading && roadmap && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E8612A" />}
        >
          <Text className="mt-2 font-heading text-2xl leading-tight text-core-text-primary">Roadmap</Text>
          <Text className="mt-1 text-[13px] text-core-text-secondary" numberOfLines={1}>
            {projectTitle ?? roadmap.projectTitle}
          </Text>

          {actionError && (
            <View className="mt-4 flex-row items-start gap-x-2 rounded-xl bg-semantic-danger/5 p-3">
              <Ionicons name="information-circle-outline" size={14} color="#D94F3D" style={{ marginTop: 1 }} />
              <Text className="flex-1 text-xs leading-[18px] text-core-text-secondary">{actionError}</Text>
            </View>
          )}

          {/* Overall progress, separate from the daily figure below it — the
              plan asks for both rather than one blended number. */}
          <View className="mt-5 rounded-2xl bg-core-surface/60 p-4">
            <ProgressBar progress={roadmap.progress} label="Overall progress" />
            {/* How much of that progress is backed by evidence rather than
                self-report. Null when nothing is checkable. */}
            {verification && <VerificationSummaryLine summary={verification} />}
          </View>

          {/* Today. Null daily means nothing was planned, which is not 0%. */}
          <View className="mt-3 rounded-2xl bg-brand-ember-mist p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-x-2">
                <Ionicons name="today-outline" size={14} color="#E8612A" />
                <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-ember">Today</Text>
              </View>
              {today?.daily && (
                <Text className="text-sm font-semibold text-brand-ember">{today.daily.percentComplete}%</Text>
              )}
            </View>

            {today && today.tasks.length > 0 ? (
              <>
                <Text className="mt-1 text-xs text-core-text-secondary">
                  {today.daily?.done ?? 0} of {today.tasks.length} done
                </Text>
                {today.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={{ ...task, plannedFor: todayStr, completedAt: null }}
                    onPress={() => router.push(`/task/${task.id}` as never)}
                  />
                ))}
              </>
            ) : (
              <Text className="mt-1.5 text-xs leading-[18px] text-core-text-secondary">
                Nothing scheduled for today. Your daily plan is built each morning from the backlog.
              </Text>
            )}
          </View>

          <ScheduleFitCard
            schedule={roadmap.schedule}
            hasDeadline={roadmap.settings.deadline !== null}
            isSaving={isSaving}
            onMoreHours={(required) => {
              setSuggestedHours(required);
              setSettingsOpen(true);
            }}
            onShrinkScope={setShrinkRemedy}
          />

          <WeekStrip days={history} streak={streak} />

          {hasRoadmap ? (
            <>
              <View className="mt-6 mb-1 flex-row items-center gap-x-2">
                <Ionicons name="map-outline" size={14} color="#C9A84C" />
                <Text className="text-xs font-semibold uppercase tracking-wide text-brand-flax">Milestones</Text>
              </View>

              {roadmap.milestones.map((milestone, index) => {
                // The first unfinished milestone opens by default: it is the
                // one being worked on.
                const isFirstIncomplete =
                  roadmap.milestones.findIndex((m) => m.progress.percentComplete < 100) === index;
                const overdue =
                  milestone.targetDate !== null &&
                  milestone.targetDate.slice(0, 10) < todayStr &&
                  milestone.progress.percentComplete < 100;

                return (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    defaultExpanded={isFirstIncomplete}
                    isOverdue={overdue}
                    onTaskPress={(taskId) => router.push(`/task/${taskId}` as never)}
                    onRestoreTask={(taskId) => void restore(taskId)}
                  />
                );
              })}
            </>
          ) : (
            <View className="mt-8 items-center px-4">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-ember-mist">
                <Ionicons name="map-outline" size={26} color="#E8612A" />
              </View>
              <Text className="mt-4 text-center font-heading text-xl leading-tight text-core-text-primary">
                Turn your scope into a schedule
              </Text>
              <Text className="mt-2 text-center text-[13px] leading-5 text-core-text-secondary">
                Milestones with real dates, worked out from your deadline and the hours you actually have.
              </Text>

              <Pressable
                onPress={() => void openPlanner()}
                disabled={isSaving}
                className={`mt-6 w-full flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3.5 ${
                  isSaving ? 'opacity-60' : 'active:opacity-80'
                }`}
              >
                <Ionicons name="git-branch-outline" size={15} color="#FFFFFF" />
                <Text className="text-sm font-semibold text-white">Plan the roadmap</Text>
              </Pressable>
            </View>
          )}

          {/* The backlog: anything not attached to a milestone, including the
              tasks the brain-dump pipeline created. */}
          {roadmap.unplanned.length > 0 && (
            <>
              <View className="mt-6 mb-1 flex-row items-center gap-x-2">
                <Ionicons name="file-tray-outline" size={14} color="#6B6560" />
                <Text className="text-xs font-semibold uppercase tracking-wide text-core-text-secondary">
                  Backlog ({roadmap.unplanned.length})
                </Text>
              </View>
              {roadmap.unplanned.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onPress={() => router.push(`/task/${task.id}` as never)}
                  onRestore={() => void restore(task.id)}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <SettingsSheet
        visible={settingsOpen}
        settings={roadmap?.settings ?? null}
        isSaving={isSaving}
        suggestedHours={suggestedHours}
        onCancel={() => setSettingsOpen(false)}
        onSave={(settings) => {
          setSettingsOpen(false);
          void saveSettings(settings);
        }}
      />

      <PlanScopeSheet
        visible={planOpen}
        isLoading={planLoading}
        isSaving={isSaving}
        suggested={suggestedScope}
        fromReportVersion={fromReportVersion}
        onCancel={() => setPlanOpen(false)}
        onConfirm={(scope) => {
          setPlanOpen(false);
          void build(scope);
        }}
      />

      <RepositorySheet
        visible={repoOpen}
        repositories={repositories}
        isSaving={isRepoSaving}
        error={repoError}
        lastSync={lastSync}
        onClose={() => setRepoOpen(false)}
        onLink={(repository) => void linkRepo(repository)}
        onSync={(repositoryId) => void syncRepo(repositoryId)}
        onUnlink={(repositoryId) => void unlinkRepo(repositoryId)}
      />

      <ShrinkScopeSheet
        visible={shrinkRemedy !== null}
        remedy={shrinkRemedy}
        isSaving={isSaving}
        onCancel={() => setShrinkRemedy(null)}
        onConfirm={(taskIds) => {
          setShrinkRemedy(null);
          void defer(taskIds);
        }}
      />
    </Container>
  );
}
