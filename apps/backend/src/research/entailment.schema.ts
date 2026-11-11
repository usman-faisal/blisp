import { z } from 'zod';

/**
 * Verdict on whether a cited excerpt supports the claim made from it.
 *
 * Three values rather than a boolean because CONTRADICTED is worth recording
 * separately: a claim the source actively disputes is a different (and worse)
 * failure than one the source merely does not mention, and the metrics table
 * should be able to say which happened.
 */
export const EntailmentVerdict = z.enum(['SUPPORTED', 'NOT_SUPPORTED', 'CONTRADICTED']);

export type EntailmentVerdictValue = z.infer<typeof EntailmentVerdict>;

/**
 * One judgement, keyed back to the claim by index.
 *
 * Indices rather than ids because the items being checked are positions in the
 * report's own arrays — there is nothing stable to key on, and asking the model
 * to echo the claim text back would invite it to paraphrase and break matching.
 */
const entailmentJudgement = z.object({
  index: z.number().int().min(0),
  verdict: EntailmentVerdict,
  /** One short sentence. Recorded for audit, not shown as prose to the user. */
  reason: z.string(),
});

export const entailmentBatchSchema = z.object({
  judgements: z.array(entailmentJudgement),
});

/**
 * What gets checked: one claim plus the excerpt of the page it cites.
 *
 * `excerpt` is Tavily's snippet, not the full page — see the caveat in
 * VERIFICATION_SYSTEM_PROMPT and in the stored `method` field.
 */
export interface EntailmentCandidate {
  index: number;
  /** Where in the report this came from, for the metrics breakdown. */
  location: 'gapsAndOpportunities' | 'comparableProducts';
  claim: string;
  sourceUrl: string;
  excerpt: string;
}

/**
 * Per-report verification metrics, persisted alongside the sections.
 *
 * Stored rather than recomputed so the UI can show what was checked at the
 * time the report was made — a later change to the checking logic must not
 * silently rewrite the record of an older report.
 */
export interface VerificationMetrics {
  /** True when the entailment pass ran to completion. */
  ran: boolean;
  /** Why it did not run, when `ran` is false. Shown so the UI never overclaims. */
  skippedReason?: string;
  /** URLs the model cited that were not in the retrieved set at all. */
  inventedCitations: number;
  /** Claims submitted to the entailment check. */
  checked: number;
  supported: number;
  notSupported: number;
  contradicted: number;
  /** Claims demoted to ANALYSIS as a result — notSupported + contradicted. */
  demoted: number;
  /** Named so the limitation travels with the data, not just the docs. */
  method: string;
  verifiedAt: string;
  model: string;
}

/** Recorded on the row when the pass could not run, so `ran: false` is explicit. */
export function skippedMetrics(reason: string, inventedCitations: number): VerificationMetrics {
  return {
    ran: false,
    skippedReason: reason,
    inventedCitations,
    checked: 0,
    supported: 0,
    notSupported: 0,
    contradicted: 0,
    demoted: 0,
    method: VERIFICATION_METHOD,
    verifiedAt: new Date().toISOString(),
    model: '',
  };
}

/**
 * Deliberately names the limitation.
 *
 * The excerpt is roughly the first 1200 characters Tavily returns, not the
 * whole page, so a claim supported further down a long page is marked
 * NOT_SUPPORTED. That is a false negative, which is the safe direction to fail
 * in, but it means the honest wording is "supported by the retrieved excerpt"
 * rather than "supported by the source".
 */
export const VERIFICATION_METHOD = 'LLM entailment against the retrieved search excerpt (not the full page)';
