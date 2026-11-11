import { z } from 'zod';

/**
 * Where a statement came from. The plan requires the user to be able to tell
 * these apart, so it is part of the schema rather than prose the model may or
 * may not include.
 */
export const EvidenceKind = z.enum(['VERIFIED', 'ANALYSIS', 'RECOMMENDATION']);

/**
 * A single claim.
 *
 * VERIFIED claims must cite a URL. That is enforced after generation in
 * research.service.ts against the URLs Tavily actually returned — a model
 * cannot be trusted not to invent a plausible-looking link.
 */
const claim = z.object({
  text: z.string().min(1),
  kind: EvidenceKind,
  sourceUrl: z.string().nullable().describe('Required for VERIFIED claims; null for ANALYSIS and RECOMMENDATION.'),
});

const comparableProduct = z.object({
  name: z.string().min(1),
  whatItDoesWell: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()),
  sourceUrl: z.string().nullable(),
});

/**
 * A feature worth adopting, with the reason it fits THIS user.
 *
 * `whyItMattersHere` is mandatory: the plan requires recommendations to be
 * justified against the user's context, not listed by popularity.
 */
const recommendedFeature = z.object({
  feature: z.string().min(1),
  whyItMattersHere: z.string().min(1),
  priority: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'LATER']),
});

/**
 * The discovery report.
 *
 * Several arrays are `.min(1)`. That is deliberate and load-bearing: it makes
 * "similar products exist, do not build this" a schema violation rather than a
 * valid answer. A model that tries to reject the idea fails validation and the
 * job retries instead of discouraging the user. See RESEARCH_SYSTEM_PROMPT.
 */
export const researchReportSchema = z.object({
  /** 1. Plain-language restatement, so the user can catch misunderstandings. */
  ideaSummary: z.string().min(1),
  assumptions: z.array(z.string()),

  /** 2. */
  problemStatement: z.string().min(1),
  targetUsers: z.array(z.string()).min(1),

  /** 3 + 4. Comparable products and what to learn from them. */
  comparableProducts: z.array(comparableProduct),

  /** 5. Strongest relevant features worth adopting. */
  featuresWorthAdopting: z.array(recommendedFeature),

  /** 6. */
  gapsAndOpportunities: z.array(claim),

  /** 7. Non-empty: there is always something worth building. */
  recommendedFeatures: z.array(recommendedFeature).min(1),

  /** 8. Non-empty: an idea is never purely derivative. */
  differentiators: z.array(z.string()).min(1),

  /** 9. MVP scope. mustHave is non-empty or there is no MVP to build. */
  mvpScope: z.object({
    mustHave: z.array(z.string()).min(1),
    shouldHave: z.array(z.string()),
    later: z.array(z.string()),
  }),

  /** 10. */
  technicalFeasibility: z.object({
    summary: z.string().min(1),
    suggestedStack: z.array(z.string()),
    architectureNotes: z.array(z.string()),
  }),

  /** 11. */
  risks: z.array(
    z.object({
      risk: z.string().min(1),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      mitigation: z.string().min(1),
    }),
  ),
  roughEffort: z.string().min(1),

  /** 12. Questions only where the answer would change the recommendation. */
  openQuestions: z.array(z.string()),

  /**
   * 13. Honesty about coverage. The plan forbids claiming an idea is original
   * on the strength of a limited search, so this is a required field.
   */
  evidenceGaps: z.array(z.string()),

  /** Beginner-friendly top-level takeaway, shown before the detail sections. */
  executiveSummary: z.string().min(1),
});

/** Exactly what the model returns, before any post-processing. */
export type GeneratedReportSections = z.infer<typeof researchReportSchema>;

/**
 * The stored report: what the model produced, plus flags the pipeline adds.
 *
 * Kept separate from the generation schema deliberately. Anything optional in
 * the schema sent to the provider breaks strict JSON-schema mode — Groq rejects
 * a schema whose `required` array omits any property — and a field the model
 * never supplies has no business being in its instructions either. So
 * post-generation annotations are layered on here instead.
 */
export type ResearchReportSections = GeneratedReportSections & {
  comparableProducts: (GeneratedReportSections['comparableProducts'][number] & {
    /**
     * Set by the entailment pass when the cited page does not support the
     * weaknesses listed. The UI must not present those as sourced.
     */
    weaknessesUnverified?: boolean;
  })[];
};

/** One retrieved source, recorded with the date it was fetched. */
export interface ReportSource {
  title: string;
  url: string;
  retrievedAt: string;
}

/**
 * The product shortlist that drives the criticism searches.
 *
 * A separate, tiny schema rather than a field on the report: it is asked for
 * before the report exists, purely to decide what to search for next.
 */
export const productShortlistSchema = z.object({
  products: z.array(z.string()),
});
