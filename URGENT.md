# URGENT — revised plan for submission on 18 November

**Written 14 November 2026.** The submission date moved from **20 November to
18 November**. The feature freeze that was planned for 17–18 November no longer
exists: the 18th *is* the submission.

This file records the decisions taken on the 14th so tomorrow starts without
re-litigating them.

---

## 1. The new calendar

| Day | Plan |
|---|---|
| **14 Nov (Fri)** | GitHub verification + FYP report committed. Branch `feat/github-verification` pushed and merged. |
| **15 Nov (Sat)** | GitHub OAuth, day 1. UI redesign (visual only, ~1 hr). |
| **16 Nov (Sun)** | GitHub OAuth, day 2 — **must be finished or abandoned by end of day**. |
| **17 Nov (Mon)** | **Whole-system testing.** No new features. |
| **18 Nov (Tue)** | **SUBMIT.** |

Three working days. One is reserved for testing and is not negotiable — it is
the only thing standing between a working demo and a surprise on submission
morning.

---

## 2. Decisions taken

### 2.1 OAuth: build it, across two days

Recorded with the reasoning on both sides, because this was a close call.

**The case against** (my recommendation at the time): the project already has a
complete, documented verification feature, and §8.3 of the FYP report defends
the absence of OAuth as a deliberate trade-off — *"OAuth is plumbing;
verification is the contribution."* A half-finished OAuth flow replaces that
clean argument with a broken button, and any overrun eats the testing day.

**The decision:** build it properly across the 15th and 16th.

**The condition attached to it:** if the flow is not working by the end of the
16th, it is **abandoned, the branch is reverted, and the deferred story in
§8.3 stands unchanged**. This is not a judgement call to be made on the 17th —
it is agreed now, in writing, so that the testing day is protected.

### 2.2 Redesign: every screen, visual only

Gradient tiles and similar styling. **No new endpoints, no new flows.** If a
mockup turns out to imply backend work, that screen is dropped from the
redesign rather than the backend being changed four days before submission.

### 2.3 Cut, and staying cut

| Item | Status |
|---|---|
| Push notifications (M5) | **cut** — in-app notifications and streaks are done; document as future work |
| Project-aware AI assistant (M7) | **cut** — not started |
| Netlify deployment (M9) | **cut** — not started |
| PR / issue evidence ingestion | **cut** — the parser exists and is tested; commit ingestion is enough |

None of these weakens the thesis. The contribution is the verification
principle applied to both AI output and human self-reporting, and that is
built, measured and written up.

---

## 3. What tomorrow needs to know about OAuth

Audited on the 14th before any code was written.

### 3.1 Already in place

- **Deep-link scheme is registered**: `scheme: "blisp"` in `apps/mobile/app.json`.
  This is normally the most awkward part of mobile OAuth and it is already done.
- `ProjectRepository.accessToken` exists in the schema, is nullable, and is
  **never returned by any endpoint** — `presentRepository()` exposes
  `hasToken: boolean` only.
- `GithubClient` already accepts an optional token on every call, so the
  authenticated path needs no client changes.
- `AuthModule` is thin (Clerk strategy + `/auth/me`), so adding routes there is
  low-risk.

### 3.2 Not in place — build in this order

1. **Encryption helper.** `ENCRYPTION_KEY` is present in `.env` but **nothing
   reads it**; no encrypt/decrypt utility exists anywhere in the backend.
   Tokens must be encrypted at rest before any OAuth token is stored. This is
   the first task, and it blocks everything else.
2. `GET /auth/github` — redirect to GitHub with a generated CSRF `state`.
3. `GET /auth/github/callback` — validate `state`, exchange code for token,
   handle user denial, encrypt and store, deep-link back to `blisp://`.
4. Repository picker UI — list repositories the user can actually access,
   which is the thing OAuth exists to enable.
5. Revoked/expired token handling.

### 3.3 Where it is most likely to go wrong

Ranked by how much time they usually cost:

1. **Deep-link return on a physical device.** The scheme is registered, but
   returning from a browser into the app is where mobile OAuth usually breaks.
   Test this on the real phone early — not at the end.
2. **Redirect URI mismatch.** The URI registered in the GitHub OAuth App must
   match exactly, including scheme and path.
3. **Token encryption.** Not hard, but it is new code handling a secret, so it
   needs to be right rather than quick.

### 3.4 Scope guard

The plan's security rules (`BLISP_IMPLEMENTATION_PLAN.md` §9) also ask for
**webhooks with signature validation**. These are **not** in scope for the
15th–16th. Sync stays user-initiated, which the FYP report already defends:
60 unauthenticated requests/hour with incremental fetching is well within
budget and avoids the aggressive polling the plan warns against.

---

## 4. The testing day (17 November)

No new features. The demo path, in order, on a clean start:

1. Speak an idea → transcript → project
2. Discovery report → verification metrics table
3. Show a **withdrawn** claim
4. Roadmap with a deadline that does not fit → two remedies
5. Tag a commit → sync → **Verified**
6. **Commit the task title with no reference → still "Not checked"**

Step 6 is the one that distinguishes this from a cosmetic feature: it shows the
system checks rather than guesses.

Also on the 17th:

- [ ] `pnpm --filter backend test` — expect 487 passing, 28 suites
- [ ] `tsc --noEmit` clean on backend and mobile
- [ ] Full flow on a **physical device**, not just the emulator
- [ ] Confirm no secret appears in any API response or log
- [ ] Re-read `BLISP_FYP_REPORT.md` §9 and update anything that changed

---

## 5. Known risks going into the final days

1. **Intermittent DNS on the dev machine.** `EAI_AGAIN` caused three separate
   "the API is broken" investigations where the key, quota and provider were
   all fine. Both Groq and Tavily now retry once on connect-level failures, so
   the app survives a blip — but if it happens during a live demo the
   underlying fix is the machine's resolver (switch `systemd-resolved` to
   `1.1.1.1`), not more application code.
2. **OAuth overrunning into the 17th.** Mitigated by the abandon-by-the-16th
   condition in §2.1.
3. **The redesign touching every screen.** Visual-only is the guard; if a
   screen needs structural change it is dropped rather than rebuilt.
4. **Backend e2e tests are broken** (pre-existing) and `expo lint` has no
   config (pre-existing). Neither blocks submission; both are recorded as
   limitations in the FYP report.

---

## 6. If time runs out

Priority order for what must be true on the 18th:

1. The app runs and the six demo steps work.
2. `BLISP_FYP_REPORT.md` is accurate — **especially §9 Limitations**. An
   inaccurate limitations section is worse than a missing feature.
3. All P0 milestones are either complete or honestly marked partial.
4. OAuth is either finished or absent. **Not half-present.**

A smaller system described accurately defends better than a larger one
described optimistically.
