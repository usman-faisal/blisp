import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type Priority = 'high' | 'medium' | 'low';
type CardVariant = 'dark' | 'sage' | 'ember' | 'flax';
type TaskStatus = 'pending' | 'in_progress' | 'completed';

interface TaskCardProps {
  title: string;
  reviewCount?: number;
  timeRange?: string;
  priority?: Priority;
  status?: TaskStatus;
  variant?: CardVariant;
  onPress?: () => void;
}

const variantStyles: Record<
  CardVariant,
  {
    card: string;
    title: string;
    review: string;
    time: string;
    timeIconColor: string;
    priorityBtn: string;
    priorityText: string;
    arrowBtn: string;
    arrowColor: string;
  }
> = {
  dark: {
    card: 'bg-core-text-primary',
    title: 'text-core-background',
    review: 'text-brand-flax',
    time: 'text-core-surface',
    timeIconColor: '#EFEAE2',
    priorityBtn: 'bg-core-text-secondary',
    priorityText: 'text-white',
    arrowBtn: 'bg-core-background',
    arrowColor: '#1A1714',
  },
  sage: {
    card: 'bg-brand-sage',
    title: 'text-white',
    review: 'text-white',
    time: 'text-white',
    timeIconColor: '#FFFFFF',
    priorityBtn: 'bg-white/20',
    priorityText: 'text-white',
    arrowBtn: 'bg-white',
    arrowColor: '#6A8F7A',
  },
  ember: {
    card: 'bg-brand-ember',
    title: 'text-white',
    review: 'text-brand-ember-mist',
    time: 'text-white',
    timeIconColor: '#FFFFFF',
    priorityBtn: 'bg-white/20',
    priorityText: 'text-white',
    arrowBtn: 'bg-white',
    arrowColor: '#E8612A',
  },
  flax: {
    card: 'bg-brand-flax',
    title: 'text-white',
    review: 'text-white',
    time: 'text-white',
    timeIconColor: '#FFFFFF',
    priorityBtn: 'bg-white/20',
    priorityText: 'text-white',
    arrowBtn: 'bg-white',
    arrowColor: '#C9A84C',
  },
};

const priorityLabel: Record<Priority, string> = {
  high: 'High Priority',
  medium: 'Med Priority',
  low: 'Low Priority',
};

const statusConfig: Record<TaskStatus, { icon: string; label: string; pill: string; text: string }> = {
  pending: {
    icon: 'ellipse-outline',
    label: 'To Do',
    pill: 'bg-white/15',
    text: 'text-white/70',
  },
  in_progress: {
    icon: 'flash',
    label: 'In Progress',
    pill: 'bg-white/20',
    text: 'text-white',
  },
  completed: {
    icon: 'checkmark-circle',
    label: 'Done',
    pill: 'bg-white/20',
    text: 'text-white',
  },
};

const statusIconColor: Record<TaskStatus, string> = {
  pending: 'rgba(255,255,255,0.45)',
  in_progress: '#FFFFFF',
  completed: '#FFFFFF',
};

export const TaskCard = ({
  title,
  reviewCount,
  timeRange,
  priority,
  status,
  variant = 'dark',
  onPress,
}: TaskCardProps) => {
  const s = variantStyles[variant];
  const st = status ? statusConfig[status] : null;

  return (
    <Pressable
      onPress={onPress}
      className={`${s.card} mb-4 overflow-hidden rounded-3xl shadow-card`}>

      {/* Status accent bar along the top */}
      {status === 'in_progress' && (
        <View className="h-1 w-full bg-white/30" />
      )}
      {status === 'completed' && (
        <View className="h-1 w-full bg-white/50" />
      )}

      <View className="px-5 pb-5 pt-5">
        <View className="flex-row items-start justify-between">
          <Text
            className={`${s.title} mr-4 flex-1 font-text text-xl leading-tight ${status === 'completed' ? 'opacity-60' : ''}`}>
            {title}
          </Text>
          <View className="items-end gap-y-3">
            {reviewCount !== undefined && (
              <Text className={`${s.review} font-text text-sm font-semibold`}>
                {reviewCount} Review
              </Text>
            )}
            <View className={`${s.arrowBtn} h-11 w-11 items-center justify-center rounded-full`}>
              <Ionicons name="arrow-up-right-box" size={20} color={s.arrowColor} />
            </View>
          </View>
        </View>

        <View className="mt-5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-x-2">
            {timeRange && (
              <>
                <Ionicons name="time-outline" size={16} color={s.timeIconColor} />
                <Text className={`${s.time} font-text text-sm`}>{timeRange}</Text>
              </>
            )}
          </View>

          <View className="flex-row items-center gap-x-2">
            {st && (
              <View className={`${st.pill} flex-row items-center gap-x-1.5 rounded-full px-3 py-1.5`}>
                <Ionicons
                  name={st.icon as any}
                  size={13}
                  color={statusIconColor[status!]}
                />
                <Text className={`${st.text} font-text text-xs font-semibold`}>
                  {st.label}
                </Text>
              </View>
            )}
            {priority && (
              <View className={`${s.priorityBtn} rounded-full px-4 py-2`}>
                <Text className={`${s.priorityText} font-text text-sm font-semibold`}>
                  {priorityLabel[priority]}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};
