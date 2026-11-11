import Text from '@/components/ui/Text';
import type { EvidenceKind, FeaturePriority, RiskSeverity } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';

/**
 * Telling evidence from opinion is the point of this feature, so the three
 * kinds are visually distinct rather than differing only in wording:
 * VERIFIED reads as a citation, RECOMMENDATION as advice.
 */
const EVIDENCE_CONFIG: Record<
  EvidenceKind,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  VERIFIED: { label: 'Verified', color: '#6A8F7A', bg: 'bg-brand-sage/15', icon: 'link' },
  ANALYSIS: { label: 'Analysis', color: '#6B6560', bg: 'bg-core-surface', icon: 'bulb-outline' },
  RECOMMENDATION: {
    label: 'Recommendation',
    color: '#E8612A',
    bg: 'bg-brand-ember-mist',
    icon: 'arrow-forward-circle-outline',
  },
};

export function EvidenceBadge({ kind }: { kind: EvidenceKind }) {
  const config = EVIDENCE_CONFIG[kind] ?? EVIDENCE_CONFIG.ANALYSIS;

  return (
    <View className={`flex-row items-center gap-x-1 self-start rounded-full px-2 py-0.5 ${config.bg}`}>
      <Ionicons name={config.icon} size={10} color={config.color} />
      <Text style={{ color: config.color }} className="text-[10px] font-semibold uppercase tracking-wide">
        {config.label}
      </Text>
    </View>
  );
}

const PRIORITY_CONFIG: Record<FeaturePriority, { label: string; color: string; bg: string }> = {
  MUST_HAVE: { label: 'Must have', color: '#E8612A', bg: 'bg-brand-ember-mist' },
  SHOULD_HAVE: { label: 'Should have', color: '#C9A84C', bg: 'bg-brand-flax/15' },
  LATER: { label: 'Later', color: '#6B6560', bg: 'bg-core-surface' },
};

export function PriorityBadge({ priority }: { priority: FeaturePriority }) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.LATER;

  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${config.bg}`}>
      <Text style={{ color: config.color }} className="text-[10px] font-semibold uppercase tracking-wide">
        {config.label}
      </Text>
    </View>
  );
}

const SEVERITY_CONFIG: Record<RiskSeverity, { label: string; color: string; bg: string }> = {
  HIGH: { label: 'High', color: '#D94F3D', bg: 'bg-semantic-danger/10' },
  MEDIUM: { label: 'Medium', color: '#C9A84C', bg: 'bg-brand-flax/15' },
  LOW: { label: 'Low', color: '#6A8F7A', bg: 'bg-brand-sage/15' },
};

export function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.MEDIUM;

  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${config.bg}`}>
      <Text style={{ color: config.color }} className="text-[10px] font-semibold uppercase tracking-wide">
        {config.label} risk
      </Text>
    </View>
  );
}

/** Shortened host, so a long URL does not wrap across three lines. */
function hostOf(url: string): string {
  const withoutScheme = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const host = withoutScheme.split('/')[0] ?? withoutScheme;
  return host;
}

/**
 * A tappable citation.
 *
 * Only ever rendered for a URL the backend confirmed was actually retrieved —
 * stripInventedCitations nulls anything else — so a link here is never a
 * fabricated one.
 */
export function SourceLink({ url }: { url: string }) {
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(url).catch((error) => {
          console.error('[ResearchReport] Could not open source URL:', error);
        });
      }}
      hitSlop={6}
      className="flex-row items-center gap-x-1 self-start active:opacity-60"
    >
      <Ionicons name="open-outline" size={11} color="#6A8F7A" />
      <Text className="text-[11px] font-medium text-brand-sage underline" numberOfLines={1}>
        {hostOf(url)}
      </Text>
    </Pressable>
  );
}
