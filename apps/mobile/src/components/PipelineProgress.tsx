import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '@/components/ui/Text';
import type { PipelineEventPayload } from '@repo/types';

/**
 * Ordered pipeline steps the user sees.
 * Each step maps to a START + COMPLETED stage pair.
 */
const PIPELINE_STEPS = [
  {
    key: 'research',
    label: 'Researching',
    completedLabel: 'Research complete',
    startStage: 'RESEARCH_STARTED',
    endStage: 'RESEARCH_COMPLETED',
    icon: 'search-outline' as const,
  },
  {
    key: 'plan',
    label: 'Creating plan',
    completedLabel: 'Plan created',
    startStage: 'PLAN_STARTED',
    endStage: 'PLAN_COMPLETED',
    icon: 'map-outline' as const,
  },
  {
    key: 'daily_plan',
    label: 'Building daily plan',
    completedLabel: 'Daily plan ready',
    startStage: 'DAILY_PLAN_STARTED',
    endStage: 'DAILY_PLAN_COMPLETED',
    icon: 'calendar-outline' as const,
  },
  {
    key: 'resources',
    label: 'Fetching resources',
    completedLabel: 'Resources fetched',
    startStage: 'RESOURCE_FETCH_STARTED',
    endStage: 'RESOURCE_FETCH_COMPLETED',
    icon: 'library-outline' as const,
  },
] as const;

type StepStatus = 'pending' | 'active' | 'completed';

function getStepStatus(
  step: (typeof PIPELINE_STEPS)[number],
  stageSet: Set<string>,
): StepStatus {
  if (stageSet.has(step.endStage)) return 'completed';
  if (stageSet.has(step.startStage)) return 'active';
  return 'pending';
}

function getStepMessage(
  step: (typeof PIPELINE_STEPS)[number],
  events: PipelineEventPayload[],
): string | null {
  // Show the latest message for this step's stages
  const relevant = events
    .filter((e) => e.stage === step.startStage || e.stage === step.endStage)
    .pop();
  return relevant?.message ?? null;
}

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="h-3 w-3 rounded-full bg-brand-ember"
    />
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-sage">
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </View>
    );
  }

  if (status === 'active') {
    return (
      <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-ember-mist">
        <PulsingDot />
      </View>
    );
  }

  return (
    <View className="h-6 w-6 items-center justify-center rounded-full bg-core-surface">
      <View className="h-2 w-2 rounded-full bg-core-text-disabled" />
    </View>
  );
}

function StepRow({
  step,
  status,
  message,
  isLast,
}: {
  step: (typeof PIPELINE_STEPS)[number];
  status: StepStatus;
  message: string | null;
  isLast: boolean;
}) {
  const label = status === 'completed' ? step.completedLabel : step.label;

  return (
    <View className="flex-row">
      {/* Timeline column */}
      <View className="mr-3 items-center" style={{ width: 24 }}>
        <StepIcon status={status} />
        {!isLast && (
          <View
            className={`mt-1 w-0.5 flex-1 ${
              status === 'completed'
                ? 'bg-brand-sage'
                : 'bg-core-surface-elevated'
            }`}
            style={{ minHeight: 20 }}
          />
        )}
      </View>

      {/* Content column */}
      <View className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
        <View className="flex-row items-center gap-x-2">
          <Ionicons
            name={step.icon}
            size={14}
            color={
              status === 'completed'
                ? '#6A8F7A'
                : status === 'active'
                  ? '#E8612A'
                  : '#B0AAA3'
            }
          />
          <Text
            className={`text-sm font-medium ${
              status === 'completed'
                ? 'text-brand-sage'
                : status === 'active'
                  ? 'text-core-text-primary'
                  : 'text-core-text-disabled'
            }`}
          >
            {label}
          </Text>
        </View>
        {message && status !== 'pending' && (
          <Text className="mt-0.5 text-xs leading-4 text-core-text-secondary">
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

export function PipelineProgress({
  events,
  projectTitle,
}: {
  events: PipelineEventPayload[];
  projectTitle: string;
}) {
  const stageSet = new Set(events.map((e) => e.stage));
  const allDone = stageSet.has('RESOURCE_FETCH_COMPLETED') || stageSet.has('DAILY_PLAN_COMPLETED');

  return (
    <View className="mb-4 overflow-hidden rounded-3xl bg-core-surface-elevated p-5">
      {/* Header */}
      <View className="mb-4 flex-row items-center gap-x-2">
        <View
          className={`h-8 w-8 items-center justify-center rounded-full ${
            allDone ? 'bg-brand-sage/15' : 'bg-brand-ember-mist'
          }`}
        >
          <Ionicons
            name={allDone ? 'checkmark-circle' : 'flask-outline'}
            size={18}
            color={allDone ? '#6A8F7A' : '#E8612A'}
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-core-text-secondary">
            {allDone ? 'Processing Complete' : 'Processing'}
          </Text>
          <Text
            className="text-sm font-medium text-core-text-primary"
            numberOfLines={1}
          >
            {projectTitle}
          </Text>
        </View>
      </View>

      {/* Steps */}
      {PIPELINE_STEPS.map((step, index) => (
        <StepRow
          key={step.key}
          step={step}
          status={getStepStatus(step, stageSet)}
          message={getStepMessage(step, events)}
          isLast={index === PIPELINE_STEPS.length - 1}
        />
      ))}
    </View>
  );
}
