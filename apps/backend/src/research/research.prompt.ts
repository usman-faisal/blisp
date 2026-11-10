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
}

export function buildResearchPrompt(input: ResearchPromptInput): string {
  const { title, description, techStack, rawTranscript, searchContext, researchDate } = input;

  return `Produce a product discovery report for this idea.

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
- featuresWorthAdopting: the strongest ideas from those products worth borrowing.
- recommendedFeatures: what THIS person should build, each with a priority and a
  concrete reason it matters for their target user.
- differentiators: how their version can be meaningfully better or better-fitted.
- mvpScope: a scope that is actually finishable, split must/should/later.
- risks: real technical and scope risks, each with a practical mitigation.
- evidenceGaps: what the search did not establish. Be candid.`;
}

/**
 * The four searches behind one report.
 *
 * Four at basic depth is a deliberate budget: enough to source every section
 * while keeping Tavily credits and latency bounded. Each targets a different
 * section so the evidence is spread rather than redundant.
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
