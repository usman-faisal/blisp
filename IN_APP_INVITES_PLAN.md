# In-App Invites + Notification Centre — Implementation Plan

Phase 8, picking up the two items left in
[COLLABORATION_PROGRESS.md](./COLLABORATION_PROGRESS.md#L640) under "Deferred to
next sprint".

Today an invite is a code (`TJH5Z3TG`) pushed through the OS share sheet. The
intended flow is to invite a **specific person**, who gets an **in-app
notification** and can **accept or decline** without ever seeing a code.

---

## 1. Why these two ship together

An in-app invite that nobody can see is not a feature. The recipient's only
inbox is the `Notification` table, and **nothing reads it**:

- `GET /notification` and `DELETE /notification/clear-all` are the only two
  routes ([notifications.controller.ts](apps/backend/src/notifications/notifications.controller.ts))
- Mobile has zero notification code — no api module, no hook, no screen, no
  shared type. The bell at
  [(tabs)/index.tsx:250](apps/mobile/src/app/(tabs)/index.tsx#L250) is a plain
  `View`, not even a `Pressable`.

So Phase 5's notifications have been **write-only since the day they landed**.
Both items also need the same `Notification` migration — splitting them across
sprints means migrating that table twice.

### Decisions taken

| Question | Decision |
|---|---|
| How the inviter picks the recipient | **Exact email lookup.** No browsable directory. |
| Scope | **Full notification centre**, then invites layered on it. |
| Targeted invite rules | **Keep the 7-day expiry, drop single-use.** |

On the last one: a targeted invite is already bound to one recipient, so
`usedBy` is implied and single-use adds nothing. Expiry stays so abandoned
invites lapse rather than accumulating as phantom pending members.

### What the exploration changed about the doc's assumptions

Four things the progress doc did not record, found by reading the code:

1. **`UsersService.getAllUsers` already exists** with email search, entirely
   unexposed ([users.service.ts:14](apps/backend/src/users/users.service.ts#L14)).
   It searches email only despite an index on `name`. The lookup endpoint is
   mostly wiring, not new code.
2. **`User` has no `username`.** Only `id` (the Clerk id) and `email` are
   unique. "Email or username lookup" is **email-only** — there is no second
   handle to offer.
3. **`Notification` has no `type` column.** Kind is currently recoverable only
   by string-matching five literal titles (`'New collaborator'`,
   `'Task assigned to you'`, `'You were mentioned'`, `'New comment'`,
   `'Task completed'`). An actionable invite row cannot rely on that.
4. **There is no `notify()` on `NotificationsService`.** It is a *private*
   method on the listener
   ([collaboration-notifications.listener.ts:29](apps/backend/src/notifications/collaboration-notifications.listener.ts#L29)).
   Invites are emitted from `InvitesService`, so this has to move before a
   second producer can use it.

---

## 2. Schema

### `Notification` — read state and actionability

```prisma
enum NotificationType {
  GENERIC            // pre-existing rows and anything unclassified
  MEMBER_JOINED
  TASK_ASSIGNED
  TASK_COMMENTED
  TASK_MENTIONED
  TASK_COMPLETED
  PROJECT_INVITE     // the only actionable kind today
}

model Notification {
  id        String           @id @unique @default(uuid()) @db.Uuid
  userId    String           @db.Text
  title     String
  message   String?
  url       String?
  type      NotificationType @default(GENERIC)   // NEW
  readAt    DateTime?        @map("read_at")     // NEW
  inviteId  String?          @map("invite_id") @db.Uuid   // NEW
  user      User             @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  invite    ProjectInvite?   @relation(fields: [inviteId], references: [id], onDelete: Cascade)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([userId])
  @@index([userId, readAt])   // NEW — the unread-count query
}
```

Three notes on this shape:

**`readAt` as a nullable timestamp, not a `read` boolean.** Same cost, and it
answers "when" for free. `@default(GENERIC)` and nullable `readAt` mean existing
rows migrate without a data backfill — they simply read as unclassified and
unread, which is true.

**`inviteId` as a real FK, not a generic `entityId`.** The dead
`CreateNotificationPayload` in
[notifications/types/index.ts:20](apps/backend/src/notifications/types/index.ts#L20)
proposes `entityId`/`entityType` string pair with a `// TODO: Implement enum`.
Resist that: a typed FK gets `onDelete: Cascade` for free, so revoking an invite
removes its notification instead of leaving a row whose Accept button 404s. A
generic string column cannot do that. Delete the dead type as part of this work.

**Keep `User.hasNotifications`.** It is written by the listener and cleared by
`clearAllNotifications`; the daily-plan and brain-dump paths may also read it.
It becomes a denormalised cache of `count(readAt IS NULL) > 0`. Do not drop it
in this phase — just make sure every new write path maintains it, and derive the
badge *count* from `readAt`.

### `ProjectInvite` — targeted invites

```prisma
enum InviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  REVOKED
}

model ProjectInvite {
  // ... existing fields unchanged ...
  code          String?      @unique @db.VarChar(12)   // CHANGED: now nullable
  status        InviteStatus @default(PENDING)         // NEW
  invitedUserId String?      @map("invited_user_id")   // NEW — null = open code invite
  invitedUser   User?        @relation("InviteRecipient", fields: [invitedUserId], references: [id], onDelete: Cascade)
  respondedAt   DateTime?    @map("responded_at")      // NEW
  notifications Notification[]                          // NEW — back-relation

  @@unique([projectId, invitedUserId])   // NEW — one live invite per person per project
  @@index([projectId])
  @@index([invitedUserId, status])       // NEW — "my pending invites"
}
```

**`code` becomes nullable.** A targeted invite has no code to share — minting
one anyway would create a second, unintended way in. Postgres allows multiple
NULLs under a `UNIQUE` constraint, so this needs no partial index.

**`@@unique([projectId, invitedUserId])` is the important one.** It makes
double-inviting the same person impossible at the database level rather than by
a check the service might race. But it has a consequence that must be handled
deliberately: **a declined invite occupies the slot forever.** Two options —

- *Chosen:* on re-invite, `update` the existing row back to `PENDING` with a
  fresh `expiresAt` and `respondedAt: null`. One row per (project, person),
  reused. Loses the history of previous declines.
- Rejected: drop the unique constraint and filter on `status = PENDING` in the
  service. Keeps history but reintroduces the race.

At 2–3 members, "was this person invited before?" is not a question worth a
table for. Note the trade in the code comment so the next reader knows it was a
choice.

`usedAt`/`usedBy`/`usedByName` stay for the code flow and become redundant with
`status`/`respondedAt` for the targeted flow. Do **not** try to unify them in
this phase — the code flow works and is tested, and rewriting it doubles the
blast radius. Set both on accept.

### Migration

`20260803HHMMSS_add_notification_read_state_and_targeted_invites`

No data backfill needed — every new column is nullable or defaulted. The one
thing to verify by hand: making `code` nullable is `ALTER COLUMN … DROP NOT
NULL`, which Prisma should generate but which is worth reading in the SQL before
applying, since a generated `DROP COLUMN`/`ADD COLUMN` pair instead would
destroy every existing invite code.

---

## 3. Work breakdown

Slices are ordered so each is independently testable. 8A–8C are backend, 8D–8F
mobile. **8B and 8D can run in parallel** once 8A lands.

### Slice 8A — Notification foundations

**Depends on:** nothing.

1. Migration above. Delete the dead `CreateNotificationPayload` type.
2. **Extract `notify()` out of the listener** into `NotificationsService` as a
   public method, and add `type`/`inviteId` to its payload. The listener keeps
   its handlers but calls the service. This is the prerequisite for
   `InvitesService` producing notifications, and it is why 8A cannot be skipped.
   Tag each existing handler with its `NotificationType` while you are there.
3. New routes on `notifications.controller.ts`:

   | Route | Behaviour |
   |---|---|
   | `GET /notification` | *Extend:* add `unreadCount` to the response; accept `?unreadOnly=true` |
   | `PATCH /notification/:id/read` | Mark one read; 404 if not the caller's |
   | `PATCH /notification/read-all` | Mark all read; clears `hasNotifications` |
   | `DELETE /notification/:id` | Dismiss one |

   `clear-all` stays as-is. Every mutation must keep `hasNotifications` in sync
   with "any row with `readAt IS NULL`" — the badge going stale is the most
   likely bug in this slice, so pin it with a test.
4. Add `Notification*` types to `packages/types/src/index.ts`. There are
   currently **none** — mobile has no contract to code against.

**Done when:** the existing collaboration notifications carry a real `type`, and
read/unread transitions keep `hasNotifications` correct. Ownership check on
`:id` routes: a user must not be able to mark someone else's notification read.

---

### Slice 8B — User lookup

**Depends on:** nothing (can precede 8A).

One route:

```
GET /user/lookup?email=<exact>
  → 200 { id, name, email }   — the person
  → 404                       — no such user
```

Rules that matter:

- **Exact match, case-insensitive.** Not `contains`. `getAllUsers` uses
  `contains`, which would turn this into the browsable directory the decision
  explicitly rejected — `?email=a` must not return every user with an "a" in
  their address.
- Return **at most one** user. Email is `@unique`, so this is natural.
- Exclude the caller — inviting yourself is not a thing.
- Never include `hasNotifications` or any other field. Reuse `minimalUserSelect`.
- Rate-limit if a limiter exists in the app; if not, note it as accepted risk.
  Exact-match lookup is a much weaker oracle than prefix search, but it is still
  an oracle for "is this address registered".

Do **not** expose `getAllUsers` or `getUser`. They stay dead code, or get
deleted — a browsable list is the option that was turned down.

---

### Slice 8C — Targeted invites

**Depends on:** 8A (needs `notify()` on the service) and 8B (needs lookup for
the client to be usable).

| Route | Guard | Behaviour |
|---|---|---|
| `POST /projects/:id/invites/user` | member | Body `{ userId }`. Creates/refreshes a `PENDING` invite + notification |
| `GET /invites/pending` | authed | My incoming pending invites |
| `POST /invites/:id/accept` | invited user only | Joins; `status → ACCEPTED` |
| `POST /invites/:id/decline` | invited user only | `status → DECLINED`; notifies inviter |
| `DELETE /invites/:id` | inviter or project owner | `status → REVOKED`; cascades the notification away |
| `GET /projects/:id/invites` | member | Outgoing pending invites, so the UI can show "invited, awaiting reply" |

Note these accept/decline routes key on the invite **`id`**, while the existing
code flow keys on **`code`** (`POST /invites/:code/accept`). Two different
routes, deliberately — a targeted invite has no code, and overloading one path
to mean either would make the guard ambiguous. Register the `id` routes so they
cannot shadow `:code`; a UUID `ParseUUIDPipe` on one and not the other is the
cheap disambiguation.

Server-side rules, none of them in the client:

- **Reject if already a member** — 409, before creating anything.
- **Reject if the project is at `MAX_MEMBERS` (3).** Check on *send*, and
  again inside the accept transaction. Sending is where the user gets a useful
  error; accepting is where the race actually gets closed. Phase 3's
  `acceptInvite` already demonstrates the transaction pattern — copy it, do not
  re-derive it.
- **Pending invites do not reserve a seat.** Three pending invites on a
  one-member project are all legal; the first two accepts win and the third
  gets a 403. The alternative — counting pending against the cap — means one
  ignored invite permanently blocks a real member. Document the choice.
- Accept must be **idempotent**: already-accepted is a no-op success, matching
  the code flow's double-tap handling.
- Accept/decline are **recipient-only**. The inviter cannot accept on someone's
  behalf. Use `NotFound` rather than `Forbidden` for a non-recipient, to match
  `ProjectAccessService.assertMember`'s existing enumeration-leak reasoning.
- Reuse `MemberJoinedEvent` on accept so Phase 5's join notification still
  fires. Add one new event for `INVITE_RECEIVED` and one for `INVITE_DECLINED`.

**Done when:** two Clerk users complete a send → notify → accept round trip with
no code involved, a decline notifies the inviter, and the 4th member is still
rejected.

---

### Slice 8D — Mobile notification centre

**Depends on:** 8A deployed.

| File | Purpose |
|---|---|
| `src/lib/api/notifications.ts` | New — the five notification endpoints |
| `src/hooks/useNotifications.ts` | New — list + `unreadCount`, exposes `setData` |
| `src/app/notifications.tsx` | New — the list screen |
| `src/app/(tabs)/index.tsx` | Wire the bell: `View` → `Pressable`, add the badge |

Follow the **`useState`/`useEffect` + `mutate`** convention, not React Query.
Every collaboration-era hook made this choice explicitly and says so in a
comment; a third convention is worse than the two already there. Expose
`setData` like `useTaskComments` does — marking-read should be optimistic, not a
refetch.

Tap behaviour: each row navigates via its `url` (`/project/:id`, `/task/:id` —
already Expo Router paths, which is lucky rather than designed) and marks itself
read. The badge shows `unreadCount`, capped at "9+".

The `profile.tsx:173` notification settings row has an empty `onPress` — either
point it here or leave it, but do not leave two dead entry points.

---

### Slice 8E — Mobile invite send + respond

**Depends on:** 8C deployed, 8D (invite rows live in the notification list).

1. **Invite-by-email** on `project/members.tsx`, alongside — not replacing — the
   existing share-a-code button. Email field → lookup → confirm card with the
   resolved name → send. Handle the three real failures distinctly: no such user
   (offer the code flow as the fallback, since they may not have signed up),
   already a member, project full.
2. **Accept/Decline on the notification row** for `type: PROJECT_INVITE`. Two
   buttons inline; on accept, navigate to the project.
3. **Pending-invites section** at the top of the notification list, or the
   projects tab — an invite is more actionable than a "task completed" and
   should not scroll away under them.
4. **Outgoing state** on the members screen: "Invited, awaiting reply" with a
   revoke control, from `GET /projects/:id/invites`.

Optimistic accept/decline, mirroring the comment thread's approach: swap the row
out, and put it back if the call throws. An invite that silently vanishes on a
failed accept reads as data loss.

---

### Slice 8F — Deep link repair *(optional, independent)*

Not required for in-app invites, but the exploration turned up a real bug in the
**existing** code flow, so it is recorded here rather than lost:

`blisp://invite/CODE` on a cold start while signed out routes to
`/invite/[code]`, whose `getInvitePreview` hits an `AuthGuard` endpoint and
401s. The screen shows the generic "invite could not be opened" error, and
nothing persists the code across the sign-in redirect — so the invite is simply
lost. There is no pending-intent storage anywhere in the app.

Fix: stash the code before redirecting to sign-in, and consume it after. Its own
change, its own commit — it predates this phase.

---

## 4. Sequencing

```
8A (notification foundations) ──┐
                                ├─→ 8C (targeted invites) ─→ 8E (mobile send/respond)
8B (user lookup) ───────────────┘                              ↑
     │                                                         │
     └─→ 8D (mobile notification centre) ─────────────────────-┘

8F (deep link) — independent, any time
```

8A is the critical path: it owns the migration and the `notify()` extraction
that 8C depends on. 8B is genuinely independent and can go first if you want a
small win to start.

---

## 5. Deliberately not doing

- **No push notifications.** `expo-notifications` is not in `app.json` plugins
  and there is no device-token storage. In-app only. Push is a separate project
  with its own credentials and permission-prompt UX.
- **No realtime.** Consistent with the rest of the collaboration plan — the
  notification list refetches on focus and pull. An invite arriving within
  seconds is not a requirement anyone stated.
- **No invite-by-email-to-non-users.** If the lookup 404s, fall back to the
  existing share-a-code flow. Sending an actual email to an unregistered address
  means signup-attribution plumbing that does not exist.
- **No per-notification preferences.** No "mute this project". At 3 members
  the volume does not justify a settings matrix.
- **No unifying `usedAt`/`usedBy` with `status`.** They overlap for targeted
  invites. The code flow is tested and working; leave it.
- **No invite history.** Re-inviting a declined user reuses the row. See §2.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| `code` NOT NULL drop generated as drop+add column → **every existing invite code destroyed** | Read the generated SQL before applying. This is the one migration step that can lose data |
| `hasNotifications` drifts from `readAt` → badge shows when the list is empty, or stays dark with unread rows | Every mutation maintains both; a test pins each transition. Derive the count from `readAt`, never from the boolean |
| Lookup becomes a user directory via `contains` | Exact match only, one result, caller excluded. Assert on the Prisma `where` in a test — an output-only assertion would miss a `contains` regression |
| Pending invites let a 4th member in | Capacity checked inside the accept transaction, not only on send. Reuse Phase 3's proven pattern |
| Declined invite blocks re-inviting forever | Re-invite updates the existing row back to `PENDING` |
| Notification for a revoked invite leaves a dead Accept button | `onDelete: Cascade` on the `inviteId` FK — the reason it is a typed FK, not a string `entityId` |
| A third data-fetching convention on mobile | Match the existing `useState`/`mutate` hooks; do not reach for React Query |
| Accept-on-someone-else's-invite | Recipient-only check, `NotFound` not `Forbidden` |

---

## 7. Prerequisite

Unchanged from the collaboration plan: the Clerk webhook is unreachable locally,
so users only exist in Postgres after `pnpm --filter backend sync:users`.
Testing needs **2–3 real Clerk users in the database**.

Phase 3 left `test@gmail.com` as a MEMBER of "User Interaction Initialization" —
a real shared project to develop against. For invite testing you additionally
need a user who is **not** yet a member of some project, to be the invitee.
