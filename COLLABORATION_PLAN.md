# Collaboration Mode — Implementation Plan

Let 2–3 users join a shared project via an invite, work the same roadmap
together, and see both their own progress and the group's.

---

## 1. Why this is invasive

Ownership today is a single column. `Project.userId` points at one user, and
every read path filters on it:

```ts
// projects.service.ts — repeated in getProjectById, updateProject, archiveProject, ...
where: { id: projectId, userId }

// tasks.service.ts — ownership reached through the parent project
where: { id: taskId, project: { userId } }
```

There is no seam to hook collaboration into. Any user other than the owner
fails the `where` clause and gets a 404. So the core of this work is
**replacing "is the owner" with "is a member"** everywhere, not adding a
feature alongside the existing model.

Two things already in the repo help:

- `TEAM_ID_HEADER = 'x-team-id'` exists in `common/lib/constants.ts` and is
  already allow-listed in CORS in `main.ts`. It is otherwise unused — scaffolding
  for exactly this, left unfinished.
- `DailyPlan` is keyed `@@unique([userId, planDate])`. Per-member daily plans
  over a shared project already work without a schema change.

### The decision that shapes everything

`Task` has no assignee. "Each can track their own progress" can mean:

- **(A) Tasks are assigned.** Add `Task.assigneeId`. My progress = my assigned
  tasks. Clean, but one task belongs to one person.
- **(B) Tasks are claimed per member.** A join table tracks per-member status.
  Two people can work the same task independently.

**This plan implements (A).** It matches the existing daily-plan generator,
which pulls unplanned tasks per user — with an assignee that keeps working
unchanged. (B) would require rewriting daily-plan generation and has no clear
use case for a 2–3 person team.

---

## 2. Schema

```prisma
enum ProjectRole {
  OWNER   // created it; can delete the project and remove members
  MEMBER  // can work tasks, invite others
}

model ProjectMember {
  id        String      @id @default(uuid()) @db.Uuid
  projectId String      @map("project_id") @db.Uuid
  userId    String      @map("user_id")
  role      ProjectRole @default(MEMBER)
  joinedAt  DateTime    @default(now()) @map("joined_at")

  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([userId])
  @@map("project_members")
}

model ProjectInvite {
  id         String       @id @default(uuid()) @db.Uuid
  projectId  String       @map("project_id") @db.Uuid
  code       String       @unique @db.VarChar(12)
  createdBy  String       @map("created_by")
  expiresAt  DateTime     @map("expires_at")
  usedAt     DateTime?    @map("used_at")
  usedBy     String?      @map("used_by")

  project    Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@map("project_invites")
}
```

Changes to existing models:

```prisma
model Project {
  // Keep userId. It stays the creator and the AI pipeline's owner —
  // brain dumps, research jobs and pipeline events are all per-user.
  // Membership governs *access*; userId governs *provenance*.
  members ProjectMember[]
  invites ProjectInvite[]
}

model Task {
  assigneeId String? @map("assignee_id")   // null = unclaimed
  assignee   User?   @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)

  @@index([assigneeId])
}

model User {
  projectMemberships ProjectMember[]
  assignedTasks      Task[] @relation("TaskAssignee")
}
```

**Backfill is mandatory.** Every existing project needs an `OWNER` row or its
creator loses access the moment the access check switches over:

```sql
INSERT INTO project_members (id, project_id, user_id, role, joined_at)
SELECT gen_random_uuid(), id, user_id, 'OWNER', created_at FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;
```

Write this into the migration file itself, not a separate script, so it can
never be skipped.

---

## 3. Work breakdown

Dependencies are strict: each phase compiles and passes tests before the next
starts. Phases 4 and 5 are the only ones that can run in parallel.

### Phase 1 — Schema and access primitive

**Depends on:** nothing.

1. Add the models above to `packages/db/prisma/schema.prisma`.
2. `pnpm turbo run db:migrate` — name it `add_project_collaboration`.
3. Hand-edit the generated SQL to append the backfill `INSERT`.
4. Add a `ProjectAccessService` in `projects/` exposing:

   ```ts
   assertMember(userId: string, projectId: string): Promise<ProjectMember>
   assertOwner(userId: string, projectId: string): Promise<ProjectMember>
   memberProjectIds(userId: string): Promise<string[]>
   ```

   Each throws `ForbiddenException` rather than returning null, so callers
   cannot forget to check.

**Done when:** migration applies to a clone of the dev database and every
existing project has exactly one `OWNER` row.

**Risk:** the backfill is the single highest-risk step in the project. Test it
against a copy of real data before it runs anywhere shared.

---

### Phase 2 — Swap ownership checks for membership checks

**Depends on:** Phase 1.

This is the bulk of the backend work and touches every project read path.

| File | Change |
|---|---|
| `projects.service.ts` | `where: { id, userId }` → `where: { id }` preceded by `assertMember`. `getProjects` filters `id: { in: await memberProjectIds(userId) }` |
| `tasks.service.ts` | `where: { id, project: { userId } }` → resolve task, then `assertMember(userId, task.projectId)` |
| `pipeline_events` | Same membership check before returning events |
| `projects.service.ts` (destructive ops) | `archiveProject` and any delete use `assertOwner`, not `assertMember` |

Do **not** change `brain_dumps` or the AI pipeline. Brain dumps stay private to
their author; only the resulting project is shared. Widening those would leak
raw voice transcripts to collaborators.

**Done when:** a non-member still gets 403/404 on every project route, and a
member gets full read access. This phase needs tests before moving on — it is
where an access-control bug would be introduced silently.

---

### Phase 3 — Invites

**Depends on:** Phase 1. Can start alongside Phase 2 but must merge after it.

New `InvitesModule`:

| Route | Guard | Behaviour |
|---|---|---|
| `POST /projects/:id/invites` | member | Generate a short code, 7-day expiry, return it |
| `GET /invites/:code` | authed | Preview: project title, member count — no join |
| `POST /invites/:code/accept` | authed | Validate, enforce cap, create `ProjectMember`, mark used |
| `GET /projects/:id/members` | member | List members with roles |
| `DELETE /projects/:id/members/:userId` | owner | Remove a member; unassign their tasks |

Rules to enforce server-side, not in the client:

- **Cap membership at 3.** Reject the accept with a clear 409 when full.
- Reject expired or already-used codes distinctly, so the UI can explain which.
- Accepting an invite you already hold is a no-op success, not an error.
- Generate codes with `crypto.randomBytes`, not `Math.random`.

**Done when:** two Clerk users can join one project by code, and a third is
rejected with a distinguishable error.

---

### Phase 4 — Assignment and progress

**Depends on:** Phase 2.

1. `PATCH /tasks/:id/assign` — body `{ assigneeId: string | null }`. Assignee
   must be a member of the task's project; reject otherwise.
2. Extend the task update path so status changes are permitted by any member,
   not only the assignee. For a 2–3 person team, blocking on assignment creates
   friction with no benefit.
3. New `GET /projects/:id/progress` returning both figures the request asks for:

   ```ts
   {
     overall: { total: number, done: number, inProgress: number },
     perMember: Array<{
       userId: string, name: string,
       assigned: number, done: number
     }>,
     unassigned: number
   }
   ```

   Compute with `groupBy`, not by loading tasks into memory — this is called on
   every roadmap view.

**Daily plans need no schema change.** The generator in
`daily-plan.service.ts` selects tasks via `project: { userId, status: ACTIVE }`.
Change that to `project: { members: { some: { userId } } }` **and** add
`assigneeId: userId` so a member's plan contains their own work. Without the
assignee filter, all three members receive identical plans containing each
other's tasks.

---

### Phase 5 — Notifications

**Depends on:** Phase 3. Independent of Phase 4.

The `Notification` model already exists and needs no change. Emit on:

- Someone joins your project
- A task assigned to you
- A member completes a task on a shared project

Fire these from an event listener, not inline in the service methods —
`EventEmitterModule` is already registered in `app.module.ts`. Inline
notification writes inside a transaction will make task updates slower and
couple unrelated failures together.

---

### Phase 6 — Task comments

**Depends on:** Phase 2 (needs membership checks). Independent of Phases 4 and 5.

Discussion attached to the work it concerns, rather than a separate chat log.
No realtime layer — there is none in the codebase today, and introducing one
(gateway, socket auth against Clerk, mobile reconnection, read state) costs more
than the rest of this plan combined. Comments refetch on focus like everything
else.

```prisma
model TaskComment {
  id        String   @id @default(uuid()) @db.Uuid
  taskId    String   @map("task_id") @db.Uuid
  authorId  String   @map("author_id")
  body      String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([taskId, createdAt])
  @@map("task_comments")
}
```

| Route | Guard | Behaviour |
|---|---|---|
| `GET /tasks/:id/comments` | member of task's project | Oldest-first, author name included |
| `POST /tasks/:id/comments` | member | Create; notify other members |
| `PATCH /comments/:id` | author only | Edit own comment |
| `DELETE /comments/:id` | author or project owner | Remove |

Notes:

- Reuse `ProjectAccessService.assertMember` — resolve the task's `projectId`
  first, then check. Do not re-implement the check here.
- Cap body length in the DTO (e.g. 2000 chars) so a runaway client cannot write
  unbounded text.
- Include `author.name` in the response. Without it the mobile client needs a
  second round trip per comment to render an author.
- The unread problem is real but out of scope: a `lastReadAt` per member per
  task is the cheap version if it becomes necessary. Do not build read receipts.

**Done when:** two members can hold a conversation on one task and each sees the
other's comments after a refetch.

---

### Phase 7 — Mobile

**Depends on:** Phases 3 and 4 being deployed to the backend you point at.
Comment UI additionally depends on Phase 6.

1. **Invite flow** — generate/share a code from project detail; enter-code
   screen to join. Use the existing `scheme: "blisp"` deep link so a shared
   `blisp://invite/CODE` opens the app directly.
2. **Member presence** — avatars on the project header; assignee on each task row.
3. **Progress view** — overall bar plus per-member breakdown from the new endpoint.
4. **Assignment UI** — assign/claim control on the task detail screen.
5. **Comment thread** — on task detail, below the task body. Optimistic append on
   post, rollback on failure; a comment that silently vanishes reads as data loss.

React Query cache invalidation matters here: after any assignment or status
change, invalidate the project detail, progress, and daily-plan queries
together. Missing this is why collaborative UIs feel stale.

---

## 4. Sequencing

```
Phase 1 (schema + access primitive)
   ├─→ Phase 2 (swap ownership → membership)   ← largest, riskiest
   │      ├─→ Phase 4 (assignment + progress) ─┐
   │      ├─→ Phase 6 (task comments) ─────────┤
   │      └─────────────────────────────────────┼─→ Phase 7 (mobile)
   └─→ Phase 3 (invites)                        │
          ├─→ Phase 5 (notifications)           │
          └─────────────────────────────────────┘
```

Phase 2 is the critical path. It is not parallelisable — every later phase
assumes membership-based access is already in place. Phases 4, 5 and 6 are
independent of each other and can proceed in any order once their prerequisites
land.

---

## 5. What this plan deliberately does not do

- **No realtime.** No websockets, no live cursors. Members see each other's
  changes on refetch. Adding realtime means introducing a socket layer that
  does not exist today; it is a separate project.
- **No project-wide chat.** Discussion lives on tasks (Phase 6), not in a
  separate thread. A chat log that only updates on refetch reads as broken in a
  way a progress bar does not — so chat is the feature that would force the
  realtime layer above. Task comments deliver most of the value without it, and
  keep discussion attached to the work it concerns.
- **No unread counts or read receipts.** Deliberately omitted from comments; a
  per-member `lastReadAt` is the cheap version if it proves necessary.
- **No conflict resolution.** Two people editing one task title is last-write-
  wins. At 2–3 users this is an acceptable trade; document it rather than
  building CRDTs.
- **No shared brain dumps.** Voice transcripts stay private to their author.
- **No org/team entity.** Membership is per project. A `Team` model would be the
  right call at 10+ users; at 3 it is overhead. The unused `TEAM_ID_HEADER` is
  a hint the original design considered this — leave it unused.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Backfill misses projects → owners locked out | Run inside the migration; verify count matches `projects` before deploying |
| A missed `where` clause leaks another user's project | Grep for `userId` in all services after Phase 2; the access primitive throwing (not returning null) makes omissions fail loudly |
| Daily plans duplicated across members | Filter by `assigneeId` in the generator, not just membership |
| Invite codes guessable | `crypto.randomBytes`, not `Math.random`; expire in 7 days |
| Member removal orphans tasks | `onDelete: SetNull` on `assigneeId` plus an explicit unassign on removal |

---

## 7. Prerequisite

The Clerk webhook is not reachable in local development, so users only exist in
Postgres after running `pnpm --filter backend sync:users`. Collaboration testing
needs **2–3 real Clerk users present in the database** before any of this can be
exercised. Set up the webhook tunnel first, or run the sync after each signup.
