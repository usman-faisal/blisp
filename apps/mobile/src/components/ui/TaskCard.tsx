import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type Priority = 'high' | 'medium' | 'low';
type CardVariant = 'dark' | 'sage' | 'ember' | 'flax';

interface TaskCardProps {
  title: string;
  reviewCount?: number;
  timeRange?: string;
  priority?: Priority;
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

export const TaskCard = ({
  title,
  reviewCount,
  timeRange,
  priority = 'high',
  variant = 'dark',
  onPress,
}: TaskCardProps) => {
  const s = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      className={`${s.card} mb-4 rounded-3xl px-5 pb-5 pt-5 shadow-card`}>
      <View className="flex-row items-start justify-between">
        <Text className={`${s.title} mr-4 flex-1 font-text text-xl leading-tight`}>{title}</Text>
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
        <View className={`${s.priorityBtn} rounded-full px-4 py-2`}>
          <Text className={`${s.priorityText} font-text text-sm font-semibold`}>
            {priorityLabel[priority]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
