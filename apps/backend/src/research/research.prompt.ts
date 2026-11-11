/**
 * System prompt for the discovery report.
 *
 * The first rule is the product's core stance and the reason this feature
 * exists: a beginner who hears "that already exists" abandons the project. The
 * schema backs this up by requiring non-empty recommendedFeatures,
 * differentiators and mvpScope.mustHave, so a rejection cannot validate.
 */
export const RESEARCH_SYSTEM_PROMPT = `You are a product discovery analyst helping someone turn an idea into a buildable project. You are rigorous about evidence and constructive about ideas.

NON-NEGOTIABLE RULES

1. Never reject an idea because similar products exist. Competition proves a real
   problem and a real market. Your job is to find the better-tailored version for
   THIS person, not to talk them out of building.
   - "Existing product" never means "no opportunity".
   - If a university wants an LMS, research Moodle/Canvas/Blackboard, identify
     their strongest relevant features and their real weaknesses, then recommend
     a solution fitted to that university's constraints.
   - You must always produce at least one recommended feature and at least one
     differentiator. There is always something worth building.

2. Separate evidence from opinion. Every claim is tagged:
   - VERIFIED: supported by a supplied search result. MUST include its sourceUrl.
   - ANALYSIS: your reasoning over the evidence. sourceUrl is null.
   - RECOMMENDATION: your advice for this user. sourceUrl is null.

3. Never invent anything. Do not fabricate sources, URLs, prices, user counts,
   adoption statistics, funding, or product capabilities. Only cite URLs that
   appear in the supplied search results — any other URL will be discarded and
   the claim will lose its evidence.
   - If the results do not cover something, say so in evidenceGaps.
   - Never claim an idea is original or unique: a handful of searches cannot
     establish that. Say what the search did and did not cover.

4. Recommend by fit, not by count. Select features that suit this person's
   skill level, deadline, available hours and team size. Explain in
   whyItMattersHere why each one matters for their target user. A shorter,
   achievable scope beats an impressive, unfinishable one.

5. Write for a capable beginner. Plain language, no jargon without explanation.
   executiveSummary must stand on its own for someone who reads nothing else.
   Be honest about difficulty without being discouraging, and never use
   shame-based or alarmist language.

6. Ask only questions whose answers would genuinely change your recommendation.
   Do not block useful research behind clarifications — make a reasonable,
   stated assumption instead and note it in assumptions.`;

export interface ResearchPromptInput {
  title: string;
  description: string;
  techStack: string[];
  rawTranscript?: string;
  /** Pre-formatted, numbered search results with URLs. */
  searchContext: string;
  /** ISO date the research ran, so the model can date its claims. */
  researchDate: string;
  /**
   * Why the user rejected the most recent version, when they said. Included so
   * a regeneration addresses the complaint instead of reproducing it.
   */
  rejectionFeedback?: string;
}

export function buildResearchPrompt(input: ResearchPromptInput): string {
  const { title, description, techStack, rawTranscript, searchContext, researchDate, rejectionFeedback } = input;

  // Placed first rather than appended: late instructions in a long prompt carry
  // less weight, and this is the one thing the user explicitly asked to be
  // different this time.
  const feedbackBlock = rejectionFeedback
    ? `THE USER REJECTED YOUR PREVIOUS ATTEMPT
They said:
"""
${rejectionFeedback}
"""
Address this directly in this version and do not repeat the problem they named.
This is their judgement of your previous output, not a change to the idea: the
idea below is unchanged and every rule above still applies. In particular, a
rejection is never a reason to recommend against building.

`
    : '';

  return `${feedbackBlock}Produce a product discovery report for this idea.

THE IDEA
Title: ${title}
Description: ${description || '(none given)'}
Intended tech stack: ${techStack.length ? techStack.join(', ') : '(not specified)'}
${rawTranscript ? `\nIn the person's own words:\n"""\n${rawTranscript}\n"""` : ''}

WEB SEARCH RESULTS (retrieved ${researchDate})
These are the only external sources available to you. Cite by exact URL, and
only these URLs. If they do not answer something, record it in evidenceGaps.

${searchContext || '(No search results were available. Base the report on analysis only, mark every claim ANALYSIS or RECOMMENDATION, and state the absence of web evidence in evidenceGaps.)'}

WHAT TO PRODUCE
Fill every field of the schema. Specifically:
- comparableProducts: real products from the search results, with both their
  genuine strengths and their real weaknesses. Do not pad with invented ones.
  Some of the results above are reviews and complaint threads about specific
  products — take weaknesses from those and cite them. If no result documents a
  product's weaknesses, leave its weaknesses list short or empty rather than
  supplying them from your own knowledge: an uncited weakness will be stripped
  of its citation and marked unverified.
- featuresWorthAdopting: the strongest ideas from those products worth borrowing.
- recommendedFeatures: what THIS person should build, each with a priority and a
  concrete reason it matters for their target user.
- differentiators: how their version can be meaningfully better or better-fitted.
- mvpScope: a scope that is actually finishable, split must/should/later.
- risks: real technical and scope risks, each with a practical mitigation.
- evidenceGaps: what the search did not establish. Be candid.`;
}

/**
 * The four broad searches that open a report.
 *
 * Four at basic depth is a deliberate budget: enough to source every section
 * while keeping Tavily credits and latency bounded. Each targets a different
 * section so the evidence is spread rather than redundant.
 *
 * These return overviews and listicles, which cover products' strengths well
 * and their weaknesses hardly at all — see buildCriticismQueries for why that
 * matters and what fixes it.
 */
export function buildSearchQueries(title: string, description: string, techStack: string[]): string[] {
  const idea = `${title} ${description}`.trim().slice(0, 240);
  const stack = techStack.slice(0, 4).join(' ');

  return [
    // Competitors and comparable products → comparableProducts
    `existing products and alternatives similar to ${idea}`,
    // User needs and pain points → problemStatement, targetUsers
    `user problems complaints and unmet needs with ${title}`,
    // Feasibility → technicalFeasibility, risks
    `how to build ${title}${stack ? ` with ${stack}` : ''} architecture and technical challenges`,
    // Market gaps → gapsAndOpportunities, differentiators
    `limitations and missing features in current ${title} solutions`,
  ];
}

/** Products the first pass named, worth searching for criticism of. */
export const MAX_CRITICISM_QUERIES = 3;

/**
 * Follow-up searches for criticism of specific named products.
 *
 * The reason this exists: the schema requires each comparable product's "real
 * weaknesses", but the broad queries above return listicles and vendor pages,
 * which list features and almost never shortcomings. With no sourced weaknesses
 * available, the model supplied them from its own knowledge while carrying over
 * the URL that backed the strengths — so the citation implied support the page
 * did not give. Verification then (correctly) withdrew nearly every one.
 *
 * Measured, not assumed: "limitations and missing features in current Basic Todo
 * App solutions" returned only overviews, while "Microsoft To Do complaints
 * limitations" returned a comparison page listing "No native Kanban or Gantt
 * view, limited customization, high dependence on the Microsoft ecosystem" and
 * a Microsoft Q&A thread of user-reported limits. Naming the product is what
 * makes its weaknesses citable.
 *
 * Capped at three because this runs in addition to the four broad searches, and
 * Tavily's free tier is the binding constraint.
 */
export function buildCriticismQueries(productNames: string[]): string[] {
  return productNames
    .map((name) => name.trim())
    .filter((name) => name.length > 1)
    .slice(0, MAX_CRITICISM_QUERIES)
    .map((name) => `${name} review problems complaints limitations what users dislike`);
}

/**
 * Asks only for the product names, so the criticism searches know what to look
 * for. Deliberately cheap: no analysis, just the shortlist.
 */
export function buildProductShortlistPrompt(title: string, description: string, searchContext: string): string {
  return `From the search results below, list the real, existing products that compete with or resemble this idea.

THE IDEA
${title}${description ? `\n${description}` : ''}

SEARCH RESULTS
${searchContext || '(none)'}

Name only products that actually appear in the results. Do not invent any, and
do not include generic categories, tutorials, articles or the idea itself —
only named products. At most ${MAX_CRITICISM_QUERIES} of the most relevant.`;
}
