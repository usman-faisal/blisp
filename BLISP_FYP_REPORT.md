# BLISP — Final Year Project Report

**A voice-first agentic productivity system that turns spoken ideas into
researched, scheduled and verifiable work.**

| | |
|---|---|
| Target submission | 20 November 2026 |
| Feature freeze | 17–18 November 2026 |
| Repository | `usman-faisal/blisp` |
| Document date | 14 November 2026 |

> **Scope of this document.** This is the consolidated engineering report,
> written to support the dissertation and defence. Every quantitative claim in
> it was measured against the running system, not estimated. Where something
> was not built, or was measured and found wanting, it is recorded as such —
> Section 9 is entirely limitations, and Section 7 records the failures that
> shaped the design.
>
> Companion documents: [BLISP_IMPLEMENTATION_PLAN.md](./BLISP_IMPLEMENTATION_PLAN.md)
> (the specification), [BLISP_PROGRESS.md](./BLISP_PROGRESS.md) (milestone
> log), [DISCOVERY_REPORT_FINDINGS.md](./DISCOVERY_REPORT_FINDINGS.md) (the
> AI-verification experiment), [COLLABORATION_PROGRESS.md](./COLLABORATION_PROGRESS.md)
> (multi-user work).

---

## 1. Thesis

Most productivity tools accept what the user tells them. You type a task, you
tick it off, and the software records your claim as fact. When an AI feature is
added, the same credulity is extended to the model: it produces a plausible
document with citations, and the citations are displayed as though they were
evidence.

BLISP's contribution is to take the opposite position in both cases:

> **A claim is not evidence. The system should say what it can corroborate,
> what it cannot, and keep the difference visible.**

This single principle is applied twice, to two different kinds of claim:

| Claim | Made by | Checked against | Verdicts |
|---|---|---|---|
| "This competitor has weakness X" | the language model | the retrieved source excerpt | `SUPPORTED` / `NOT_SUPPORTED` / `CONTRADICTED` |
| "I finished this task" | the user | commits in the linked repository | `VERIFIED` / `UNVERIFIED` / `SELF_REPORTED` / `DISPUTED` |

Both verdict sets deliberately include an "I cannot tell" outcome. Collapsing
that into a boolean would be the single easiest way to make the system dishonest.

The measured result of applying this to AI output: **0 of 7 cited claims in the
first implementation were actually supported by their sources.** That finding,
and the two interventions that raised it to 3 of 4, are the empirical core of
this project (Section 6).

---

## 2. System overview

### 2.1 What it does

1. **Capture** — the user holds a button and speaks an idea. Speech-to-text
   returns an editable transcript; nothing is submitted until they confirm it.
2. **Structure** — an LLM pipeline turns the transcript into a project with a
   classification, a tech stack and initial tasks.
3. **Research** — a discovery report finds comparable products, their
   weaknesses, and recommended features, with every claim checked against its
   source and the result reported as a metrics table.
4. **Plan** — the approved scope becomes a dated roadmap of milestones,
   computed from the user's real deadline, hours per day and skill level. If
   it does not fit, the system offers two remedies rather than silently
   failing.
5. **Execute** — a daily plan surfaces today's work. Progress is weighted by
   effort, not task count.
6. **Verify** — completions are checked against commits in a linked GitHub
   repository, and the proportion backed by evidence is shown alongside the
   progress figure.
7. **Collaborate** — projects support membership, invites, assignment,
   comments with @mentions, and notifications.

### 2.2 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Mobile (Expo 55 / React Native 0.83 / NativeWind)           │
│  Expo Router · TanStack Query · Clerk Expo                   │
└───────────────────────────┬──────────────────────────────────┘
                            │  HTTPS  /api/v1
┌───────────────────────────▼──────────────────────────────────┐
│  Backend (NestJS 11)                                         │
│  AuthGuard (Clerk)  →  ProjectAccessService.assertMember     │
│                                                              │
│  brain_dumps  research  roadmap  tasks  github  comments     │
│  invites  notifications  daily_plan  transcription  users    │
└────┬───────────────┬──────────────┬──────────────┬───────────┘
     │               │              │              │
┌────▼─────┐  ┌──────▼──────┐  ┌────▼─────┐  ┌─────▼──────────┐
│PostgreSQL│  │ Redis +     │  │ Groq     │  │ Tavily, GitHub │
│ 18       │  │ BullMQ      │  │ (LLM+STT)│  │ (read-only)    │
│ Prisma 6 │  │ (async jobs)│  │          │  │                │
└──────────┘  └─────────────┘  └──────────┘  └────────────────┘
```

**Monorepo** (pnpm + Turborepo): `apps/backend`, `apps/mobile`,
`packages/db`, `packages/types`, `packages/tailwind-config`.

`packages/types` is shared between client and server, so a change to an API
payload is a compile error on both sides rather than a runtime surprise.

### 2.3 Scale (measured 14 Nov 2026)

| Metric | Value |
|---|---|
| Backend production code | 11,089 lines |
| Backend test code | 6,740 lines |
| Mobile code | 11,809 lines |
| REST endpoints | 68 |
| Database models | 17 |
| Database enums | 15 |
| Migrations | 20 |
| Automated tests | **487**, 28 suites, all passing |

The test-to-production ratio of roughly **0.61:1** on the backend is deliberate
and concentrated where correctness is hardest to eyeball: scheduling
arithmetic, progress weighting, verification rules and access control.

---

## 3. Core functionality

### 3.1 Voice capture (Milestone 2)

Press-and-hold recording → upload → transcript → **user edits** → submit.

The separation matters: transcription never creates a project directly. A bad
transcript therefore cannot produce a bad project, and submission stays an
explicit user act.

**Provider:** Groq Whisper (`whisper-large-v3-turbo`). The module is
provider-agnostic by construction — `TranscriptionProvider` is an interface
bound through a DI symbol in one place — and xAI's Grok remains implemented and
tested behind `STT_PROVIDER=xai`.

> **Naming note for the defence.** *Groq* and *Grok* are different companies
> whose names differ by one letter. Groq hosts OpenAI's Whisper on a free tier;
> xAI's Grok bills per audio hour with no free tier. The project uses **Groq**.

**Measured:** 82,738 bytes of real speech → transcript in one request
(`27 chars, 4.969s`); a separate 19-second recording returned a complete,
accurate transcript on a physical device.

### 3.2 Discovery report (Milestone 3) — marked **beta**

The research pipeline produces comparable products, their weaknesses,
recommended features, differentiators and an MVP scope — then **checks its own
output** before showing it. See Section 6; this is the project's main
contribution.

The user can approve, **reject with a reason**, or **cancel** a running
generation. Each generation is a new version; an approved report is never
overwritten.

### 3.3 Roadmap and scheduling (Milestone 4)

Scope (optionally pre-filled from the approved report) becomes dated milestones.

**Progress is weighted by effort, not count.** Nine small tasks done with one
large one outstanding is 90% by count but 53% by effort; the UI shows the
weighted figure prominently and the count figure beside it, because showing
only the flattering number would misrepresent remaining work.

**Cancelled and deferred tasks are excluded from both numerator and
denominator** — otherwise dropping scope would make a project look like it was
falling behind, which punishes a correct decision.

**Schedule overflow offers two remedies and applies neither automatically:**

| Remedy | Behaviour |
|---|---|
| Put in more hours | computes the hours/day actually required |
| Trim the scope | proposes which tasks to defer, `LATER` → `SHOULD_HAVE` first |

`MUST_HAVE` tasks are **never** proposed for cutting, and if deferring
everything cuttable still does not fit, the shrink-scope remedy is withheld
rather than offering a fix that would not work.

### 3.4 Completion verification (Milestone 6)

The feature that closes the loop on self-reporting. Full design in Section 5.

### 3.5 Collaboration (Milestone 8)

Membership, invites, assignment, comments with @mentions, and notifications.
`ProjectAccessService.assertMember` is the single authorization primitive, used
by every project-scoped service. See [COLLABORATION_PROGRESS.md](./COLLABORATION_PROGRESS.md).

---

## 4. Non-functional requirements

### 4.1 Security

| Control | Implementation |
|---|---|
| Authentication | Clerk; `AuthGuard` on every controller except health, webhook and dev-tokens |
| Authorization | `assertMember` / `assertOwner` in every project-scoped service (github 8, roadmap 10, projects 8, research 7, invites 7, comments 3, tasks 3 call sites) |
| Secrets | Server-side only. No API key reaches the client; tokens are never returned by any endpoint |
| Webhook integrity | Clerk webhooks verified with `svix` signatures |
| Dev tokens | Triple-gated: module not registered unless `NODE_ENV !== production`, re-checked per request, **and** `ENABLE_DEV_TOKENS=true` |
| GitHub access | **Read-only.** No write verb exists anywhere in the client |
| Error messages | Provider failures are mapped to user-facing messages that never leak internals; error objects are never interpolated into logs, as some runtimes attach request headers (and therefore keys) |

**On the three unguarded controllers:** `app.controller` is a health check,
`webhook.controller` authenticates by signature rather than bearer token (it is
called by Clerk, not a user), and `dev-tokens.controller` is gated as above and
returns 404 — not 403 — outside development, so it does not advertise its own
existence.

### 4.2 Reliability

The system treats an unreachable dependency and an empty result as **different
facts**. This sounds pedantic and was the cause of the project's most
instructive bug (Section 7.1).

**Retry policy**, applied identically to Groq and Tavily:

| Failure | Retried | Reasoning |
|---|---|---|
| `EAI_AGAIN`, `ENOTFOUND`, `ECONNRESET`, … | once | the request never reached the API, so it consumed no quota |
| Timeout | never | it may already be processing; re-sending could double-bill |
| 429 / 5xx | never | the API answered; retrying multiplies usage on a free tier |

Failure causes are logged by code (`fetch failed (EAI_AGAIN)`), because the
wrapper message alone cannot distinguish a momentary blip from a dead network.

### 4.3 Cost and resource constraints

The entire system runs on **free tiers**, which is a genuine engineering
constraint rather than a footnote:

| Service | Limit | Consequence for design |
|---|---|---|
| Groq LLM | 8,000 TPM, 1,000 RPD | context budget divided across sources; explicit output caps; `reasoningEffort: low` |
| Groq Whisper | 20 RPM, 28,800 audio-sec/day | tight upload caps; no blind retries; requests <10s billed as 10s |
| Tavily | free tier | searches batched; entailment adds **zero** extra search calls |
| GitHub | 60 req/hour unauthenticated | incremental sync from a watermark, not full history |

Verification was designed to add **no additional search requests** — it reuses
the excerpts already retrieved for report generation.

### 4.4 Usability and honesty of presentation

This is treated as a non-functional requirement with the same seriousness as
security, because a verification feature that reads as an accusation is worse
than none.

- `UNVERIFIED` renders as **"Not checked"**, with the line *"No commit
  references this task yet"* — a fact about evidence, never about the person.
  Writing documentation, pairing on another branch, or simply forgetting the
  convention all land there legitimately.
- Only `DISPUTED` is coloured red, because only `DISPUTED` means the evidence
  actively contradicts the claim.
- Streaks have **no "broken streak" state**, no previous-best comparison and no
  language about losing progress. A streak survives today being empty, measured
  from the most recent active day, so opening the app in the morning never
  reports a loss before the user has had a chance to work.
- The discovery report is **labelled beta in three places in the UI**, because
  its limitations (Section 9) are real and a user should know.

### 4.5 Maintainability

- **Shared types** (`packages/types`) make client/server payload drift a
  compile error.
- **Pure core logic**: `verification.ts`, `progress.ts`, `scheduler.ts`,
  `streak.ts` and `matcher.ts` have no database or network dependencies, which
  is why they are heavily tested.
- **Single sources of truth**: `summarizeProgress` for all progress figures;
  `assertMember` for all project authorization.
- **A duplicated rule is pinned by test.** The task-reference format exists in
  both the backend matcher and the mobile client. If they diverge, the app
  displays a token the server never looks for and *nothing verifies, silently*.
  A test asserts both implementations agree character-for-character.

---

## 5. The verification design

### 5.1 The problem

Task status is self-reported. A user taps "Done" and milestone progress,
streaks and schedule fit all treat that as fact. On a shared project there is
no way to tell whether assigned work was actually done — and the user can
change any status at any time.

### 5.2 The model

Completion is recorded as a **claim**; evidence is recorded **separately**; the
verdict is **derived from both**.

| Table | Role |
|---|---|
| `Task.status` / `completedAt` | the user's claim — freely editable |
| `TaskEvidence` | append-only record of what was observed, with **why it matched** |
| `TaskVerification` | the derived verdict — **no endpoint writes it** |

A user can change their task status freely. They **cannot** change what the
evidence says about it.

### 5.3 Verdicts

| Verdict | Meaning |
|---|---|
| `VERIFIED` | a commit or PR references this task |
| `UNVERIFIED` | repository linked, nothing found — *not* an accusation |
| `SELF_REPORTED` | no repository linked, so it was never checkable |
| `DISPUTED` | all evidence predates the task |

`SELF_REPORTED` is excluded from the ratio rather than scored 0%, so a project
without GitHub is not reported as failing checks.

### 5.4 Four decisions worth defending

**1. Evidence never auto-completes a task.** A commit can reference work that
is only half finished. When evidence exists on an open task the UI *offers*
"Mark as done" — it does not decide. Letting the evidence close the task would
hand the user's claim to a commit message.

**2. Matching is explicit-reference only.** A commit must contain
`BLISP-<first 8 chars of task id>`. No fuzzy title similarity, no same-day
heuristics, no keyword overlap.

> A test asserts that a commit reading `"implement booking endpoint"` does
> **not** match a task titled *"Implement booking endpoint"*.

This looks like a weakness and is the opposite. A false positive makes every
badge untrustworthy *while looking authoritative*; a miss only yields an honest
`UNVERIFIED`. The asymmetry justifies the stricter rule. **Measured: 74 commits
of a real untagged repository produced 0 false positives.**

**3. Read-only.** The user pushes with git as they normally would. If BLISP
created the commits it would be checking its own output — the evidence has to
come from a tool BLISP does not control. It also makes "what if the token
leaks?" a far easier question: the worst case is that someone read a public
repository.

**4. A 24-hour grace period.** Writing code and then creating the task to track
it is a legitimate order of operations, so evidence slightly predating a task
is not reported as a contradiction.

### 5.5 Measured end-to-end

Against the real database and a real public repository:

```
BEFORE linking : selfReported 2, percentVerified null
linked         : mustafa-asif/blitz | private false | token false
task           : "Add UI tests for add flow" -> BLISP-0208f384
after commit   : VERIFIED   — "1 commit references this task."
unevidenced    : UNVERIFIED — "No commit or pull request references this task."
AFTER          : verified 1, unverified 1, selfReported 2, percentVerified 50
```

All four verdicts behaved correctly in a single run, including
`percentVerified: null` before any repository existed rather than a misleading 0%.

---

## 6. The AI verification experiment

Full detail in [DISCOVERY_REPORT_FINDINGS.md](./DISCOVERY_REPORT_FINDINGS.md).
This is the empirical heart of the project.

### 6.1 The finding

The first implementation produced a confident report with 12 citations. Manual
checking of the cited pages found:

| Claim | Cited page | Does the page say it? |
|---|---|---|
| Todo.txt: "Simplicity, Portability, Open source" | saashub.com | ✅ verbatim |
| Todo.txt: "requires technical ability", "no graphical UI" | saashub.com | ❌ **absent** |
| Microsoft To Do: "no built-in task reordering or priority tags" | apps365.com | ❌ **absent** |
| Todoist: "free version limited", "complex for beginners" | apps365.com | ❌ **absent** |

**A citation is not evidence.** The URLs were real, reachable and topically
relevant. They simply did not contain the claims attributed to them. A reader
checking one or two citations at random would likely have been reassured.

### 6.2 Two interventions

**Entailment verification.** Each cited claim is re-checked against the
retrieved excerpt by an LLM judge returning `SUPPORTED` / `NOT_SUPPORTED` /
`CONTRADICTED`, with the prompt instructed to default to `NOT_SUPPORTED`.
Unsupported claims are withdrawn from the report rather than displayed with a
warning. Adds **zero** extra search calls.

**Evidence-targeted retrieval.** The original queries returned listicles and
tutorials — no product weaknesses existed in the retrieved text to cite, so the
model had nothing to ground a weakness claim in. Adding criticism-shaped
queries (`"Microsoft To Do complaints limitations"`) returned genuine
user-reported limitations.

### 6.3 Results

| Run | Writer model | Retrieval | Checked | Supported | Withdrawn | Fabricated URLs |
|---|---|---|---|---|---|---|
| v4 | nemotron-3-nano 30B | 4 broad | 7 | **0** | 7 | 0 |
| v7 | gpt-oss-120b | 4 broad | 3 | 1 | 2 | 0 |
| **v13** | gpt-oss-120b | **4 broad + 3 criticism** | 4 | **3** | 1 | 0 |

**No fabricated URLs in any run.** The failure mode was never invented sources —
it was real sources cited for claims they did not make. That is the subtler and
more dangerous failure, because it survives spot-checking.

> **Honesty note.** v4 and v13 drew different source sets, as Tavily's index
> shifted between runs. The comparison is therefore not perfectly controlled:
> the retrieval change is the dominant factor but not the only variable. An
> earlier claim in this project's notes that retrieval was deterministic was
> **wrong** and has been corrected.

---

## 7. Engineering failures and what they taught

Recorded because they shaped the design, and because a defence that cannot
name its own failures is not credible.

### 7.1 The one worth presenting: silent degradation

A DNS failure (`EAI_AGAIN`) made Tavily unreachable. `search()` caught the
error and returned `[]`. The report generated with **zero sources** and was
saved as a normal draft — indistinguishable from a properly researched one.

The model behaved correctly: given no sources it produced no comparable
products and an honest `evidenceGaps` section. **The pipeline misrepresented
it.**

The fix distinguishes the two states (`searchWithStatus` returning
`{ results, failed }`) and fails the report if every search failed. The same
bug was later found still present on the **resource-fetching path**, where a
blip left daily-plan tasks with no resources permanently and silently; it now
shares the same retry and reporting policy.

**Lesson:** an empty result and an unreachable dependency must never be the
same value.

### 7.2 Provider-contract failures (Groq)

| Failure | Cause | Fix |
|---|---|---|
| `invalid JSON schema for response_format` | Groq strict mode requires every property in `required`; an `.optional()` field broke it | Split the generation schema from the post-processed type |
| `Request too large… Limit 8000, Requested 10772` | 3 extra searches took 12→21 sources at a flat 1,200 chars each | Divide a fixed context budget among however many sources exist |
| `max completion tokens reached` | No explicit output cap, so the provider clamped it to the remaining rate-limit window | Explicit `maxOutputTokens`, sized above the largest observed report |
| `No output generated` | gpt-oss is a **reasoning** model; hidden reasoning competed with the document for the output budget | `reasoningEffort: 'low'` (measured 1,129 → 359 reasoning tokens, and *more* content) |

The second of these took **four attempts** to size correctly (14,000 → 9,000 →
7,000 → 5,000 chars), measuring against the real schema each time.

### 7.3 State-management failures found on device

Three recording-lifecycle bugs, each reproduced from a user screenshot: a modal
permission prompt requested mid-gesture (losing the first hold every time), no
guard against a concurrent `startRecording` (raising an error over a recording
that was working), and the audio recorder's own prepared state outliving the
app's refs.

Separately, **optimistic task status reverted on every data revalidation** — an
effect keyed on an object that the data layer recreates on each poll, clearing
the optimistic value mid-flight. Marking a task done appeared to work and then
silently undid itself. Pre-existing; found only because verification made the
symptom visible.

### 7.4 Build-cache failure

After a migration, `turbo` reported `FULL TURBO` and served a cached `dist/`
containing a Prisma client without the new column. **Rule adopted:** after any
migration run `db:generate` *then* `pnpm --filter @repo/db build`; a `FULL
TURBO` on that step after a schema change means the bundle is stale.

---

## 8. Trade-offs

Each of these was a real decision with a cost, taken deliberately.

### 8.1 Explicit references over fuzzy matching

| | Explicit (chosen) | Fuzzy |
|---|---|---|
| False positives | none (measured 0/74) | likely |
| User burden | must tag commits | none |
| Failure mode | honest `UNVERIFIED` | silent wrong attribution |

**Chosen because** a false positive corrupts every number in the app while
looking authoritative. Mitigated by showing the copyable reference on the task
itself, and by manual linking marked `MANUAL` so it is visibly weaker evidence.

### 8.2 Read-only GitHub over write access

Gives up: creating issues/branches from tasks. Gains: evidence independent of
the app that reports on it, and a vastly smaller blast radius if a token leaks.

### 8.3 Verification before OAuth

With four days to freeze, OAuth sign-in was dropped in favour of finishing
verification. **Reasoning:** OAuth is plumbing, and shipping it would have left
a login button with no verification story behind it. Public repositories need
no credential at all, so the demo path is unaffected. Consequence: private
repositories require a token, which the system refuses to accept rather than
linking something that would silently never verify.

### 8.4 Free tiers over paid APIs

Gives up: larger context windows, richer excerpts, higher rate limits. Gains:
the project runs at zero cost and is reproducible by any examiner. The 8,000
TPM ceiling is the single largest constraint on report quality (Section 9.3).

### 8.5 Same-model judge over independent judge

An independent judge model is methodologically stronger and was scoped but not
built — NVIDIA NIM requires a non-standard `guided_json` parameter the AI SDK
does not emit. **Stated as a limitation rather than hidden**, because a judge
sharing the writer's blind spots is a real weakness in the claim.

### 8.6 Effort-weighted progress over task counts

Harder to explain to a user; requires effort estimates. Chosen because count-based
progress systematically overstates completion, and the system's honesty
principle applies to its own metrics.

### 8.7 LLM structured output over a rules engine

Gives up: determinism. Gains: handles arbitrary spoken input. The cost is that
every schema change is a provider-contract negotiation (Section 7.2) — four of
the project's hardest bugs came from this trade.

---

## 9. Limitations

Stated plainly. Several are visible in the product itself, which is why the
discovery report is labelled **beta**.

1. **Verification is excerpt-level, not full-page.** Checking uses the
   ~200–1,200 characters the search API returns, not the whole page. A claim
   supported further down a long page is marked unsupported — a **false
   negative**, the safe direction, but the honest wording is *"supported by the
   retrieved excerpt"*, which is stored in each report's `method` field.
2. **The judge is the same model that writes.** See 8.5.
3. **8,000 TPM is tight for a 16-field schema.** At 21 sources each excerpt is
   ~238 characters — enough to cite a specific weakness, thin for nuanced
   claims. A resource constraint, not a design flaw.
4. **Two of v13's three supported claims are unverified by hand.** Independent
   checks were attempted; `pcmag.com` returned 403 and `efficient.app` 429.
   Structural evidence is strong but those two rest on the judge's verdict.
5. **Retrieval is not deterministic**, so run-to-run comparisons are not
   perfectly controlled (Section 6.3).
6. **Completion verification depends on user convention.** Forget the
   `BLISP-` reference and the task reads `UNVERIFIED`. Accepted trade-off (8.1).
7. **Only commits are ingested.** PR and issue evidence kinds exist and are
   tested; only commit ingestion is wired.
8. **No OAuth, no webhooks.** Sync is user-initiated (8.3).
9. **Push notifications not built.** In-app notifications and streaks are done;
   Milestone 5 is partial.
10. **Backend e2e tests are broken** (pre-existing); its CI job is commented
    out. Unit and integration coverage is unaffected — 487 tests pass.
11. **`expo lint` is broken repo-wide** — the mobile app has no ESLint config.
    Pre-existing; mobile correctness is covered by `tsc --noEmit`.
12. **Single-region, single-instance deployment.** No horizontal scaling,
    no CDN, no multi-region story.

---

## 10. Milestone status

| # | Milestone | Priority | Status |
|---|---|---|---|
| 0 | Repository audit | — | ✅ Done |
| 1 | Dashboard | P0 | ✅ Done (pre-existing) |
| 2 | Voice-to-text capture | P0 | ✅ Done — Groq Whisper, device-tested |
| 3 | AI research and report | P0 | ✅ Done — **beta** |
| 4 | Roadmap and task tracker | P0 | ✅ Done |
| 5 | Notifications and streaks | P0 | 🟡 In-app + streaks done; push missing |
| 6 | GitHub integration | P1 | 🟡 Verification built; OAuth not |
| 7 | Project-aware AI assistant | P1 | ⬜ Not started |
| 8 | Collaboration | P1 | ✅ Done |
| 9 | Netlify deployment | P2 | ⬜ Not started |
| 10 | Code editor/compiler | P3 | ⬜ Deferred by design |

**All P0 milestones are complete except push notifications.**

---

## 11. Defence preparation

### 11.1 The one-sentence claim

> BLISP applies a single principle — *a claim is not evidence* — consistently
> to both AI output and human self-reporting, and reports what it cannot verify
> as readily as what it can.

### 11.2 Anticipated questions

**"Isn't this just a to-do app with AI bolted on?"**
The verification layer is the contribution. Measured: 0 of 7 cited AI claims
were actually supported by their sources, raised to 3 of 4 by two named
interventions. The same principle then applies to human completion claims.

**"How do you know the AI isn't just making things up?"**
We measured it. Section 6. No fabricated URLs in any run — the failure mode was
real sources cited for claims they did not make, which is subtler and survives
spot-checking.

**"Could your commit matching credit the wrong work?"**
There is a test asserting that a commit whose message matches a task title
word-for-word does **not** verify it. Matching requires an explicit reference.
Measured 0 false positives across 74 real commits.

**"Why not just trust the user?"**
We do — the user still sets their own status, and we never block or override
it. We additionally report what the evidence shows, including when it shows
nothing.

**"What if the user forgets the reference?"**
The task reads `UNVERIFIED`, phrased as "not checked" rather than "not done".
That is the accepted cost of refusing to guess (8.1).

**"Why is the AI report marked beta?"**
Because of the limitations in Section 9 — excerpt-level checking and a
same-model judge, specifically. Marking it beta is how those limitations reach
the user rather than only the report.

**"What happens when an external API is down?"**
The system distinguishes "we searched and found nothing" from "we could not
reach the service", retries only failures that cost no quota, and never saves a
sourceless report as though it were a real one. That distinction came directly
out of a bug (7.1).

### 11.3 Suggested demonstration order

1. Speak an idea → transcript → project *(capture works)*
2. Show a discovery report's **verification metrics table** *(claims are checked)*
3. Show a **withdrawn** claim *(the system removes what it cannot support)*
4. Roadmap with a deadline that does not fit → two remedies *(honest planning)*
5. Tag a commit → sync → **Verified** *(evidence-based completion)*
6. **Commit the task title without the reference → still Not checked**
   *(it checks, it does not guess)*

Step 6 is the one that distinguishes this from a cosmetic feature.

---

## 12. Future work

1. **Independent judge model** — the strongest single improvement to the
   verification claim (8.5).
2. **Full-page verification** — fetch and check the whole page, not the
   excerpt, removing the false-negative bias.
3. **GitHub OAuth and webhooks** — removes the manual sync and supports
   private repositories properly.
4. **PR and issue evidence** — the data model and parser already exist.
5. **Push notifications** — completes Milestone 5.
6. **Project-aware AI assistant** (Milestone 7) and **web deployment**
   (Milestone 9).
7. **Evidence quality grading** — distinguish a one-line commit from a
   substantial change, so `VERIFIED` carries weight proportional to the work.

---

## Appendix A — Verifying the claims in this report

```bash
# Test suite (expect 487 passing, 28 suites)
pnpm --filter backend test

# Verification rules specifically
pnpm --filter backend exec jest src/github

# Type safety across both apps
pnpm --filter backend exec tsc --noEmit
pnpm --filter mobile exec tsc --noEmit

# Endpoint count
grep -rhoE '@(Get|Post|Patch|Put|Delete)\(' apps/backend/src --include=*.controller.ts | wc -l

# Report verification metrics per version
docker exec blisp-postgres psql -U root -d blisp -c \
  "SELECT version, status, verification FROM research_reports ORDER BY version;"
```

## Appendix B — Document map

| Document | Contents |
|---|---|
| [BLISP_IMPLEMENTATION_PLAN.md](./BLISP_IMPLEMENTATION_PLAN.md) | The specification: milestones, scope, smoke tests |
| [BLISP_PROGRESS.md](./BLISP_PROGRESS.md) | Milestone-by-milestone implementation log |
| [DISCOVERY_REPORT_FINDINGS.md](./DISCOVERY_REPORT_FINDINGS.md) | The AI-verification experiment in full |
| [COLLABORATION_PROGRESS.md](./COLLABORATION_PROGRESS.md) | Multi-user implementation, phase by phase |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | Short product-level overview |
