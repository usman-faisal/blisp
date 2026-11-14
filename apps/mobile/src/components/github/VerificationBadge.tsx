import Text from '@/components/ui/Text';
import type { VerificationVerdictValue } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

/**
 * How a completion claim is presented.
 *
 * The wording here is the whole ethical weight of the feature. Task status is
 * self-reported, and the point of verification is to say what is corroborated
 * — not to accuse anyone. So UNVERIFIED reads "not checked", never "not done":
 * writing docs, pairing on someone else's branch, or simply forgetting the
 * reference all land there legitimately.
 *
 * Colour follows the same rule. Only DISPUTED is red, because only DISPUTED
 * means the evidence actively contradicts the claim. UNVERIFIED is neutral
 * grey, not a warning, because "we could not check" is not a problem with the
 * user.
 */
const VERDICT_CONFIG: Record<
  VerificationVerdictValue,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; blurb: string }
> = {
  VERIFIED: {
    label: 'Verified',
    icon: 'checkmark-circle',
    color: '#2E7D53',
    bg: 'bg-semantic-success/10',
    blurb: 'A commit references this task.',
  },
  UNVERIFIED: {
    label: 'Not checked',
    icon: 'help-circle-outline',
    color: '#6B6560',
    bg: 'bg-core-surface',
    // Deliberately about the evidence, not the person.
    blurb: 'No commit references this task yet.',
  },
  SELF_REPORTED: {
    label: 'Self-reported',
    icon: 'person-outline',
    color: '#6B6560',
    bg: 'bg-core-surface',
    blurb: 'No repository linked, so this could not be checked.',
  },
  DISPUTED: {
    label: 'Check this',
    icon: 'alert-circle-outline',
    color: '#D94F3D',
    bg: 'bg-semantic-danger/10',
    blurb: 'The linked work predates this task.',
  },
};

export function VerificationBadge({
  verdict,
  compact = false,
}: {
  verdict: VerificationVerdictValue | null;
  compact?: boolean;
}) {
  // Nothing is shown for an unjudged task rather than a placeholder: an empty
  // badge would imply a verdict that has not been reached.
  if (!verdict) return null;

  const config = VERDICT_CONFIG[verdict];

  if (compact) {
    return (
      <View className={`flex-row items-center gap-x-1 rounded-md px-1.5 py-0.5 ${config.bg}`}>
        <Ionicons name={config.icon} size={10} color={config.color} />
        <Text style={{ color: config.color }} className="text-[9px] font-semibold">
          {config.label}
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-row items-center gap-x-1.5 self-start rounded-lg px-2 py-1 ${config.bg}`}>
      <Ionicons name={config.icon} size={13} color={config.color} />
      <Text style={{ color: config.color }} className="text-[11px] font-semibold">
        {config.label}
      </Text>
    </View>
  );
}

export function verdictBlurb(verdict: VerificationVerdictValue): string {
  return VERDICT_CONFIG[verdict].blurb;
}

/**
 * The project-wide line under overall progress.
 *
 * Shows a ratio rather than a bare percentage so the denominator is visible:
 * "4 of 6" invites a user to look at the other two, where "67%" asks them to
 * accept a number.
 */
export function VerificationSummaryLine({
  summary,
}: {
  summary: { verified: number; unverified: number; disputed: number; selfReported: number; percentVerified: number | null };
}) {
  const checkable = summary.verified + summary.unverified + summary.disputed;

  // Nothing checkable means no repository is linked. Saying "0% verified"
  // would report a setup choice as a failure.
  if (checkable === 0) {
    if (summary.selfReported === 0) return null;

    return (
      <View className="mt-2 flex-row items-center gap-x-1.5">
        <Ionicons name="information-circle-outline" size={12} color="#6B6560" />
        <Text className="text-[11px] text-core-text-secondary">
          Link a repository to check completions against your commits.
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-2 flex-row items-center gap-x-1.5">
      <Ionicons name="shield-checkmark-outline" size={12} color="#2E7D53" />
      <Text className="text-[11px] text-core-text-secondary">
        {summary.verified} of {checkable} completion{checkable === 1 ? '' : 's'} backed by evidence
        {summary.disputed > 0 ? ` · ${summary.disputed} to check` : ''}
      </Text>
    </View>
  );
}
