# blisp — Project Summary

**Agentic productivity app, voice-first by design.** You describe a vague idea; it
researches, plans, and schedules. Built as a final-year project.

Prepared for mid-evaluation, 2026-08-12.

> **Scope note — voice is not yet wired end to end.** Audio *recording* works on
> device, but the upload is still a stub and no transcription service is
> integrated, so the AI pipeline currently runs on **typed** text. Everything
> downstream of the transcript is fully implemented. See §2 and §8.

---

## 1. The problem

Task managers assume you already know what your tasks are. The hard part usually
comes earlier: you have a vague idea ("build a weather app"), and turning it into
something you can start on Monday morning means research, decomposition,
sequencing, and finding the right tutorial. That work is what stops projects
before they begin.

blisp takes the vague idea as a single unstructured dump and does that work for
you.

**Brain dump → research → structured plan → daily schedule.** One dump in, and the
system produces a project with a classified type, a tech stack, ordered tasks with
dependencies, curated resources, and a day-by-day plan.

Voice is the intended input, because the point is to lower the effort of getting a
half-formed idea out of your head. That input path is **partially built**: the app
records audio, but the recording is not yet uploaded or transcribed, so today the
same pipeline is driven by typed text.

---

## 2. What exists today

| | |
|---|---|
| Commits | 57, from 2026-03-14 to 2026-08-11 |
| Code | ~44,700 lines TypeScript |
| Backend tests | **230 passing**, 18 suites |
| REST endpoints | 43 |
| Database | 11 models, 8 enums, 14 migrations |
| Mobile screens | 18 |

Everything below is implemented and running, not planned — with one explicitly
marked exception, the voice input path.

### Voice input — partially implemented

Being clear about this, since it is the headline feature:

| Step | State |
|---|---|
| Microphone permission + audio capture (`expo-audio`) | ✅ Works on device |
| Recording produces a real audio file URI | ✅ Works |
| Upload to the backend | ❌ **Stub** — `uploadAudioBrainDump` logs, waits 1200 ms, returns success. The file is discarded. |
| Speech-to-text | ❌ **Not integrated.** No provider in either app. |
| Backend audio endpoint | ❌ Does not exist. `CreateBrainDumpDto` accepts one field, `prompt: string`. |

So the mic button is real and the recording is real, but the audio goes nowhere.
The pipeline is driven by **typed** text today, and everything from the transcript
onward is complete. Closing the gap needs an upload endpoint, object storage, and
a transcription provider — a well-understood piece of work, not a research risk,
which is why it was scheduled after the parts that were uncertain.

### The AI pipeline

A brain dump is processed through a **BullMQ queue** on Redis rather than in the
request. LLM plus web search can take a minute; holding the HTTP connection open
for that would fail on mobile networks, so the request returns immediately and the
client polls.

The pipeline runs in stages, each recorded as a `ProjectEvent`:

```
RESEARCH_STARTED → RESEARCH_COMPLETED → PLAN_STARTED → PLAN_COMPLETED
  → DAILY_PLAN_STARTED → DAILY_PLAN_COMPLETED
  → RESOURCE_FETCH_STARTED → RESOURCE_FETCH_COMPLETED
```

Persisting stage transitions means a failure is diagnosable after the fact and
the UI can show real progress instead of a spinner. The LLM layer is
provider-agnostic (Vercel AI SDK, running Gemini or GitHub Models), with **Tavily**
for web search so plans cite current sources rather than model recall.

A **cron job** runs hourly to generate daily plans, so a plan is waiting when the
user opens the app rather than being built on demand.

### Collaboration mode

Projects started single-owner. Collaboration was added across 7 phases, the
central problem being that access and ownership were the same thing: every query
filtered on `where: { id, userId }`.

Splitting them was the foundational change. `Project.userId` stays the creator —
brain dumps and pipeline events are inherently per-user — while a
**`ProjectMember`** join table decides who can read and write. All access flows
through one `ProjectAccessService` whose methods throw rather than return null, so
a caller cannot skip a check by ignoring a falsy return.

Built on that: **invites** (share codes and targeted invitations), **task
assignment**, **comments with @mentions**, and **progress aggregation**. Projects
cap at 3 collaborators.

### Notifications

Seven event types flow through NestJS's event emitter, so writes and
notifications stay decoupled — a notification failure cannot lose the write that
caused it:

```
member.joined      task.assigned     task.completed    task.commented
invite.received    invite.declined
```

Notifications are typed (`NotificationType`), carry read state, and one kind is
**actionable**: a project invite carries an `inviteId`, so the row offers Join and
Decline instead of only text. The unread badge lives on the tab bar and is
recomputed inside the same transaction as the write that changes it, so the badge
cannot drift from the underlying count.

### Mobile

Expo + Expo Router, five tabs (Focus, Incubator, Projects, Alerts, Profile),
NativeWind for styling, Clerk for auth. The project roadmap, task detail with
comments, the notification centre, and both invite directions. Audio capture is
wired to the mic button but stops short of upload, as above.

---

## 3. Architecture

```
        ┌──────────────────────── Expo / React Native ────────────────────────┐
        │  Focus   Incubator   Projects   Alerts   Profile                    │
        │  Expo Router · NativeWind · Clerk · Axios                           │
        └──────────────────────────────┬──────────────────────────────────────┘
                                       │  REST  /api/v1
        ┌──────────────────────────────▼──────────────────────────────────────┐
        │                          NestJS backend                             │
        │                                                                     │
        │   brain_dumps ── queue ──► AI pipeline ──► projects · tasks          │
        │                                              │                      │
        │   invites · comments · users ─── events ──────┤                      │
        │                                              ▼                      │
        │   daily_plan (hourly cron)              notifications               │
        │                                                                     │
        │   ProjectAccessService — every read and write passes through it      │
        └───────────┬──────────────────────────────────────┬──────────────────┘
                    │                                      │
            ┌───────▼────────┐                    ┌────────▼────────┐
            │  PostgreSQL 18 │                    │  Redis + BullMQ │
            │  Prisma ORM    │                    │  async pipeline │
            └────────────────┘                    └─────────────────┘

        External:  Clerk (auth) · Gemini / GitHub Models (LLM) · Tavily (search)
```

**Monorepo** (pnpm + Turbo): `apps/backend`, `apps/mobile`, and shared
`packages/db` (Prisma), `packages/types`, plus shared ESLint/TS/Tailwind configs.
Types are shared rather than duplicated, so a backend response shape change
becomes a mobile compile error instead of a runtime surprise.

---

## 4. Engineering decisions worth defending

These are the choices an examiner is most likely to probe.

**Access control in one service, throwing rather than returning.** Scattered
`where: { id, userId }` filters conflated ownership with permission and had to be
remembered at every call site. One service with throwing methods means a missed
check fails loudly instead of silently returning nothing.

**The pipeline is queued, not synchronous.** LLM plus web search takes far longer
than a mobile connection should be held open. The queue also gives retries and
survives a backend restart mid-job.

**Stage transitions are persisted.** `ProjectEvent` rows make a failed pipeline
diagnosable after the fact, and let the UI report real progress.

**Notifications are typed, not string-matched.** The mobile client picks an icon
from a `NotificationType` enum. Before that, kind was only recoverable by matching
literal title text — so a copy edit on the backend would silently change the UI.

**The invite FK is typed, not a generic `entityId` string.** `Notification.inviteId`
is a real foreign key, so revoking an invitation cascades away the notifications
offering it. Verified: revoke dropped the row's notification count 1 → 0, meaning
the recipient's card disappears instead of lingering as a prompt that can no
longer be answered. A string column could not do that.

**Nullable `code` on `ProjectInvite`.** Targeted invites mint no code, so they
create no shareable back door into a project. This relies on Postgres treating
NULLs as distinct under a UNIQUE constraint, which is what lets a nullable `code`
coexist with `@@unique([projectId, invitedUserId])`.

**A declined invite updates its row rather than inserting a second.** Because that
unique constraint means a declined invitation occupies its slot permanently,
re-inviting has to reuse the row — otherwise one decline would block a person
from that project forever.

**The badge is recomputed in the transaction that changes it.** Storing a boolean
alongside the rows it summarises invites drift; recomputing inside the
transaction makes the two impossible to disagree.

---

## 5. A bug worth showing

Found on the last day of work, while building the invite-send UI. It is a good
illustration of a class of bug that unit tests miss.

Sending an invitation checked capacity with `assertHasCapacity`, which counts
**members**. That is correct when someone is joining, but too permissive when
sending, because **a pending invitation is an unfilled claim on a seat**.

With 1 member and 2 free seats, three invitations all returned `201 Created`. Then
the second person to accept got:

```
403  This project already has the maximum of 3 members.
```

The seat cap itself never broke — membership never exceeded 3, so there was no
data corruption. What broke was *who the error landed on*: an **invitee who did
nothing wrong**, for an overbooking the **sender** caused and never saw.

The fix is a second method that counts members plus pending targeted invitations.
Deliberately not a change to the shared one — the two accept paths must keep
counting members only, because a member is being added right then and counting
their own invitation would make every acceptance fail.

Only targeted invites count. A share code has no identifiable recipient and no
limit on who holds it, so counting codes would let one unused code block every
future invitation.

The two exhausted-seat cases also read differently to the sender — a full project
cannot be helped, a seat held by an invitation can be freed — so the message names
the remedy:

```
403  This project's 3 seats are all taken by members or unanswered
     invitations. Withdraw an invitation to free one.
```

Verified live: the same third invitation now 403s, and withdrawing one frees the
seat so it succeeds.

**Why no test caught it.** Every unit test mocks `ProjectAccessService`, so the
mock answered "there is capacity" exactly as asked. The bug was in what the real
method *counts* — invisible to any test that stubs it. It surfaced only by running
the real sequence against the real database. The regression test now asserts the
send path calls the invite-aware check and **not** the old one, because that swap
is the mistake most likely to return.

---

## 6. Testing

**230 backend tests across 18 suites**, on mocked Prisma — fast, no database
required, deterministic in CI.

That choice has a known cost, and the honest version is worth stating: mocking
Prisma cannot catch a mismatch between the code and the actual schema. This bit
twice during development.

- A migration regenerated the Prisma client while the server held the old one in
  memory. `tsc` passed; the endpoint returned `500 Unknown argument 'readAt'`. No
  unit test could see it — the specs mock Prisma entirely.
- Enum *values* resolve at runtime from a built `dist/`, while *types* resolve
  from source. A stale build meant types checked clean and 15 tests failed on
  `undefined`.

Both are now known failure modes with known fixes (rebuild the db package;
restart the server after a migration). The mitigation is that **every slice is
verified live against the running backend** with real tokens, not only unit
tested. The invite work above was checked across 17 scenarios that way.

Mobile has **no test infrastructure** — a real gap. Verification there is
`tsc --noEmit` plus live endpoint checks plus on-device confirmation. Given the
timeline, backend correctness was the higher-value place to spend test effort,
but a mobile harness is the first thing I would add next.

---

## 7. Stack

**Backend** — NestJS 11, TypeScript, PostgreSQL 18, Prisma 6, Redis + BullMQ,
Clerk auth, Vercel AI SDK (Gemini / GitHub Models), Tavily, Zod +
class-validator, Swagger, Jest.

**Mobile** — React Native 0.83, React 19, Expo 55, Expo Router, NativeWind,
TanStack Query, Axios, Clerk Expo.

**Tooling** — pnpm workspaces, Turbo, Docker Compose (Postgres + Redis), ESLint,
Prettier, EAS Build.

---

## 8. Honest status

**Working end to end:** text brain dump → queued AI research → project with
classified type and tech stack → ordered tasks → curated resources → daily plans
(hourly cron). Collaboration: membership, both invite directions, assignment,
comments with mentions, progress, and a typed notification centre with a live
unread badge.

**Known gaps, deliberately not yet built:**

- **Voice input, end to end.** The largest gap, and the one nearest the project's
  stated identity. Recording works; upload is a stub and no speech-to-text
  provider is integrated, so the pipeline runs on typed text. Needs an audio
  endpoint, storage, and a transcription provider. Deferred because it is
  well-understood integration work, while the AI pipeline and the access-control
  rework were the genuinely uncertain parts and were worth de-risking first.
- **Mobile test infrastructure.** No component or integration tests exist for
  `apps/mobile`.
- **Deep link on a cold start while signed out.** `blisp://invite/CODE` hits an
  authenticated endpoint, 401s, and nothing persists the code across the sign-in
  redirect, so the invitation is lost. Diagnosed and documented; predates the
  invite work and is scoped as its own change.
- **Push notifications.** The notification centre is in-app only; the unread
  count polls every 30 seconds rather than being pushed.
- **Real-time collaboration.** No websockets — a second user's change appears on
  refresh, not live.
- **Offline support.** The app assumes connectivity.

---

## 9. Demo path

A suggested five-minute route, in dependency order:

1. **Brain dump** — **type** a project idea; show the queue accepting it and the
   pipeline stages advancing through `ProjectEvent`. Do not demo the mic: it
   records, but the upload is a stub, so nothing would reach the pipeline. If
   voice comes up, say plainly that capture works and transcription is the next
   piece of work.
2. **The generated project** — classification, tech stack, ordered tasks,
   resources.
3. **Daily plan** — what the cron produced.
4. **Collaboration** — invite a second account by email from the members screen;
   on the second device the invitation arrives in Alerts with a live unread badge
   and Join / Decline inline. Accept, and watch them appear in the member list.
5. **Revoke** — send another invitation, withdraw it, and show the recipient's
   card disappearing rather than lingering unanswerable. That is the typed FK
   cascade, and it is the detail most worth pointing at.

> **Before demoing:** the standalone `preview` APK needs no laptop or Metro
> server. Prefer it over the dev client — if the wifi misbehaves, the dev client
> cannot load its JS bundle and the demo stops.
