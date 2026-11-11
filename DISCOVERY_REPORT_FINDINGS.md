# Discovery Report — Engineering Findings

**Feature:** AI product-discovery report (Milestone 3) · **Status:** Beta
**Period:** 10–12 November 2026 · **Test project:** "Basic Todo App" (deliberately the most saturated category available)

This records what was built, what went wrong, and what the measurements showed.
It is the evidence base for the presentation: every number here comes from the
development database or a live API call, not from an estimate.

---

## 1. The headline result

The feature's purpose is to produce an *evidence-backed* report. The metric that
matters is therefore not "did it generate" but **how many of its cited claims
the cited page actually supports.**

| Run | Writer model | Retrieval | Cited claims checked | Supported | Withdrawn | Fabricated URLs |
|---|---|---|---|---|---|---|
| v4 | nemotron-3-nano 30B | 4 broad queries | 7 | **0** | 7 | 0 |
| v7 | gpt-oss-120b | 4 broad queries | 3 | 1 | 2 | 0 |
| **v13** | gpt-oss-120b | **4 broad + 3 criticism** | 4 | **3** | 1 | 0 |

**0/7 → 3/4.** Two interventions produced that change, and they are separable:
the model swap (v4→v7) and evidence-targeted retrieval (v7→v13).

Fabricated URLs stayed at zero throughout, because that guardrail existed from
the start.

---

## 2. The core finding: a citation is not evidence

The first version shipped with `stripInventedCitations`, which checks that every
cited URL was actually retrieved. Zero fabricated links — a real guarantee.

**But it was the wrong guarantee.** Manually fetching two cited pages showed:

| Claim | Cited page | Does the page say it? |
|---|---|---|
| Todo.txt: "Simplicity, Portability, Open source" | saashub.com | ✅ verbatim |
| Todo.txt: "requires technical ability", "no graphical UI" | saashub.com | ❌ **absent** |
| Microsoft To Do: "no built-in task reordering or priority tags" | apps365.com | ❌ **absent** |
| Todoist: "free version limited", "complex for beginners" | apps365.com | ❌ **absent** |

The pattern was systematic: **apps365 lists no weaknesses for any product.** The
model cited the page for a product's *strengths*, then supplied weaknesses from
its own training knowledge while carrying the same URL along — so the citation
implied support the page never gave.

The claims were often *plausible*. But plausible is not cited, and the UI was
presenting them as sourced.

> **For the presentation:** this is the distinction worth making. Verifying that
> a URL exists is cheap and catches the worst failure. Verifying that the page
> *supports the claim* is the harder and more valuable property, and the two are
> easy to confuse.

---

## 3. Intervention 1 — entailment verification

A second LLM pass takes each cited claim plus the excerpt of its cited page and
asks: *does this text support this claim?* Verdicts are `SUPPORTED`,
`NOT_SUPPORTED` or `CONTRADICTED`; anything unsupported is demoted to `ANALYSIS`
and loses its link.

**Design constraints that shaped it:**

- **One batched call, not one per claim.** On a free tier, per-claim calls would
  rate-limit immediately.
- **Zero extra search calls.** The excerpts are already in memory from the
  original Tavily results — verified by test.
- **A failure must never lose the report.** By that point the search credits and
  the main generation are already spent, so the pass is wrapped and records
  `ran: false` with a reason rather than discarding work.
- **A missing verdict leaves the claim alone.** A model returning a short batch
  must not be read as "the rest failed".

**Result on v4:** 7 checked, **7 withdrawn**. The judge independently reproduced
the manual finding above — all 7 traced to the two pages that document no
weaknesses. It was not rubber-stamping.

---

## 4. Intervention 2 — evidence-targeted retrieval

v4's 0/7 raised the obvious question: was the model careless, or was the evidence
simply absent? **Measured, not assumed** — two live Tavily calls:

| Query | What came back |
|---|---|
| `limitations and missing features in current Basic Todo App solutions` (original) | overviews, tutorials — **no product weaknesses** |
| `Microsoft To Do complaints limitations` (new) | *"No native Kanban or Gantt view… limited customization compared to Notion or Todoist… high dependence on the Microsoft ecosystem"* + a Microsoft Q&A thread of user-reported limits |

**The evidence was never in the corpus.** The schema demanded each product's
"real weaknesses"; the searches only ever returned listicles, which list
features. The model was filling a required field from the only source it had —
itself.

The fix is a **two-stage search**: run the broad queries, ask which products were
found, then search for criticism of *those named products*. Naming the product is
what makes its weaknesses citable.

**Effect on v13's corpus** — eight dedicated review sources the original queries
never surfaced:

`pcmag.com/reviews/anydo` · `au.pcmag.com/productivity/todoist` ·
`trustpilot.com/review/ticktick.com` · `thedigitalprojectmanager.com/tools/anydo-review` ·
`work-management.org/tasks/any-do-review` · `taskade.com/blog/todoist-review` ·
`efficient.app/apps/ticktick` · `apps.apple.com/…?see-all=reviews`

The prompt was also changed to say: if no source documents a weakness, **leave it
out**. v13 shows this working — the one withdrawn claim was a weakness sourced to
`blog.master.dev`, a tutorial about *building* a todo app, which documents no
product's shortcomings. The judge caught exactly the right one.

---

## 5. Six failures, and what each one taught

Every one was a distinct real constraint. They are listed because the debugging
path is itself a finding: free-tier inference has sharp edges that are invisible
until you hit them.

| # | Failure | Cause | Fix |
|---|---|---|---|
| 1 | `invalid JSON schema for response_format` | Groq's **strict** mode requires every property in `required`; an `.optional()` field broke it | Split `GeneratedReportSections` (what the model returns) from `ResearchReportSections` (plus post-processing flags) |
| 2 | `Request too large… Limit 8000, Requested 10772` | Adding 3 criticism searches took 12→21 sources at a flat 1,200 chars each | Budget the context: divide a fixed allowance among however many sources exist |
| 3 | `max completion tokens reached… missing required properties` | No explicit output cap, so the provider clamped it to whatever was left in the rate-limit window | Explicit `maxOutputTokens`, sized above the largest observed report |
| 4 | `No output generated` | gpt-oss is a **reasoning** model: hidden reasoning competes with the document for the output budget | `reasoningEffort: 'low'` + one retry on empty output |
| 5 | `EAI_AGAIN api.tavily.com` → **DRAFT with 0 sources** | `search()` returned `[]` on error, so "found nothing" and "unreachable" were indistinguishable | `searchWithStatus()` reporting `{ results, failed }`; fail the report if every search failed |
| 6 | Stale `@repo/db` bundle | `turbo` reported `FULL TURBO` (cached) after a migration, so `dist/` kept a Prisma client with no `verification` column | After any migration: `db:generate` **then** `pnpm --filter @repo/db build` |

### Measured facts behind those fixes

Worth quoting directly — these are the numbers, not estimates:

- **Reasoning effort.** Default: 1,129 reasoning tokens, 6,121 chars of content.
  `low`: **359** reasoning tokens, **6,682** chars. Lower effort produced *more*
  usable output — strictly better here.
- **Token budget.** Fixed input cost with an empty context is ~2,050 tokens
  (prompt scaffold 657 + system prompt 580 + JSON schema 817). Against an 8,000
  TPM ceiling with 4,000 reserved for output, that leaves ~1,950 for context.
- **Output size.** Real stored reports ranged **1,450–3,260 tokens**. Budgeting
  for the average rather than the worst case is what caused failure #3.
- **Verified end to end:** 21 sources → **6,170 / 8,000 tokens**, complete
  document, schema-valid.

### Failure #5 is the one worth presenting

A transient DNS blip produced a report that *looked* legitimate — saved as a
normal `DRAFT`, sitting in the version list beside properly researched ones.

The model behaved correctly: 0 products, and `evidenceGaps` stating *"No web
sources were available to document existing Todo app strengths or weaknesses."*
**The pipeline** was what misrepresented it, by treating total network failure as
a legitimate empty result.

> The lesson generalises: an error-swallowing default (`catch → return []`) is
> reasonable in most code and actively harmful when the returned value is the
> product's entire value proposition.

---

## 6. What the user can do with a report

| Action | Status written | Why it exists |
|---|---|---|
| Generate | `PENDING` → `DRAFT` | Always a new version; an approved report is never overwritten |
| Approve | `APPROVED` | Any prior approval is demoted to `DRAFT` but keeps its content |
| **Reject** (+ optional reason) | `REJECTED` | A report you disagree with was previously indistinguishable from one you hadn't read |
| **Cancel** | `CANCELLED` | Generation takes ~17–60s and could not be stopped |

**Rejection closes a loop.** The reason is fed into the next version's prompt as
stated feedback, so rejecting improves the next attempt rather than only
recording a verdict. A guard prevents this becoming a back door around the
product's core rule — there is a test asserting that *"this idea seems pointless,
tell me to stop"* still cannot make the model recommend against building.

**Cancel's honest limit:** a queued job is removed at no cost, but an in-flight
provider call cannot be recalled. So a running job checks the row's status
immediately before writing and **discards** its result rather than resurrecting a
`CANCELLED` row as a `DRAFT`.

Nothing is ever deleted. The version history is the record of what the pipeline
produced and what was caught — which is also what makes the table in §1 possible.

---

## 7. Anti-rejection guardrail (product rule)

A beginner told "that already exists" abandons the project. So the schema makes
rejection *structurally impossible*: `recommendedFeatures`, `differentiators` and
`mvpScope.mustHave` are all `.min(1)`. A model attempting to talk the user out of
building fails validation and retries.

Enforced in the schema rather than only in prose the model may ignore.

**Evidence it holds:** the todo-app test case — the most saturated category
available — found **15 comparable products** in v1 and still produced 8
recommended features, 2 differentiators and a 5-item MVP. The idea was not
rejected.

---

## 8. Stated limitations (beta)

These are design boundaries, not bugs. The feature is marked **beta in the UI**
for exactly these reasons.

1. **Excerpt-level, not full-page verification.** Checking uses the ~200–1,200
   characters Tavily returns, not the whole page. A claim supported further down
   a long page is marked unsupported — a **false negative**, the safe direction,
   but it means the honest wording is *"supported by the retrieved excerpt"*. The
   UI says this, and the phrase is stored in each report's `method` field.
2. **The judge is an LLM.** Currently the *same model* that writes the report.
   An independent judge model is the obvious next step and a stronger
   methodological claim; it was scoped but not built, because NVIDIA NIM
   recommends a non-standard `guided_json` parameter the AI SDK does not send.
3. **8,000 TPM is tight for a 16-field schema.** At 21 sources each excerpt is
   ~238 characters — enough to cite a specific weakness, thin for nuanced claims.
   A larger tier would allow richer excerpts. This is a resource constraint, not
   a design flaw.
4. **Two of v13's three supported claims are unverified by hand.** Independent
   checks were attempted; `pcmag.com` returned 403 and `efficient.app` 429. The
   structural evidence is strong (real review sites, correct demotion of the
   tutorial source) but those two rest on the judge's verdict.
5. **Retrieval is not fully deterministic.** An earlier claim that identical
   queries always return identical sources was **wrong** — v4 and v13 drew
   different sets as Tavily's index shifted. So v4 vs v13 is not a perfectly
   controlled comparison; the retrieval change is the dominant factor but not the
   only variable.

---

## 9. Reproducing the measurements

```bash
# Verification metrics per version
docker exec blisp-postgres psql -U root -d blisp -c "
SELECT version, status, model, verification FROM research_reports ORDER BY version;"

# Which product weaknesses were withdrawn
docker exec blisp-postgres psql -U root -d blisp -c "
SELECT c->>'name', c->>'weaknessesUnverified', c->>'sourceUrl'
FROM research_reports r, jsonb_array_elements(r.sections::jsonb->'comparableProducts') c
WHERE r.version = 13;"
```

**Test coverage:** 323 backend tests pass, including the cases that encode these
findings — a verification failure must not lose the report; a cancelled report
must not be rewritten as `DRAFT` or `FAILED`; an unreachable search must fail
rather than produce an evidence-free draft; the context budget must not grow
proportionally to source count.

---

## 10. Suggested slide structure

1. **The problem** — "that already exists" kills beginner projects; the schema
   makes rejection impossible (§7)
2. **The naive version** — cite sources, zero fabricated URLs. Looks solved.
3. **The finding** — open the cited page; it doesn't say that (§2 table)
4. **Fix 1: verify claims, not links** — 7/7 withdrawn on v4 (§3)
5. **Fix 2: the evidence wasn't there** — two-stage retrieval, the query
   comparison (§4)
6. **Result** — 0/7 → 3/4, with the honest caveats (§1, §8)
7. **What free-tier inference actually costs** — the six failures table (§5)
