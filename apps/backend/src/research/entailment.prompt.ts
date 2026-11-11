import { EntailmentCandidate } from './entailment.schema';

/**
 * System prompt for the entailment pass.
 *
 * This is a second, adversarial look at the first pass's output. The framing is
 * deliberately strict: the default answer is NOT_SUPPORTED, because the failure
 * this check exists to catch is a plausible-sounding claim carrying a citation
 * that does not actually back it. A lenient judge would wave those through and
 * leave the VERIFIED badge meaning nothing.
 */
export const VERIFICATION_SYSTEM_PROMPT = `You are a fact-checking auditor. You are given claims that were written about a web page, together with an excerpt of that page. For each one, decide whether the excerpt actually supports the claim.

You are NOT judging whether the claim is true in general. You are judging one thing only: does THIS excerpt state or directly imply it?

VERDICTS

- SUPPORTED: the excerpt states the claim, or so directly implies it that no
  outside knowledge is needed. Near-paraphrase counts.
- NOT_SUPPORTED: the excerpt does not mention this, or mentions the topic
  without establishing the specific claim. This is the correct verdict whenever
  confirming the claim would require knowledge from outside the excerpt — even
  if you personally believe the claim is true.
- CONTRADICTED: the excerpt states something incompatible with the claim.

RULES

1. Default to NOT_SUPPORTED. Only answer SUPPORTED when you can point to the
   specific wording that carries the claim.
2. A claim about a product's weaknesses needs the excerpt to describe those
   weaknesses. An excerpt that lists only a product's strengths does not
   support a claim about its shortcomings, however plausible that claim is.
3. Your own knowledge of these products is irrelevant. "This is true, I know
   it independently" is NOT_SUPPORTED.
4. The excerpt is a partial extract of a longer page. If it simply does not
   cover the topic, that is NOT_SUPPORTED — do not assume the rest of the page
   would have confirmed it.
5. Return exactly one judgement per claim, echoing the index you were given.
   Keep each reason to one short sentence.`;

export function buildEntailmentPrompt(candidates: EntailmentCandidate[]): string {
  const blocks = candidates
    .map(
      (c) => `--- CLAIM ${c.index} ---
CLAIM: ${c.claim}
CITED PAGE: ${c.sourceUrl}
EXCERPT OF THAT PAGE:
"""
${c.excerpt}
"""`,
    )
    .join('\n\n');

  return `Check each claim below against the excerpt of the page it cites.

${blocks}

Return one judgement per claim, ${candidates.length} in total, each echoing its CLAIM index.`;
}
