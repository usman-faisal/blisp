# Collaboration Mode — Progress

Tracks implementation against [COLLABORATION_PLAN.md](./COLLABORATION_PLAN.md).
One phase at a time: implement, test, commit, then move on.

| Phase | Scope | Status |
|---|---|---|
| 1 | Schema + access primitive | ✅ Done |
| 2 | Swap ownership → membership | ✅ Done |
| 3 | Invites | ✅ Done |
| 4 | Assignment + progress | ✅ Done |
| 5 | Notifications | ✅ Done |
| 6 | Task comments | ✅ Done |
| 7 | Mobile | ✅ Done — all 3 slices |

---

## Phase 1 — Schema and access primitive ✅

**Date:** 2026-07-31

### Files changed

| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | Added `ProjectRole` enum, `ProjectMember`, `ProjectInvite`; relations on `User` and `Project` |
| `packages/db/prisma/migrations/20260731090036_add_project_collaboration/` | Migration + owner backfill |
| `apps/backend/src/projects/project-access.service.ts` | New — the access primitive |
| `apps/backend/src/projects/__tests__/project-access.service.spec.ts` | New — 14 unit tests |
| `apps/backend/src/projects/projects.module.ts` | Registered and exported `ProjectAccessService` |
| `apps/backend/package.json` | Added Jest `moduleNameMapper` for `src/*` imports |

### The access primitive

`ProjectAccessService` replaces the `where: { id, userId }` pattern. Every method
throws instead of returning null, so a caller cannot skip a check by ignoring a
falsy return.

| Method | Behaviour |
|---|---|
| `assertMember` | Throws `NotFound` unless the user is a member; returns the row |
| `assertOwner` | Throws `Forbidden` when the member is not `OWNER` |
| `memberProjectIds` | Ids for scoping list queries |
| `isMember` | Boolean, non-throwing, for conditional data |
| `assertHasCapacity` | Throws when the project already has `MAX_MEMBERS` (3) |

A deliberate choice worth keeping: `assertMember` throws **NotFound, not
Forbidden**, for non-members. Returning 403 would confirm to a stranger that a
project id exists — an enumeration leak. `assertOwner` does use `Forbidden`,
because a member already knows the project exists.

### Backfill verification

The riskiest step in the whole plan: without an `OWNER` row per existing project,
creators lose access the moment Phase 2 lands. The `INSERT` lives inside the
migration file so it cannot be skipped.

Verified against real data — 2 probe projects were seeded first so the backfill
ran against a non-empty table, then removed:

```
projects | owner_rows | projects_without_owner
       5 |          5 |                      0

mismatched owner user_id vs project.user_id: 0
```

Cascade delete also confirmed: removing a project removes its member rows.

### Tests

```
pnpm --filter backend exec jest src/projects
# 14 passed, 14 total
```

Covers both roles, the non-member rejection, the NotFound-not-Forbidden
guarantee, empty-array scoping (must scope to nothing, never everything), and
capacity at *and over* the cap.

### Incidental fix

The backend test suite could not run at all before this phase — every spec
failed to resolve its `src/`-prefixed imports, so all 5 suites errored on load.
Added `moduleNameMapper` to the Jest config to fix it.

That exposed **2 pre-existing broken specs**, unrelated to this work and left
as-is:

- `ai/ai.service.spec.ts` — does not provide `ConfigService`
- `brain_dumps/brain-dumps.controller.spec.ts` — does not provide `PrismaService`

Both are incomplete test setup in specs that predate this feature. Worth fixing
separately.

### Verification

- `pnpm exec tsc --noEmit` → exit 0
- `pnpm exec jest src/projects` → 14/14 pass
- Migration applied and backfill verified against the dev database

### Not in this phase

`Task.assigneeId` and `TaskComment` are deliberately deferred to Phases 4 and 6.
Adding columns before the code that uses them makes the migration harder to
review and the rollback harder to reason about.

---

## Phase 2 — Ownership → membership ✅

**Date:** 2026-07-31

The critical path. Every `where: { id, userId }` filter replaced with an explicit
membership check.

### Call sites changed

Found by grepping every `userId`-scoped project/task query, so nothing was
missed:

| File | Method | Check |
|---|---|---|
| `projects.service.ts` | `activateProject` | `assertMember` |
| | `archiveProject` | **`assertOwner`** |
| | `updateProject` | `assertMember` |
| | `getProjectById` | `assertMember` |
| | `getProjects` | `memberProjectIds` scope |
| | `getProjectStats` | `memberProjectIds` scope |
| `tasks.service.ts` | `getTaskById` | `assertMember` on `task.projectId` |
| | `updateTaskStatus` | `assertMember` on `task.projectId` |
| `pipeline-events.service.ts` | `getProjectPipeline` | `isMember` |

Task methods now resolve the task by id first, then authorise against its parent
project — the id alone reveals nothing until membership is confirmed.

`getProjectPipeline` uses `isMember` rather than `assertMember` because it
returns a soft `{ success: false }` response instead of throwing. Preserving
that contract avoids changing the API shape mid-refactor.

### Deliberately unchanged

- **`brain_dumps`** — including `brain-dumps.processor.ts:136`. Transcripts stay
  private to their author; widening this would leak raw voice data.
- **`daily-plan.service.ts`** — still scoped by `userId`. Widening it to
  membership *without* an assignee filter would give all three members identical
  plans full of each other's tasks. `Task.assigneeId` does not exist until
  Phase 4, so this correctly waits for it. **Phase 4 must not forget this.**

### Module wiring

`ProjectAccessService` is provided directly in `TasksModule` and
`PipelineEventsModule` rather than by importing `ProjectsModule`. That module
imports `DailyPlanModule`, and `PipelineEventsModule` is `@Global()` — importing
it would risk a dependency cycle. The service only needs `PrismaService`, so
direct provision is both safer and cheaper.

### Tests

```
pnpm --filter backend exec jest src/projects src/tasks
# 3 suites, 32 passed
```

18 new tests across two suites. The ones that matter most:

- A member can read and edit a project they did **not** create
- `archiveProject` rejects a non-owner member with `Forbidden`
- The lookup `where` clause no longer contains `userId` / `project` — asserted
  directly, so a reintroduced filter fails the suite
- No read or write happens when the access check throws
- Empty membership scopes list queries to nothing, never everything

### Verification

- `pnpm exec tsc --noEmit` → exit 0
- `pnpm exec nest build` → exit 0
- Booted the built app: all 20 modules initialised, no unresolved dependencies
  and no cycles (only `EADDRINUSE`, since the dev server holds port 8080 — which
  itself confirms Nest reached `listen()` with the full graph resolved)

---

## Phase 3 — Invites ✅

**Date:** 2026-07-31

### Endpoints

| Route | Guard | Behaviour |
|---|---|---|
| `POST /projects/:id/invites` | member | 8-char code, 7-day expiry, `blisp://` deep link |
| `GET /invites/:code` | authed | Preview: title, member count, inviter. Does not join |
| `POST /invites/:code/accept` | authed | Joins as MEMBER; enforces the 3-member cap |
| `GET /projects/:id/members` | member | Owner first, `isSelf` flag for the requester |
| `DELETE /projects/:id/members/:userId` | **owner** | Cannot remove self |

Any member can invite — the cap limits growth, not the role. Removal is
owner-only.

### Security decisions

**Codes from `crypto.randomBytes`,** never `Math.random`, which is predictable
enough to guess. Rejection sampling keeps the distribution uniform; `byte %
length` alone would bias toward the front of the alphabet.

**Alphabet excludes O/0, I/1 and L.** Codes get read aloud and typed by hand,
so losing the confusable characters is worth more than the extra entropy.
31^8 ≈ 8.5 × 10^11 combinations remain.

**Accept runs in one transaction.** The capacity count and the membership insert
are atomic, and the invite is claimed with a conditional
`updateMany({ where: { id, usedAt: null } })`. If two users accept the same
single-use code simultaneously, exactly one sees `count === 1` and wins; the
other gets 410. Checking capacity outside the transaction would let a race seat
a fourth member.

**Distinct errors.** 404 unknown code, 410 expired, 410 already-used — each with
its own message, so the UI can explain what happened rather than showing a
generic failure. Re-accepting an invite you already hold is a **no-op success**,
because a double-tap should not read as an error.

**The owner cannot remove themselves,** which would strand the project with
nobody able to manage it.

### Tests

```
pnpm --filter backend exec jest src/invites
# 23 passed
```

`$transaction` is mocked to run its callback against the same mocks, so the
transaction body is genuinely exercised — including the concurrent-claim path
where `updateMany` returns `count: 0`.

### End-to-end verification

Unit tests with a mocked Prisma cannot prove the transaction or the unique
constraint work, so the whole flow was run against the live server and database
with three real Clerk users:

| Step | Result |
|---|---|
| Owner creates invite | `TJH5Z3TG`, 7-day expiry ✅ |
| Joiner previews with a **lowercase** code | Normalised, resolved ✅ |
| Joiner accepts | Joined as MEMBER ✅ |
| **Joiner's project list** | **0 → 1, with all 5 tasks** ✅ |
| Joiner reads project detail | Full access ✅ |
| Members list | Owner + member, `isSelf` correct ✅ |
| Re-accept as same user | No-op success ✅ |
| Third user tries used code | 410 ✅ |
| Unknown code | 404 ✅ |
| Member invites 3rd user | Allowed, joined ✅ |
| 4th invite when full | 403 ✅ |
| Member tries to remove someone | 403 ✅ |
| Owner removes self | 403 ✅ |
| Owner removes member | Success; target drops to 0 projects ✅ |

That fourth row is the one that matters: it proves Phases 2 and 3 work together
— membership-based access actually grants a non-creator visibility of a shared
project.

### Test data left behind

`test@gmail.com` remains a MEMBER of "User Interaction Initialization", giving a
real 2-member shared project to develop the mobile UI against. Spent invite rows
were deleted.

---

## Phase 4 — Assignment and progress ✅

**Date:** 2026-08-01

### Schema

`Task.assigneeId` (nullable, FK to `User`, `onDelete: SetNull`) plus an
`assigneeName` snapshot and an index on `assigneeId`. Null means unclaimed.

The snapshot follows the same reasoning as the invite name columns: a task row
reads on its own in Studio, logs and SQL, while the relation gives the current
name for API responses.

Migration: `20260801…_add_task_assignee`.

### Endpoints

| Route | Behaviour |
|---|---|
| `PATCH /tasks/:id/assign` | Assign to a member, or `assigneeId: null` to unassign |
| `GET /projects/:id/progress` | Overall + per-member + unassigned counts |

Any member may reassign any task. At 2–3 people, restricting reassignment to the
current assignee adds friction without preventing anything.

**The assignee must be a member of that task's project.** Without this check a
task could be assigned to any user id, including someone with no access to the
project — returns 400 with a message naming the fix.

Progress aggregates with two `groupBy` queries rather than loading tasks into
memory: it runs on every roadmap view and a project can hold hundreds of tasks.
`percentComplete` guards the divide, so an empty project is 0% rather than NaN.

### The daily-plan trap, resolved

Phase 2 deliberately left `daily-plan.service.ts` scoped by `userId`. Widening it
to membership alone would have given all three members an identical plan
containing each other's tasks.

Both the rollover and backlog queries now share one predicate:

```ts
project: { status: ACTIVE, members: { some: { userId } } },
OR: [
  { assigneeId: userId },                      // my work
  { assigneeId: null, project: { userId } },   // unclaimed, on a project I created
]
```

A task is mine when I am the assignee, or when nobody has claimed it and I
created the project. Unassigned work stays with the creator instead of being
duplicated across the team.

### Member removal

Removing a member now unassigns their tasks in the same transaction, returning
the work to the shared backlog. The FK's `SetNull` only fires when the *user* is
deleted — losing project membership does not touch it, so an explicit sweep was
needed.

### Tests

```
pnpm --filter backend exec jest src/tasks src/projects src/invites src/daily_plan
# 7 suites, 75 passed
```

17 new tests. The ones worth knowing: assignment to a non-member is rejected,
unassign needs no membership lookup, an empty project reports 0% not NaN, a
member with no tasks still appears with zeroes, and four tests pin the daily-plan
predicate so the duplication trap cannot silently return.

### End-to-end verification

| Step | Result |
|---|---|
| Progress before assignment | 5 tasks, all unassigned, both members at zero ✅ |
| Owner assigns to member | `assigneeName: "test user"` ✅ |
| Member assigns to themselves | Allowed ✅ |
| Assign to a non-member | 400, names the fix ✅ |
| Progress after | member `assigned=2`, `unassigned` 5→3 ✅ |
| DB row without a join | `assignee_name` readable ✅ |
| Owner removes member holding 2 tasks | Both returned to backlog, 0 orphaned ✅ |

---

## Phase 5 — Notifications ✅

**Date:** 2026-08-01

No schema change — the `Notification` model already existed.

### Events

| Event | Recipients | Trigger |
|---|---|---|
| `collaboration.member.joined` | Existing members, minus the joiner | Invite accepted |
| `collaboration.task.assigned` | The assignee only | `PATCH /tasks/:id/assign` |
| `collaboration.task.completed` | Other members, minus the actor | Status → `DONE` |

Nobody is notified about their own action. Self-assignment and unassignment
notify nobody at all.

Only `DONE` emits a completion event: notifying on every `TODO`/`IN_PROGRESS`
transition would make the list useless.

### Why a listener rather than inline writes

Events are emitted **after** the triggering transaction commits, and every
handler swallows its own errors after logging. A notification insert failing
must never roll back the join, assignment or status change that caused it.

`EventEmitterModule` was already registered in `app.module.ts` but unused —
`brain_dumps/events/brain-dump-created.event.ts` existed as an empty class with
no emitter. This is the first real use.

Registering `CollaborationNotificationsListener` as a provider is enough for
`@OnEvent` to bind; the emitting services import only the event classes, so they
stay decoupled from the notification logic.

### The badge flag

`notify()` writes the rows **and** sets `User.hasNotifications` in one
transaction. `NotificationsService.clearAllNotifications` resets it. Writing
rows without the flag would leave the unread badge dark — a test pins this.

### Tests

```
pnpm --filter backend exec jest
# 12 suites, 89 passed, 2 pre-existing failures
```

11 new tests. Notable: the joiner is excluded from their own join notification,
self-assignment is silent, a solo project writes nothing, and the listener
resolves rather than throws when the database is down.

Adding `EventEmitter2` to two constructors broke four existing specs, which had
to gain the provider and a `user` mock — the suite caught each one.

### End-to-end verification

Ran live against the server with three Clerk users:

| Action | Notification |
|---|---|
| Owner assigns a task to a member | Member: *"mustafawarind03 assigned you …"* ✅ |
| Member marks it DONE | Owner: *"test user completed …"* ✅ |
| Third user joins | **Both** existing members notified; joiner not ✅ |
| `hasNotifications` | `t` for the two recipients, `f` for the joiner ✅ |

Names appear throughout — no raw Clerk ids in any message.

### Still failing (pre-existing, unrelated)

`ai/ai.service.spec.ts` and `brain_dumps/brain-dumps.controller.spec.ts` do not
provide their dependencies. Broken before Phase 1 and untouched since.

---

## Phase 6 — Task comments with @mentions ✅

**Date:** 2026-08-01

### Schema

`TaskComment` — `taskId`, `authorId`, `authorName` snapshot, `body`, timestamps,
indexed on `[taskId, createdAt]`. Cascade delete from both task and author.

Migration: `20260801070503_add_task_comments`.

### Routes

| Route | Guard |
|---|---|
| `GET /tasks/:id/comments` | member |
| `POST /tasks/:id/comments` | member |
| `PATCH /comments/:id` | **author only** |
| `DELETE /comments/:id` | author, or project owner moderating |

Edit is author-only even for the owner — rewriting someone else's words is never
acceptable. Delete is broader, since the owner needs to be able to moderate.

### Notification rules

Per the requested behaviour:

- **The project owner is notified of every comment** on their project.
- **Anyone @mentioned is notified individually**, with a different message
  ("mentioned you" vs "commented").
- A **mentioned owner receives only the mention** — being told twice about one
  comment reads as a bug.
- The author is never notified about their own comment, and a self-mention is
  ignored.
- **Editing emits nothing.** Re-notifying whenever a typo is fixed would make
  mentions a nuisance.

### Mention parsing

`@name` is resolved server-side against the project's member names.

Member names contain spaces ("test user"), so a `@\w+` regex would only ever
catch the first word. Instead each known name is matched directly, **longest
first**, with consumed spans tracked so a shorter name cannot re-match inside a
longer one. With members "test" and "test user", `@test user` resolves to the
latter — a dedicated test pins this.

Also handled: case-insensitivity, duplicate suppression, a required word
boundary (so `@test users` does not match "test user"), regex metacharacters in
names, and bodies with no `@` at all (early return).

### Tests

```
pnpm --filter backend exec jest
# 14 suites, 124 passed, 2 pre-existing failures
```

35 new tests — 16 for the parser alone, since that is where the edge cases live.

### End-to-end verification

| Scenario | Result |
|---|---|
| Member comments, no mention | Owner notified ✅ |
| Owner mentions `@test user` | Only that member notified; owner silent (wrote it) ✅ |
| Member mentions the owner | **Exactly one** row, titled "You were mentioned" ✅ |
| List comments | `isOwn` and resolved mentions correct ✅ |
| Owner edits member's comment | 403 ✅ |
| Owner deletes member's comment | Allowed (moderation) ✅ |
| Non-member reads or posts | 404 both ✅ |

### Bug found during testing

A whitespace-only body (`"   "`) was accepted and stored as a blank comment:
`@IsNotEmpty()` only rejects `''`. Fixed with a `@Transform` that trims before
validation, on both DTOs. Now returns 400. The 2000-character cap was already
working.

---

## Phase 7 — Mobile

Split into three slices, each testable on a device before the next starts.

| Slice | Scope | Status |
|---|---|---|
| 1 | Members + invites | ✅ Done |
| 2 | Assignment + progress | ✅ Done |
| 3 | Comment thread | ✅ Done |

### Slice 1 — Members and invites ✅

**Date:** 2026-08-01

| File | Purpose |
|---|---|
| `src/lib/api/collaboration.ts` | The five collaboration endpoints |
| `src/hooks/useProjectMembers.ts` | Member roster |
| `src/components/ui/MemberAvatar.tsx` | Initials avatar + overlapping stack |
| `src/app/project/members.tsx` | Roster, invite, remove |
| `src/app/invite/[code].tsx` | Preview then join — handles `blisp://invite/CODE` |
| `src/app/invite/index.tsx` | Manual code entry |

Entry points: an avatar stack in the project detail header opens the member
list; a "Join" button on the projects tab opens code entry.

**Followed the existing hook pattern** (`useState`/`useEffect`) rather than
React Query, even though it is installed and its provider is mounted. Adding a
second data-fetching convention mid-feature would leave two in the codebase.
Worth unifying, but as its own change.

**Route naming:** `project/[id]/members.tsx` would collide with the existing
`project/[id].tsx` — Expo Router cannot have both a file and a directory for one
route. The screen is `/project/members?projectId=…` instead.

A new `MemberAvatar` was needed because the existing `Avatar` takes a URI, and
Clerk users here have no profile images. Colour is hashed from the name, so a
member keeps the same colour everywhere.

The client mirrors the backend's rules rather than relying on rejection: the
remove control only renders for the owner, and the invite button disables at
`MAX_MEMBERS`.

### Slice 2 — Assignment and progress ✅

**Date:** 2026-08-01

| File | Purpose |
|---|---|
| `packages/types/src/index.ts` | `assigneeId`/`assigneeName` on `ProjectTaskResponse` |
| `apps/backend/.../projects.service.ts` | Select and return them in `getProjectById` |
| `apps/backend/.../__tests__/projects.service.detail.spec.ts` | 3 specs for the above |
| `src/lib/api/collaboration.ts` | `getProjectProgress`, `assignTask` |
| `src/hooks/useProjectProgress.ts` | Progress fetch |
| `src/components/ui/AssigneePicker.tsx` | Bottom-sheet member picker |
| `src/components/ui/ProjectProgressPanel.tsx` | Per-member breakdown |
| `src/app/task/[id].tsx` | Assignee row + assign/claim |
| `src/app/project/[id].tsx` | Assignee per task row, progress panel, refetch |

**Backend change was required.** The roadmap list (`ProjectTaskResponse`) carried
no assignee — only `TaskDetailResponsePayload` did. Showing who owns each task
would otherwise have meant a detail fetch per row. One extra spec asserts on the
Prisma `select` itself, not just the mapped output: dropping a column there still
compiles and returns `undefined` at runtime, so output-only assertions would miss
the regression.

**Stale counts.** Assignment happens on task detail but the bars live on the
roadmap, so the roadmap refetches detail *and* progress together — on pull, and
on focus when returning from a task. Refetching one without the other leaves the
rows and the bars disagreeing.

**Optimistic assignment** mirrors the existing optimistic status handling, with
one difference: `undefined` means "no pending change" because `null` is a real
value here (unassigned). Failure reverts and surfaces the backend's message.

**Unassigned is a choice, not a cancel.** Returning a task to the shared backlog
is a real action, so it is a row in the picker rather than a way to dismiss it.

The per-member panel only renders once a project has more than one member — on a
solo project it would restate the overall bar. Members with nothing assigned
still get a row: "nobody has given them anything yet" is worth seeing.

### Slice 3 — Comment thread ✅

**Date:** 2026-08-01

| File | Purpose |
|---|---|
| `src/lib/api/collaboration.ts` | The four comment endpoints |
| `src/hooks/useTaskComments.ts` | Thread fetch — also exposes `setData` |
| `src/components/ui/CommentBody.tsx` | Highlights `@mentions` in a body |
| `src/components/ui/CommentThread.tsx` | Thread list + composer |
| `src/app/task/[id].tsx` | Mounts the thread; optimistic add and delete |

Mobile-only — Phase 6 built the backend. Backend tests are unchanged at 127
passing.

**`useTaskComments` returns `setData`,** unlike the sibling hooks. Optimistic
append has to write the list directly; refetching after every post would be a
round trip the user waits through for something already on screen.

**A posted comment is swapped, not refetched.** The stand-in row carries a
`pending-<time>` id, and the server's response replaces it — the server resolved
the mentions, and its id is the one delete needs. Failure removes the stand-in
and rethrows, which is what restores the text in the composer: the composer
clears optimistically and puts the draft back if `onSubmit` throws.

**Mention highlighting mirrors `mentions.util.ts`** — longest name first, so with
members "test" and "test user", `@test user` highlights whole. Verified against
the server's rules on 7 cases including the boundary guard (`@testing` is not a
mention) and case folding. Not a second source of truth: the backend already
returns `mentionedUserIds`; this only finds the same spans to style them.

**The current user comes from the member roster's `isSelf`,** not from Clerk —
the roster is already loaded for the assignee picker, and it also carries the
role that decides whether the owner sees delete on other people's comments.

**Added `KeyboardAvoidingView`** — the composer sits at the bottom of a scroll
view, so the iOS keyboard would cover it. No other screen in the app had an
input inside a scroll view, so there was no existing convention to follow.

Not built: comment **editing**. `PATCH /comments/:id` exists and is wrapped in
`collaboration.ts`, but no UI calls it — delete-and-repost covers the same need
at this scale.

---

## Phase 8 — In-app invites + notification centre

Tracks [IN_APP_INVITES_PLAN.md](./IN_APP_INVITES_PLAN.md). Supersedes the
"Deferred to next sprint" section below, which scoped this work.

| Slice | Scope | Status |
|---|---|---|
| 8A | Notification foundations | ✅ Done |
| 8B | User lookup | ✅ Done |
| 8C | Targeted invites | ✅ Done |
| 8D | Mobile notification centre | ✅ Done — verified on device |
| 8E | Mobile send + respond | ✅ Done |
| 8F | Deep link repair (optional) | Not started |

### Slice 8A — Notification foundations ✅

**Date:** 2026-08-03

| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | `NotificationType` enum; `type`/`readAt`/`inviteId` on `Notification`; `[userId, readAt]` index; `notifications` back-relation on `ProjectInvite` |
| `migrations/20260803070833_add_notification_read_state/` | Additive only — three `ADD COLUMN`s |
| `notifications/notifications.service.ts` | `notify()` moved here; `markAsRead`, `markAllAsRead`, `dismissNotification`, `syncBadge`; `unreadCount` on the list |
| `notifications/notifications.controller.ts` | 3 new routes |
| `notifications/collaboration-notifications.listener.ts` | Delegates to the service; all 5 writes now typed |
| `notifications/types/index.ts` | `NotifyPayload`; deleted the dead `CreateNotificationPayload` |
| `packages/types/src/index.ts` | `Notification*` contracts — the shared package had none |
| `common/types/type.ts` | Re-exports `PaginationInfo` from `@repo/types` |
| `__tests__/notifications.service.spec.ts` | New — 22 tests |
| `__tests__/collaboration-notifications.listener.spec.ts` | +5 type-tagging tests |

#### Why `notify()` moved

It was a **private** method on the listener, so `InvitesService` — the second
producer, arriving in 8C — could not reach it. It now lives on
`NotificationsService`, which the module already exports. The listener keeps a
thin private wrapper so its four handlers read unchanged.

#### `readAt`, not `read`

A nullable timestamp costs the same as a boolean and answers *when* for free.
Null means unread, so **existing rows needed no backfill** — they are correctly
unread on arrival. Verified: all 7 pre-existing rows migrated to
`type = GENERIC`, `read_at = NULL`.

#### The badge is recomputed, never assumed

`User.hasNotifications` is a denormalised cache of "any row with
`readAt IS NULL`". Every mutation calls `syncBadge`, which counts inside the same
transaction. Guessing either direction leaves the badge lying: marking one
notification read only darkens it when it was the *last* unread one. Two tests
pin the two directions, and M7 pins it live.

`clearAllNotifications` used `Promise.all`, so a delete could land while the flag
update failed — leaving the badge lit over an empty list. Now a `$transaction`.

#### `type` as an enum, `inviteId` as a typed FK

Notification kind was previously recoverable only by string-matching five
literal titles. Fine for display, useless for behaviour — an actionable invite
row cannot depend on a title.

`inviteId` is a real FK rather than the generic `entityId`/`entityType` pair the
dead `CreateNotificationPayload` proposed, specifically to get
`onDelete: Cascade`: revoking an invite removes the notification carrying its
accept/decline buttons. A string column cannot, and would leave a row whose
action 404s. **Verified live** — see the FK row below.

#### `PaginationInfo` moved to `@repo/types`

It lived only in the backend, so mobile had no pagination contract. Rather than
declaring a second copy, `common/types/type.ts` now re-exports it from
`@repo/types` — one definition, and the two existing importers are unchanged.

#### Route ordering

`read-all` and `clear-all` are declared **before** `:id/read` and `:id`, so they
are matched as literals rather than captured as an `:id`. Confirmed against the
live Swagger route table.

#### Tests

```
pnpm --filter backend exec jest
# 16 suites, 170 passed
```

27 new tests. The ones that matter: the badge in both directions, `unreadOnly`
asserted on the Prisma `where` (a dropped filter still returns rows, so an
output-only assertion would pass), the string `'false'` not being treated as
true, cross-user rejection, already-read being a no-op success rather than a 404,
and one per `NotificationType`.

The 2 specs this doc previously listed as permanently broken (`ai.service.spec`,
`brain-dumps.controller.spec`) now pass — fixed in the interim, not by this work.

#### Live verification

HTTP-level testing needs a Clerk session token that cannot be minted outside the
app, so this ran against the real database through the same Prisma calls the
routes make, with two real users:

| # | Check | Result |
|---|---|---|
| M1 | Generated SQL reviewed **before** applying | 3 × `ADD COLUMN`, no drops ✅ |
| M2 | Invite codes after migrating | 7 → 7 intact ✅ |
| M3 | Pre-existing rows | `GENERIC`, unread ✅ |
| M4 | Typed rows round-trip | `TASK_ASSIGNED`, `MEMBER_JOINED` ✅ |
| M6 | Another user marks Alice's row read | Matches nothing; row untouched ✅ |
| M7 | Read 1 of 2 | Badge **stays lit**, `unread=1` ✅ |
| M8 | Read-all | Nothing unread, badge dark ✅ |
| M9 | Dismiss the last unread | Deleted, badge dark ✅ |
| M10 | `unreadOnly` | Excludes the read row ✅ |
| FK | Delete an invite holding a notification | Notification cascaded away ✅ |

Database restored to its original 7 rows afterwards.

#### HTTP verification ✅

Re-run through the real routes with a Clerk token (`mustafawarind03`, OWNER of
"Basic To-Do Application" alongside member `mustafa.pbhub032`):

| # | Check | Result |
|---|---|---|
| 1 | `GET /notification` | `unreadCount` present; `type`/`readAt`/`inviteId` on every row ✅ |
| 2 | Assign a task, inspect the row the listener wrote | `TASK_ASSIGNED` ✅ |
| 3 | Read 1 of 3 | `unreadCount: 2`, `readAt` set, badge **stays `t`** ✅ |
| 4 | Read the same row again | 200, count unchanged — no-op, not 404 ✅ |
| 5 | PATCH/DELETE another user's row id | **404** both; their row untouched ✅ |
| 6 | `PATCH /notification/not-a-uuid/read` | 400 ✅ |
| 7 | `PATCH /notification/read-all` | `{updated: 2}`, badge `f` — matched as a literal ✅ |
| 8 | `unreadOnly=true` / `=false` | 2 / 3 — the string-`'false'` case holds ✅ |
| 9 | Dismiss, then dismiss again | `unreadCount: 0`, then 404 ✅ |

Step 2 is the most informative: the new `TASK_ASSIGNED` row sits directly above an
older `Task completed` row still marked `GENERIC`. Same listener, same code path
— which shows both that the refactor kept the tagging and that pre-existing rows
migrated untouched.

Step 5 needed no second token: passing a real notification id owned by another
user is the same attack, and 404-not-403 confirms the non-enumeration choice.

Test data restored afterwards — the assignment was reverted, the notification it
generated removed, and every user's badge flag now matches their unread count.

#### Bug this caught

The first HTTP call returned **500**: `Unknown argument 'readAt'`. The running
server had loaded the generated Prisma client at boot, 23 minutes before the
migration regenerated it — and `nest start --watch` reloads application source
but not the resolved client in `node_modules`. A restart fixed it.

Nothing was wrong with the code, but it is worth knowing: **after a schema change
the dev server must be restarted, not just hot-reloaded.** No unit test could
have caught this, since the specs mock Prisma entirely. It is also the reason
`pnpm --filter @repo/db build` is needed after adding an enum — the backend
resolves types from source but enum *values* at runtime from `dist/`.

### Slice 8B — User lookup ✅

**Date:** 2026-08-03

| File | Change |
|---|---|
| `users/dto/lookup-user.dto.ts` | New — `LookupUserDto`, `ListUsersDto` |
| `users/users.service.ts` | New `lookupUserByEmail`, `listUsers` |
| `users/users.controller.ts` | `GET /user` and `GET /user/lookup` |
| `users/types/index.ts` | `ListUsersResponse` |
| `users/__tests__/users.service.spec.ts` | New — 18 tests (the module had no spec) |

#### Two routes, deliberately different threat models

The plan called for exact-email lookup only, on the grounds that a browsable list
leaks the user directory. **Revised during implementation** — picking from a list
is materially better UX than having to know an address in advance, and at 4 users
the directory concern is theoretical. Both now exist:

| Route | Purpose |
|---|---|
| `GET /user?search=&page=&limit=&excludeProjectId=` | The picker's list |
| `GET /user/lookup?email=` | Exact match, for someone not on the current page |

`lookup` uses `equals`, never `contains`. That is the difference between "confirm
an address I already know" and "a directory reachable one character at a time".
`@IsEmail` also rejects a bare prefix with a 400 before it reaches the database,
so the route cannot be used to probe by partial string. A test asserts the
`where` clause contains no `contains` at all.

#### Why not just expose the existing getAllUsers

`UsersService.getAllUsers` already existed, unexposed, and wiring it to a `@Get()`
would have been the smallest possible change. It was the wrong one:

- it selects `userSelect`, which includes **`hasNotifications` and `createdAt`** —
  internal fields with no business in another user's client
- it searches **email only**, despite an index on `name`. In a picker, typing a
  colleague's name and getting nothing reads as "they have no account"
- its `limit` is uncapped, so one request could dump the whole user table

`listUsers` uses `minimalUserSelect`, searches both columns, and caps `limit` at
50. `getAllUsers` is left in place as dead code — deleting it is unrelated
cleanup and belongs in its own commit.

#### `excludeProjectId`

The picker passes the project it is inviting to, and existing members are
filtered out server-side (`projectMembers: { none: { projectId } }`). Without it
the UI would offer people the invite could only reject with a 409. 8C extends the
same filter to cover pending invites.

#### Tests

```
pnpm --filter backend exec jest
# 17 suites, 188 passed
```

18 new. Several assert on the Prisma `where`/`select` rather than the response,
because a widened match or a leaked column still returns a valid-looking body —
an output-only assertion would pass.

#### Live verification

| # | Check | Result |
|---|---|---|
| M1 | Exact email of another user | 200, 3 fields only ✅ |
| M2 | Same address UPPERCASED | Resolves ✅ |
| M3 | Leading/trailing whitespace | Resolves ✅ |
| M4 | `?email=mustafa` (bare prefix) | 400 before any query ✅ |
| M4b | `?email=mustafa@gmail.com` — valid shape, real prefix | **404** ✅ |
| M5 | Own email | 404 ✅ |
| M6 | Unregistered address | 404 ✅ |
| M7/M8 | Omitted / malformed | 400 ✅ |
| M10 | Unauthenticated | 401 ✅ |
| L1 | Full list | 3 of 4 users; caller excluded ✅ |
| L2 | Response keys | Exactly `id`/`name`/`email` ✅ |
| L3 | `?search=test` (by name) | Matches ✅ |
| L4 | `?search=pbhub` (by email) | Matches ✅ |
| L5 | `?excludeProjectId=` | Existing member hidden ✅ |
| L6 | `?limit=2&page=2` | Correct slice and flags ✅ |
| L7 | `?limit=51` | 400 — cap enforced ✅ |
| L8 | Malformed project id | 400 ✅ |

**M4b is the security check that matters.** `mustafa@gmail.com` is a valid email
*shape* and a genuine prefix of a registered address, yet returns 404 — proving
the match is `equals`. Under `contains` it would have leaked
`mustafa.pbhub032@gmail.com`.

**L2 is the privacy check.** Exposing `getAllUsers` instead would have returned
`hasNotifications` and `createdAt` to every caller.

#### Incidental discovery

`apps/backend/src/dev/dev-tokens.controller.ts` exists — a dev-only helper that
mints long-lived Clerk tokens (`GET /dev/users`, `GET /dev/token/:userId`). It is
gated three ways and its module is not registered outside development. It is a
token-discovery helper, not an invite directory, so there is no overlap with
`GET /user`. Worth knowing: **it removes the token blocker that limited 8A's
verification** — a second user's token can now be minted for cross-user testing.

---

### Slice 8C — Targeted invites ✅

**Date:** 2026-08-03

| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | `InviteStatus`; `status`/`invitedUserId`/`respondedAt` on `ProjectInvite`; `code` now nullable; `@@unique([projectId, invitedUserId])` |
| `migrations/20260803093000_add_targeted_invites/` | Hand-written — includes the status backfill |
| `invites/dto/send-user-invite.dto.ts` | New — accepts `userId` **or** `email` |
| `invites/invites.service.ts` | `sendUserInvite`, `getPendingInvites`, `getProjectInvites`, `acceptTargetedInvite`, `declineInvite`, `revokeInvite` |
| `invites/invites.controller.ts` | 6 new routes |
| `notifications/events/collaboration.events.ts` | `InviteReceivedEvent`, `InviteDeclinedEvent` |
| `notifications/collaboration-notifications.listener.ts` | 2 new handlers |
| `users/users.service.ts` | `excludeProjectId` now also hides pending invitees |
| `__tests__/invites.targeted.service.spec.ts` | New — 40 tests |

#### Routes

| Route | Guard |
|---|---|
| `POST /projects/:id/invites/user` | member |
| `GET /projects/:id/invites` | member — outgoing, "awaiting reply" |
| `GET /invites/pending` | authed — my incoming |
| `POST /invites/:inviteId/accept-invite` | recipient only |
| `POST /invites/:inviteId/decline` | recipient only |
| `DELETE /invites/:inviteId` | sender or project owner |

Targeted routes key on invite **id**; the code flow keeps **`:code`**. Two paths
rather than one overloaded route: a targeted invite has no code, and
disambiguating by whether the parameter parses as a UUID would let an invalid id
fall through to the wrong handler. `invites/pending` is declared before
`invites/:code` so it is matched as a literal.

#### The migration — the data-loss gate

`code` becoming nullable was flagged in the plan as the only step in this phase
that could destroy data. Reviewed with `prisma migrate diff` **before applying**:

```sql
ALTER TABLE "project_invites" ADD COLUMN "invited_user_id" TEXT, …
ALTER COLUMN "code" DROP NOT NULL;      -- an ALTER, not a drop-and-add
```

Verified after: **7 rows, 7 codes, unchanged.**

The migration is hand-written because `prisma migrate dev` needs an interactive
prompt. That turned out to be useful — it allowed a backfill the generated SQL
would not have had. The `DEFAULT 'PENDING'` would otherwise have left all 5
already-redeemed invites claiming to be pending. `usedAt` stays the authority for
the code flow so this would not have caused a live bug, but a table full of rows
contradicting themselves misleads whoever reads it next. After migrating:
5 `ACCEPTED` (all with `used_at`), 2 `PENDING`.

Expired-but-unclaimed invites are deliberately left `PENDING`: expiry is derived
from `expires_at` at read time, and stamping a status would freeze a judgement
the query makes correctly for itself.

#### `code` nullable, and why targeted invites have none

A targeted invite is bound to its recipient, so minting a code would create a
second, unintended way into the project. Postgres permits many NULLs under a
UNIQUE constraint, so no partial index was needed.

#### The `@@unique` consequence, handled

`@@unique([projectId, invitedUserId])` puts "one invite per person per project"
in the database rather than in a service check that could race. The cost: **a
declined invite occupies the slot forever.** Re-inviting therefore *updates that
row* back to `PENDING` with fresh expiry rather than inserting a second one.

That loses the history of previous declines — accepted deliberately. At 2–3
members, "was this person invited before?" is not worth a table. Verified live:
re-inviting a previously-`ACCEPTED` recipient reused invite id `65ed9748…` and
left exactly **1** row for the pair.

#### Pending invites do not reserve a seat

Three pending invites on a one-member project are all legal; the first two
accepts win and the third gets 403. Counting pending against the cap would let
one ignored invite permanently block a real member.

The consequence is that capacity must be re-checked **inside the accept
transaction**, not only on send — send is where the user gets a useful error,
accept is where the race is actually closed. Same pattern as Phase 3.

#### Revoke deletes rather than marks REVOKED

The whole reason `Notification.inviteId` is a typed FK. Deleting the invite
cascades away the notification carrying its accept/decline buttons. A `REVOKED`
row would leave a live-looking notification whose buttons return 410.

`REVOKED` remains in the enum for the accept/decline paths to report against.

#### The invite notification has no `url`

Every other notification navigates somewhere. This one is answered in place, and
pointing it at the project would be worse than useless — the recipient is not a
member yet, so the screen would 404.

#### `userId` or `email`

The DTO accepts either. Nobody types a user id, so the picker searches with 8B's
`GET /user?search=` and sends the `id` it already holds — one less lookup, and
immune to a rename between search and send. But an invite typed straight into an
email field should not require the client to resolve it first, so `email` is
accepted and resolved server-side with the same `equals`-not-`contains` rule.
`userId` wins when both are given: an id is exact, an email is a lookup.

#### Tests

```
pnpm --filter backend exec jest
# 18 suites, 225 passed
```

40 new, in their own spec file so the 23 code-flow tests keep their fixtures —
the two flows share a table and must not share test setup, or a regression in one
could be masked by the other's fixture.

#### Live verification

Full round trip with two minted tokens (`mustafawarind03` as owner,
`test user` as recipient):

| # | Check | Result |
|---|---|---|
| M1 | SQL reviewed before applying | `ALTER … DROP NOT NULL` ✅ |
| M2 | Codes after migrating | 7 → 7 intact ✅ |
| M3 | Status backfill | 5 `ACCEPTED`, 2 `PENDING` ✅ |
| M4 | Send by userId | `PENDING`, `code IS NULL` ✅ |
| M5 | Recipient's notification | `PROJECT_INVITE` with `invite_id`, badge lit ✅ |
| M6 | `GET /invites/pending` | Title, inviter, member count ✅ |
| M7 | **Accept** | Project list `[]` → `["Basic To-Do Application"]` ✅ |
| M8 | Owner's notification | `MEMBER_JOINED` — Phase 5 still fires ✅ |
| M9 | Accept again | No-op success ✅ |
| M10 | Decline | `DECLINED`; inviter notified; drops off pending list ✅ |
| M11 | Re-invite after accept **and** after decline | Row reused, count stays 1 ✅ |
| M12 | Owner revokes | Invite gone, **3 notifications cascaded away** ✅ |
| M13 | Non-recipient accepts | 404, not 403 ✅ |
| M14 | Send when full | 403 ✅ |
| M15 | **Old code flow, end to end** | Create → preview → accept → 410 on reuse ✅ |

Also confirmed: existing member 409 naming them, self-invite 409, unknown email
404, empty body 400, duplicate-while-pending 409, unrelated member revoking 403,
non-member revoking 404, accept-after-decline 410.

**M7 is the headline** — the recipient's project list going from empty to holding
the shared project proves the invite grants real access, not just a row.

**M12 is the design payoff** — three notifications carried that `invite_id` and
all three vanished with the invite. A generic `entityId` string could not have
done that.

#### Bug found by M15

The code flow's `acceptInvite` set `usedAt` but left `status` at its `PENDING`
default, so a freshly redeemed code invite read `PENDING | used_by set` — exactly
the self-contradiction the migration had just backfilled away for historical
rows. No functional bug (`usedAt` is the authority, and the 410-on-reuse proved
it worked), but it would have reintroduced the inconsistency for every new row.
Fixed by setting `status`/`respondedAt` alongside. Re-verified:
`GEBZ75RQ | ACCEPTED | t | t`.

Test data restored: 7 invites, 7 codes, membership back to 2, and every badge
flag recomputed to match its unread count.

---

### Slice 8D — Mobile notification centre ✅

**Date:** 2026-08-03

| File | Purpose |
|---|---|
| `src/lib/api/notifications.ts` | New — the 5 notification endpoints plus accept/decline |
| `src/hooks/useNotifications.ts` | New — list + `unreadCount`, exposes both setters |
| `src/hooks/usePendingInvites.ts` | New — incoming invites |
| `src/components/ui/NotificationBell.tsx` | New — the bell and its badge |
| `src/app/notifications.tsx` | New — the list screen |
| `src/app/(tabs)/index.tsx` | Bell wired; badge refetched on focus |

Phase 5 emitted notifications and 8A made them readable, but **nothing had ever
displayed one**. The bell at `(tabs)/index.tsx:250` was a plain `View` — no
`onPress`, no badge. Notifications were write-only for three phases.

#### Kind comes from `type`, not the title

`KIND` maps each `NotificationType` to an icon and tint. Before 8A added the enum
this would have had to match literal title strings, which means a copy edit on the
backend would silently change the icon. This is what that enum was for.

#### Two sources, deliberately

The screen reads **both** `/notification` and `/invites/pending`. They can
disagree — a notification is dismissible, an invite is not — and the invite table
is the authority on what is genuinely still open. Invite notifications carrying an
`inviteId` are filtered out of the row list so the same question is not asked
twice.

Invitations render **above** the rows: they need an answer, and would otherwise
scroll away beneath older "task completed" entries.

#### The invite row does not navigate

`INVITE_RECEIVED` is the only notification the backend writes with no `url`, and
the client honours that: tapping the card does nothing, the buttons do the work.
Navigating to the project would 404 — the recipient is not a member yet. Verified
live: the row comes back with `url: null`.

A **declined**-invite notification is also `PROJECT_INVITE` but carries no
`inviteId`, so it falls through the filter and renders as an ordinary tappable
row. That is correct: the inviter should be able to tap through to the project.

#### Optimistic, with per-case failure handling

Not uniform, because the cases differ:

| Action | On failure |
|---|---|
| Mark one read | Ignored, logged. The row is cosmetic and the next fetch corrects it; blocking navigation on it would be worse than a stale dot |
| Mark all read | Reverted, with an alert. The user asked for this explicitly, so silently doing nothing would mislead |
| Dismiss | Reverted silently, then refetched |
| Accept / decline invite | Reverted **and** the backend's message surfaced. An invitation that vanishes on a failed accept reads as data loss |

#### The badge

Zero renders **no badge**, not a "0" — a zero badge draws the eye to report that
nothing happened. Past nine it shows `9+`; the exact number stops mattering and
starts breaking the layout.

It is refetched in the home screen's existing `useFocusEffect`. Without that,
returning from the notification screen would leave the badge showing whatever
count the tab had when it first mounted.

#### Verification

`pnpm exec tsc --noEmit` → exit 0.

Mobile has no test infrastructure — no jest config, no specs anywhere in
`apps/mobile` — so there are no unit tests to add here. Every endpoint the screen
calls was instead exercised live against the real backend with two minted tokens:

| Check | Result |
|---|---|
| `GET /notification` shape | `unreadCount` + `type`/`readAt`/`inviteId` per row ✅ |
| Invite row's `url` | `null`, as the in-place design requires ✅ |
| `GET /invites/pending` | Title, description, inviter, member count ✅ |
| `PATCH /notification/:id/read` | Returns the new `unreadCount` ✅ |
| `PATCH /notification/read-all` | `{updated: 1}`, count → 0 ✅ |
| `DELETE /notification/:id` | Row gone, count recomputed ✅ |

**Not verified: the UI itself.** Rendering, tap targets, the badge, and the
optimistic paths need a device. `expo export --platform web` is not a usable
substitute — the dev server resolves the API host from the machine's IP at start,
so an export outside `expo start` cannot even bundle.

Left ready for that check: `mustafawarind03` has **3 unread across 3 different
types** (mention, completion, assignment) so the badge and icon variety are
visible, and `test user` has a **pending invitation** to answer.

---

#### Note for 8C — resolved

`ProjectInvite.code` was still `NOT NULL` at the end of 8A, and making it
nullable was called out as the one step in this phase that could lose data.
Done in 8C: the `migrate diff` review confirmed an `ALTER … DROP NOT NULL`
rather than a drop-and-add, and all 7 codes survived.

---

### Slice 8E — Mobile invite send + revoke ✅

**Date:** 2026-08-11

Closes the loop. 8C made the backend able to invite a specific person and 8D let
the recipient answer, but nothing in the app could *send* one — `members.tsx`
still only offered a share code, which is what this phase set out to replace.

| File | Purpose |
|---|---|
| `src/lib/api/collaboration.ts` | `sendUserInvite`, `getProjectInvites`, `revokeInvite` |
| `src/hooks/useProjectInvites.ts` | New — outgoing invitations for a project |
| `src/app/project/members.tsx` | Email field, "Awaiting reply" list, revoke |
| `src/projects/project-access.service.ts` | New `assertHasCapacityForInvite` |
| `src/invites/invites.service.ts` | Send path uses the invite-aware check |

**Invite by email**, alongside the share code rather than replacing it. The
endpoint also takes a `userId`, which a search-and-pick UI would send, but the
screen collects an email and lets the backend resolve it — one round trip
instead of lookup-then-send. Only the 404 is handled specially: no account means
the person may not have signed up, and a share code is the way to reach someone
who has no account to be invited to, so that alert offers it. Every other
failure shows the backend's own message, which already names the case.

**Outgoing state** reads `GET /projects/:id/invites`, which returns pending and
unexpired invites only. A declined or lapsed invitation therefore disappears
rather than reporting its outcome — so the list needs no "declined" state, and
an absent invite must not be read as an error.

#### The bug this slice found

Sending used `assertHasCapacity`, which counts members alone. Correct when
someone is joining, too permissive when sending: **a pending invite is an
unfilled claim on a seat.** With 1 member and 2 free seats, three invitations
all returned 201. Reproduced live — the third send succeeded, then the second
person to accept got:

```
403  This project already has the maximum of 3 members.
```

The cap itself held (membership never exceeded 3), but the error landed on an
**invitee who did nothing wrong**, for an overbooking the sender caused and
never saw.

Fixed with a second method rather than by changing the shared one, because the
two accept paths must keep counting members only — a member is being added right
then, and counting their own invite would make every acceptance fail:

```ts
async assertHasCapacityForInvite(projectId: string): Promise<void> {
  const [members, pendingInvites] = await Promise.all([...]);
  if (members + pendingInvites >= MAX_MEMBERS) { ... }
}
```

Only targeted invites count. A share code has no identifiable recipient and no
limit on who holds it, so counting codes would let one unused code block every
future invitation.

The two exhausted-seat cases also read differently to the sender, so the message
distinguishes them — a full project cannot be helped, a claimed seat can:

```
403  This project's 3 seats are all taken by members or unanswered
     invitations. Withdraw an invitation to free one.
```

Verified live: that same third invite now 403s, and withdrawing one invitation
frees the seat so it succeeds — the advice in the message is accurate.

The mobile screen counts `members.length + outgoingInvites.length` for the same
reason, so the field hides before a doomed request is ever sent. That made the
share-code button's "Project is full" label wrong when seats are held by
invitations rather than members, so it now distinguishes the two.

#### Verification

Backend: **230/230 passing**, up from 225. Five new tests — four on the counting
method directly (including that it counts only targeted, pending, unexpired
rows) and one asserting the send path calls the invite-aware check and *not*
`assertHasCapacity`, which is the regression that would silently return.

Mobile has no test infrastructure, so verification was `tsc --noEmit` clean plus
every endpoint exercised live with minted tokens across 17 of the 20 planned
cases:

| Case | Result |
|---|---|
| Valid email, mixed case (`MustafaAwarind@Gmail.com`) | 201 — resolved |
| No account | 404, offers the code flow |
| Already a member | 409 "*name* is already a member" |
| Already invited and pending | 409 "*name* already has a pending invitation" |
| Own email | 409 "You are already on this project" |
| Malformed email | 400 backstop behind the client-side check |
| Outgoing list | name + email present for the row |
| Revoke by non-sender | 404 (project scoping) |
| Revoke by sender | 200, **notification cascaded 1 → 0** |
| Recipient's pending list after revoke | empty — no unanswerable card |
| Decline, then re-invite | same row reused, not blocked forever |
| Accept | joined, moves into the member list |
| Seats claimed by invitations | 403, freed by withdrawing one |

The cascade is the payoff from 8C's typed FK: revoking removed the notification
carrying the `inviteId`, so the recipient's card disappears instead of lingering
as a prompt that can no longer be answered. A generic `entityId` string could
not do that.

Not covered by automated tests: the two screen-level optimistic paths (revoke
restoring its row on failure, and the 404 alert offering the code flow), which
need a mobile test harness that does not exist yet.

---

## Deferred to next sprint

> **Superseded by Phase 8 above.** Kept for the original scoping.

Two items, grouped because they need the **same schema change**. Splitting them
across sprints would mean migrating `Notification` twice.

### 1. Notification UI

Phase 5 emits the events and persists the rows; nothing surfaces them. The
collaboration listener writes on join, assignment, comment and mention, and
`GET /notification` has existed since before this feature — but **no mobile
screen reads it**. The bell icon at `(tabs)/index.tsx:250` is decoration: no
fetch, no badge, no tap handler. Notifications are write-only today.

Needs:

- A notification list screen, and the bell wired to it
- `readAt` on `Notification` — without it a badge cannot tell new from seen, and
  would show the total until the user clears everything
- A dismiss-one endpoint; `DELETE /notification/clear-all` is the only mutation

### 2. In-app invites

Currently an invite produces a code shared through the OS share sheet. The
intended flow is to invite a specific user, who receives an **in-app
notification** and can **accept or decline**.

Needs:

- A user-lookup endpoint — `users.controller.ts` exposes only `/users/me`, so
  there is no way to resolve a person to invite
- Status on `ProjectInvite` (`PENDING`/`ACCEPTED`/`DECLINED`), so the owner can
  tell an ignored invite from a refused one
- Action state on `Notification`, so a notification can carry accept/decline
  rather than only text — the overlap with item 1
- A decision on how the owner picks the recipient. Email search avoids exposing
  a full user directory; a browsable list is easier to tap but leaks every
  user's name and email.
