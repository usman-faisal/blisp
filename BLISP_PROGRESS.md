# BLISP Implementation — Progress

Tracks implementation against [BLISP_IMPLEMENTATION_PLAN.md](./BLISP_IMPLEMENTATION_PLAN.md).
One milestone at a time: implement, smoke-test, commit, then move on.

**Target:** Final submission 20 November 2026 · Feature freeze 17–18 November

| Milestone | Scope | Priority | Status |
|---|---|---|---|
| 0 | Repository audit | — | ✅ Done |
| 1 | Dashboard | P0 | ✅ Done (pre-existing) |
| 2 | Voice-to-text idea capture | P0 | ✅ Done — provider key pending |
| 3 | AI research, report, feature recommendations | P0 | 🟡 Backend done — mobile UI next |
| 4 | Personalized roadmap and task tracker | P0 | ⬜ Not started |
| 5 | Notifications and streaks | P0 | 🟡 Partial — in-app done, push missing |
| 6 | GitHub integration | P1 | ⬜ Not started |
| 7 | Project-aware AI assistant | P1 | ⬜ Not started |
| 8 | Collaboration verification | P1 | ✅ Done (see [COLLABORATION_PROGRESS.md](./COLLABORATION_PROGRESS.md)) |
| 9 | Netlify deployment | P2 | ⬜ Not started |
| 10 | Code editor/compiler | P3 | ⬜ Deferred — do not start |

---

## Milestone 2 — Voice-to-text idea capture ✅

**Date:** 2026-11-10

### What existed before

The mic UI and `expo-audio` recording already worked, but the recording went
nowhere: `uploadAudioBrainDump` in `lib/api/daily-plan.ts` was a `setTimeout`
stub that logged to console and returned fake success. There was no backend
endpoint and no transcript review step.

### Files changed

| File | Change |
|---|---|
| `apps/backend/src/transcription/transcription.provider.ts` | New — `TranscriptionProvider` interface + DI token |
| `apps/backend/src/transcription/providers/xai-transcription.provider.ts` | New — xAI STT call, timeout, status-carrying error |
| `apps/backend/src/transcription/transcription.service.ts` | New — upload validation + provider error mapping |
| `apps/backend/src/transcription/transcription.controller.ts` | New — `POST /api/v1/transcription/audio` |
| `apps/backend/src/transcription/transcription.constants.ts` | New — size caps, allowed formats |
| `apps/backend/src/transcription/dto/transcribe-audio.dto.ts` | New — optional language hint, pattern-constrained |
| `apps/backend/src/transcription/__tests__/transcription.service.spec.ts` | New — 19 unit tests |
| `apps/backend/src/app.module.ts` | Registered `TranscriptionModule` |
| `apps/backend/.env.example` | Added `XAI_API_KEY`, `XAI_STT_MODEL`, base URL, timeout |
| `apps/mobile/src/lib/api/transcription.ts` | New — real multipart upload, retryable error classification |
| `apps/mobile/src/components/TranscriptReviewSheet.tsx` | New — editable transcript sheet |
| `apps/mobile/src/app/(tabs)/index.tsx` | Wired record → upload → review → existing brain-dump flow |
| `apps/mobile/src/components/FloatingInput.tsx` | Elapsed timer, cancel button, `onPressIn` fix |
| `apps/mobile/src/lib/api/daily-plan.ts` | **Deleted** the mock upload |

No new dependencies (`multer` and `expo-audio` were already present).
**No database migration** — the confirmed transcript flows into the existing
`POST /brain-dumps`, which already stores it as `BrainDump.rawTranscript`.

### Design decisions

**Transcription does not create a brain dump.** The endpoint returns text only;
the user edits it and submits through the existing flow. A bad transcription
therefore never creates a project, and "exactly once" submission stays under the
user's control.

**Provider abstraction.** `TranscriptionProvider` is bound in one place
(`transcription.module.ts`), so switching vendor means adding a class under
`providers/` rather than touching the UI.

**Audio is never persisted.** `memoryStorage()` keeps uploads out of the
filesystem entirely — nothing to clean up, no retention policy needed.

**Secrets stay server-side.** `XAI_API_KEY` is read only by the backend. Verified
no xAI or key reference appears anywhere in `apps/mobile/src/`.

### Provider facts (verified against docs.x.ai on 2026-11-10)

- Model `grok-voice-transcribe-2.0`, `POST https://api.x.ai/v1/stt`
- Multipart fields: `model`, `file`, `language`, `format`
- Response: `{ text, language, duration, words[] }`
- Provider max 500 MB; **we cap at 10 MB** to bound memory and cost
- **Billed per hour of audio for REST and streaming. No documented free tier.**

### Verified results

| Check | Result |
|---|---|
| Backend tests | 249/249 pass, 19 suites (19 new) |
| Backend typecheck / build | Clean |
| Backend lint (new files) | Clean |
| Mobile typecheck | Clean |
| Unauthenticated POST | 401 |
| No file / unsupported / too-short / 11 MB | 400 / 415 / 400 / 413, readable messages |
| Provider unconfigured | 503, app still boots |
| `octet-stream` + `.m4a` extension | Accepted |
| Secrets in mobile source | None found |
| Audio written to disk | None — memory only |

### Bug found and fixed

The mic button used `onPress`, which fires on *release*. On a tap React Native
emits `onPressOut` first, so stop ran while `isRecording` was still false and
bailed, then start left a recording running indefinitely. Switched to
`onPressIn` for true press-and-hold. Elapsed time now comes from a wall-clock
ref rather than the 1 s interval counter, which was too coarse to judge a tap.

### Outstanding

1. **`XAI_API_KEY` is not set** — no payment card available yet. Until then
   `POST /transcription/audio` returns 503 with a clear message and the rest of
   the app is unaffected. No real transcription has been performed; none was
   faked. Add the key to `apps/backend/.env` to complete the smoke test.
2. **Not yet tested on a physical device end-to-end.** Record → review → submit
   needs a real device once the key is in place.
3. **`expo lint` is broken repo-wide** — the mobile app has no ESLint config or
   dependency, so it tries to install `eslint-config-expo` and fails.
   Pre-existing and unrelated to this milestone.

---

## Milestone 3 — AI research, report and feature recommendations 🟡

**Date:** 2026-11-10 · **Backend complete and smoke-tested. Mobile UI outstanding.**

### What existed before

A research stage already ran inside the brain-dump pipeline, but it was an
*implementation planner*, not a discovery agent:

- `INCUBATOR_RESEARCH_PROMPT` asked only for "best practices, documentation
  links, architectural patterns" — no competitors, no feature comparison, no
  gaps, no MVP scoping, no citations.
- The `researchSummary` it produced was passed job→job via `job.updateData` and
  then **discarded**. Nothing reached Postgres, so "saved and can be reopened"
  was impossible.
- Output was unstructured text from `generateText`, with Tavily's source URLs
  dropped at the summarisation step.

11 of the plan's 13 required report sections had nowhere to come from.

### Design decisions

**On-demand, not automatic.** The fast research pass still feeds task planning
untouched. The deep report is an explicit action, which keeps the brain-dump
flow fast and bounds Tavily/LLM spend.

**Versioned, never mutated.** Regenerating inserts `version + 1`. An APPROVED
report cannot be destroyed by a regeneration — verified live.

**Guardrails in the schema, not just the prompt.** `recommendedFeatures`,
`differentiators` and `mvpScope.mustHave` are `.min(1)`. A model that answers
"similar products exist, don't build this" **fails validation** rather than
discouraging the user. This is the product's core stance made structural.

**Citations validated, not trusted.** Every VERIFIED claim's `sourceUrl` is
checked against the URLs Tavily actually returned. Unverifiable ones are
demoted to ANALYSIS and the link removed. A fabricated source shown as evidence
is the worst thing this feature could do, and a prompt alone cannot prevent it.

### Files changed

| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | New `ResearchReport` model + `ResearchReportStatus` enum; 3 new `PipelineStage` values |
| `packages/db/prisma/migrations/20261110142907_add_research_reports/` | Migration — additive only, no drops |
| `apps/backend/src/research/research.schema.ts` | New — Zod schema for the 13 sections, evidence tagging |
| `apps/backend/src/research/research.prompt.ts` | New — system prompt, prompt builder, 4 search queries |
| `apps/backend/src/research/research.service.ts` | New — orchestration, versioning, citation validation |
| `apps/backend/src/research/research.controller.ts` | New — 5 endpoints under `/projects/:id/research-report` |
| `apps/backend/src/research/research.module.ts` | New |
| `apps/backend/src/research/__tests__/research.service.spec.ts` | New — 26 tests |
| `apps/backend/src/brain_dumps/brain-dumps.processor.ts` | Added `DISCOVERY_REPORT` handler; **typed all four job payloads** (were `Job<any>`) |
| `apps/backend/src/ai/ai.service.ts` | Added `modelId` getter; narrowed the Tavily response type |
| `apps/backend/src/common/lib/constants.ts` | Added `JOBS.DISCOVERY_REPORT` |
| `apps/backend/src/brain_dumps/brain-dumps.module.ts`, `app.module.ts` | Wiring |

No new dependencies.

### API

| Method | Route | Purpose |
|---|---|---|
| POST | `/projects/:projectId/research-report` | Queue a new version (409 if one is in flight) |
| GET | `/projects/:projectId/research-report` | Latest version |
| GET | `/projects/:projectId/research-report/versions` | Version list, metadata only |
| GET | `/projects/:projectId/research-report/:version` | One version |
| POST | `/projects/:projectId/research-report/:version/approve` | Approve; demotes any prior approval |

Every handler goes through `ProjectAccessService.assertMember`.

### Verified results

Smoke-tested live against the real Gemini/OpenRouter provider and Tavily.

| Check | Result |
|---|---|
| Backend tests | **275/275 pass**, 20 suites (26 new) |
| Typecheck / build / lint (changed files) | Clean — 0 problems |
| Unauthenticated POST | 401 |
| Non-member project | 404 |
| Report generated end-to-end | v1 DRAFT in ~102s, 6 sources |
| **Idea not rejected** | Todo app — the most saturated category — found **15 comparable products** yet still produced 8 recommended features, 2 differentiators, 5-item MVP |
| **No invented citations** | 0 claims cited a URL outside the retrieved set; product citations all resolved to real retrieved URLs |
| Evidence honesty | `evidenceGaps` candidly listed what the search did not cover |
| Duplicate request while PENDING | 409, no duplicate spend |
| **Regeneration preserves approval** | v1 stayed APPROVED with sections and 6 sources intact while v2 generated |
| Nonexistent version | 404 |
| Pipeline events | `DISCOVERY_REPORT_STARTED` → `COMPLETED` recorded for both runs |
| **Brain-dump regression** | Existing flow still completes `RESEARCH → PLAN` after the job-typing refactor |

### Lint debt cleared along the way

The changed-files CI gate flagged 48 pre-existing `no-unsafe-*` problems in the
two files this milestone touched (`ai.service.ts` 10, `brain-dumps.processor.ts`
38). Fixed properly by typing the four BullMQ job payloads and narrowing the
Tavily response, rather than suppressing: **48 → 0**.

### Outstanding — mobile UI

The backend is complete; **no mobile work has been done**. Still needed:

1. **Report screen** — render the 13 sections with an executive summary first
   and the detail sections collapsible, per the plan's "do not overwhelm a
   beginner" rule.
2. **Evidence badges** — visually distinguish `VERIFIED` / `ANALYSIS` /
   `RECOMMENDATION`, and make source URLs tappable.
3. **Generate action** on the project detail screen, with the PENDING state
   driven by the existing pipeline-event polling (`useProjectPipeline`).
4. **Version switcher** and an Approve action.
5. **States**: pending (~60–100s, so progress matters), failed-with-retry,
   and no-report-yet.
6. `@repo/types` response types — the controller currently returns inline
   shapes rather than typed `ApiResponse<T>` envelopes like the other modules.

Generation takes 60–100 seconds, so the UI must not block on the POST: it
returns a PENDING row and the screen polls.

---

## Continuous integration

**Workflow:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — runs on every
PR into `main` and on direct pushes to `main`.

| Job | Steps | Status |
|---|---|---|
| `backend` | Prisma generate → typecheck → lint changed files → 249 unit tests → build | ✅ Passing |
| `mobile` | Prisma generate → `tsc --noEmit` | ✅ Passing |

Every step was run locally against this commit before the workflow was committed.

### Deliberate omissions and why

**Backend e2e is not in the gate.** `apps/backend/test/app.e2e-spec.ts` is broken
in two independent ways:

1. `test/jest-e2e.json` has no `moduleNameMapper`, so `src/*` imports fail to
   resolve and the suite dies before any test runs. The unit config in
   `package.json` has the mapping; e2e needs `{"^src/(.*)$": "<rootDir>/../src/$1"}`.
2. The spec boots the entire `AppModule`, which opens BullMQ/Redis and Prisma
   connections and hangs without them. It also asserts `GET /` returns
   `Hello World!`, but `main.ts` sets a global `api/v1` prefix, so that
   assertion is likely wrong too.

A commented-out `e2e` job sits at the bottom of the workflow with Postgres and
Redis service containers already configured to match `docker-compose.yaml`.
Uncomment it once the two issues above are fixed.

**Lint covers changed files only, not the whole repo.** A repo-wide
`eslint src/**/*.ts` currently reports **~710 problems** — 450 real (mostly
`@typescript-eslint/no-unsafe-member-access` on `any` in older modules) plus
formatting drift in 56 files. The `lint` package script passes `--fix`, which
auto-repaired all of this locally so it was never visible. Gating on the full
set would make CI permanently red and train everyone to ignore it.

To widen later: run `pnpm --filter backend lint` for the auto-fixable portion,
resolve the unsafe-`any` findings by hand, then replace the changed-files step
with a plain repo-wide `eslint` call.

**Mobile lint is not run.** The mobile workspace has no ESLint config and no
`eslint-config-expo` dependency, so `expo lint` tries to install one at runtime
and fails. Needs the config and dependency added before it can be a CI step.

---

## Local development notes

### Commands (corrected)

`CLAUDE.md` documents several of these with the filter in the wrong position.
`--filter` must come *before* the script name, or pnpm looks for the script in
the repo root and fails with `ERR_PNPM_NO_SCRIPT_OR_SERVER`.

```bash
docker compose up -d                   # Postgres + Redis
pnpm turbo run db:generate             # Prisma client
pnpm turbo run db:migrate              # migrations
pnpm --filter backend dev              # backend on :8080
pnpm --filter mobile start --clear     # Metro on :8081
```

### 401 "Invalid token" after signing up locally

**Symptom:** every authenticated request returns
`{"statusCode":401,"message":"Invalid token"}`, while the backend terminal shows
`HttpException: User not found` from `ClerkStrategy.validate`.

**Cause:** user rows are created by the Clerk webhook, but Clerk's servers cannot
reach a machine on a private network, so signing up locally never inserts the
row. The token verifies; the subsequent `getUser` lookup 404s, and the strategy
reports that as a generic 401.

**Fix:**

```bash
pnpm --filter backend sync:users
```

No backend restart needed — the strategy queries Postgres per request. Just
reload the app. Re-run this after every local sign-up.

### Stale `dist/main` holding port 8080

If `pnpm --filter backend dev` fails with `EADDRINUSE` on 8080, a detached
`node dist/main` from an earlier `nest build` may still own the port:

```bash
ss -ltnp | grep ':8080'   # find the pid
fuser -k 8080/tcp         # free it
```
