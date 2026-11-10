# BLISP Implementation — Progress

Tracks implementation against [BLISP_IMPLEMENTATION_PLAN.md](./BLISP_IMPLEMENTATION_PLAN.md).
One milestone at a time: implement, smoke-test, commit, then move on.

**Target:** Final submission 20 November 2026 · Feature freeze 17–18 November

| Milestone | Scope | Priority | Status |
|---|---|---|---|
| 0 | Repository audit | — | ✅ Done |
| 1 | Dashboard | P0 | ✅ Done (pre-existing) |
| 2 | Voice-to-text idea capture | P0 | ✅ Done — provider key pending |
| 3 | AI research, report, feature recommendations | P0 | ⬜ Next |
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
