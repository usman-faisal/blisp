import Text from '@/components/ui/Text';
import type { VerificationMetricsPayload } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { ReportSection } from './ReportSection';

function MetricRow({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
  hint?: string;
}) {
  const valueColor =
    tone === 'good'
      ? '#4A8C68'
      : tone === 'bad'
        ? '#D94F3D'
        : tone === 'warn'
          ? '#C9A84C'
          : '#1A1714';

  return (
    <View className="flex-row items-start justify-between border-b border-semantic-border/40 py-2.5">
      <View className="flex-1 pr-3">
        <Text className="text-[13px] text-core-text-primary">{label}</Text>
        {hint && (
          <Text className="mt-0.5 text-[11px] leading-4 text-core-text-disabled">{hint}</Text>
        )}
      </View>
      <Text style={{ color: valueColor }} className="text-[13px] font-semibold">
        {value}
      </Text>
    </View>
  );
}

/**
 * How this report's citations were checked, and what the check found.
 *
 * Exists because "the model cited a URL" and "the source supports the claim"
 * are different things, and only the second is worth trusting. Showing the
 * numbers — including the unflattering ones — is the point: a report that
 * quietly dropped half its citations should say so.
 */
export function VerificationPanel({
  verification,
  sourceCount,
}: {
  verification: VerificationMetricsPayload | null;
  sourceCount: number;
}) {
  // Null means the report predates verification entirely. Saying nothing would
  // let an old report look as though it had been checked.
  if (!verification) {
    return (
      <ReportSection title="How this was verified" icon="shield-outline">
        <View className="mt-2 flex-row gap-x-2 rounded-xl bg-core-background p-3">
          <Ionicons name="information-circle-outline" size={14} color="#B0AAA3" />
          <Text className="flex-1 text-xs leading-[18px] text-core-text-secondary">
            This report was generated before citation checking was added, so its claims have not
            been verified against their sources. Regenerating will produce a checked version.
          </Text>
        </View>
      </ReportSection>
    );
  }

  const { ran, checked, supported, notSupported, contradicted, demoted, inventedCitations } =
    verification;

  const passRate = checked > 0 ? Math.round((supported / checked) * 100) : null;

  return (
    <ReportSection
      title="How this was verified"
      icon="shield-checkmark-outline"
      badge={ran && checked > 0 ? `${supported}/${checked}` : undefined}
    >
      {/* The check did not run — say so plainly rather than showing zeroes
          that read like a clean result. */}
      {!ran && (
        <View className="mt-2 flex-row gap-x-2 rounded-xl bg-brand-flax/10 p-3">
          <Ionicons name="alert-circle-outline" size={14} color="#C9A84C" />
          <View className="flex-1">
            <Text className="text-xs font-semibold text-core-text-primary">
              Citation check did not run
            </Text>
            <Text className="mt-1 text-[11px] leading-4 text-core-text-secondary">
              {verification.skippedReason ??
                'The verification step was skipped for this version.'}
            </Text>
          </View>
        </View>
      )}

      {ran && (
        <>
          <View className="mt-2">
            <MetricRow
              label="Sources retrieved"
              value={sourceCount}
              hint="Real pages returned by web search"
            />
            <MetricRow
              label="Fabricated links removed"
              value={inventedCitations}
              tone={inventedCitations > 0 ? 'bad' : 'good'}
              hint="URLs the model cited that were never retrieved"
            />
            <MetricRow
              label="Cited claims checked"
              value={checked}
              hint="Each compared against the text of the page it cites"
            />
            <MetricRow
              label="Supported by their source"
              value={supported}
              tone={supported > 0 ? 'good' : 'neutral'}
            />
            <MetricRow
              label="Not found in the source"
              value={notSupported}
              tone={notSupported > 0 ? 'warn' : 'neutral'}
              hint={notSupported > 0 ? 'Shown as analysis, not evidence' : undefined}
            />
            {contradicted > 0 && (
              <MetricRow
                label="Contradicted by the source"
                value={contradicted}
                tone="bad"
                hint="The page states something incompatible"
              />
            )}
            <MetricRow
              label="Citations withdrawn"
              value={demoted}
              tone={demoted > 0 ? 'warn' : 'good'}
            />
          </View>

          {passRate !== null && (
            <View className="mt-3 rounded-xl bg-core-background p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-core-text-primary">
                  Citation accuracy
                </Text>
                <Text
                  style={{ color: passRate >= 70 ? '#4A8C68' : passRate >= 40 ? '#C9A84C' : '#D94F3D' }}
                  className="text-xs font-semibold"
                >
                  {passRate}%
                </Text>
              </View>
              <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-core-surface-elevated">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${passRate}%`,
                    backgroundColor:
                      passRate >= 70 ? '#4A8C68' : passRate >= 40 ? '#C9A84C' : '#D94F3D',
                  }}
                />
              </View>
              <Text className="mt-2 text-[11px] leading-4 text-core-text-secondary">
                Share of cited claims the cited page actually supports. A low figure does not mean
                the claims are false — it means they are the model's analysis rather than something
                the source establishes.
              </Text>
            </View>
          )}
        </>
      )}

      {/* The method, including its limitation. This travels with the report
          rather than living only in documentation. */}
      <View className="mt-3 rounded-xl bg-core-surface p-3">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
          Method
        </Text>
        <Text className="mt-1 text-[11px] leading-4 text-core-text-secondary">
          {verification.method}
        </Text>
        <Text className="mt-2 text-[11px] leading-4 text-core-text-secondary">
          Checking compares each claim with the excerpt of the page that was retrieved, not the
          whole page, and the judge is a language model. A claim supported further down a long page
          can therefore be marked unsupported.
        </Text>
        {verification.model ? (
          <Text className="mt-2 text-[10px] text-core-text-disabled">
            Checked by {verification.model}
          </Text>
        ) : null}
        {/* Stated here, next to the numbers it qualifies, rather than only as a
            badge at the top of the screen. */}
        <Text className="mt-2 text-[10px] leading-4 text-core-text-disabled">
          This feature is in beta. Treat the report as a reviewed starting point, not a verified
          source — check anything you plan to act on.
        </Text>
      </View>
    </ReportSection>
  );
}
