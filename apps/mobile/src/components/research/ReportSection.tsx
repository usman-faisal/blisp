import Text from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ReportSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Shown beside the title, e.g. an item count, so a collapsed section still informs. */
  badge?: string | number;
  /** The executive summary opens expanded; detail sections start collapsed. */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * One collapsible report section.
 *
 * The report has 13 sections and runs to several screens, so everything below
 * the executive summary collapses by default — the plan calls for the summary
 * to be readable without scrolling past detail.
 */
export function ReportSection({
  title,
  icon,
  badge,
  defaultExpanded = false,
  children,
}: ReportSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View className="mt-3 overflow-hidden rounded-2xl bg-core-surface/60">
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded((prev) => !prev);
        }}
        className="flex-row items-center justify-between px-4 py-3.5 active:opacity-70"
      >
        <View className="flex-1 flex-row items-center gap-x-2.5">
          <Ionicons name={icon} size={15} color="#C9A84C" />
          <Text className="flex-1 text-sm font-semibold text-core-text-primary" numberOfLines={1}>
            {title}
          </Text>
          {badge !== undefined && (
            <View className="rounded-full bg-core-surface-elevated px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-core-text-secondary">{badge}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#B0AAA3"
          style={{ marginLeft: 8 }}
        />
      </Pressable>

      {expanded && <View className="px-4 pb-4">{children}</View>}
    </View>
  );
}

/** A bulleted line. Used wherever a section is a plain string[]. */
export function Bullet({ text, tone = 'primary' }: { text: string; tone?: 'primary' | 'secondary' }) {
  return (
    <View className="mt-2 flex-row gap-x-2">
      <View className="mt-[7px] h-1.5 w-1.5 rounded-full bg-brand-flax" />
      <Text
        className={`flex-1 text-[13px] leading-5 ${
          tone === 'primary' ? 'text-core-text-primary' : 'text-core-text-secondary'
        }`}
      >
        {text}
      </Text>
    </View>
  );
}

/** Sub-heading inside a section, for sections with more than one list. */
export function SubLabel({ text }: { text: string }) {
  return (
    <Text className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
      {text}
    </Text>
  );
}
