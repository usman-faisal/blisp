# BLISP --- Claude Code Implementation Blueprint

**Repository:** https://github.com/usman-faisal/blisp\
**Target:** Final submission --- 20 November 2026\
**Feature freeze target:** 17--18 November 2026\
**Working rule:** Audit first, implement one milestone at a time,
smoke-test immediately after each feature, and commit only verified
work.

> This document is an execution plan, not permission to rebuild the
> application. Claude Code must inspect the actual repository and
> preserve working architecture and features.

------------------------------------------------------------------------

## 0. Instructions for Claude Code

### Your role

Act as a senior full-stack engineer helping a beginner maintain and
extend an existing final-year project. Work in small, reviewable
milestones. Prefer minimal, safe changes over broad refactors.

### Token-efficiency rules

1.  **Do not repeatedly reread the entire repository.** Start with a
    focused audit, then inspect only files relevant to the current
    milestone.
2.  Use concise summaries. Do not explain obvious code or print entire
    files.
3.  Before editing, list the exact files you intend to change and why.
4.  Reuse existing services, components, API clients, state management,
    styling, and libraries wherever practical.
5.  Do not add dependencies unless the existing stack cannot reasonably
    support the feature. Explain the need and alternatives first.
6.  Do not generate large boilerplate or duplicate functionality.
7.  Do not implement multiple milestones in one pass.
8.  Do not start the next milestone until the current one passes its
    smoke tests and the user approves.
9.  Do not run expensive or broad test suites after every tiny edit. Run
    the focused checks for the changed area, then the relevant
    regression checks.
10. At the end of each milestone, provide a short report: changed files,
    migration (if any), commands run, smoke-test results, known issues,
    and suggested commit message.

### Safety and repository rules

-   First inspect the actual repository and its current branch/status.
    Never assume the architecture in this document is still accurate.
-   Do not overwrite user changes. Check `git status` before editing.
-   Do not reset, force-push, delete branches, or rewrite Git history.
-   Do not expose API keys, OAuth secrets, access tokens, personal data,
    or `.env` contents in output or logs.
-   Never put private API keys in mobile/web client code. Keep secrets
    server-side.
-   Validate authentication and project-level authorization on every new
    protected endpoint.
-   Use the repository's existing validation, error-handling, logging,
    and test conventions.
-   Database changes must use the existing migration workflow. Never
    edit production data directly.
-   Do not claim an integration works until it has been tested against a
    real or clearly labelled sandbox/test environment.
-   If a provider's free tier, rate limits, API model, or terms are
    uncertain, verify current official documentation before
    implementation. Do not assume an API is free.
-   If a requirement cannot be completed safely before the deadline,
    explain the trade-off and recommend deferring it rather than
    destabilizing working features.

------------------------------------------------------------------------

## 1. Product direction

### Product definition

**BLISP is an AI-powered, voice-first idea-to-execution platform.** It
helps users turn an initial idea into a researched, refined, achievable
project, then supports them through personalized planning, daily
execution, progress tracking, collaboration, and delivery.

### Product philosophy --- critical AI behavior

BLISP must **not reject an idea merely because similar products already
exist**.

Example: if a user proposes a university Learning Management System
(LMS), BLISP should research existing LMS products, identify their
strongest relevant features and weaknesses, understand the user's target
university and constraints, and recommend a better-tailored solution. It
should not simply say "LMS products already exist; do not build this."

The research agent should: - Understand the user's problem, target
audience, context, constraints, and intended outcome. - Research
existing products, solutions, technologies, and relevant user needs. -
Compare features and distinguish verified facts from AI
recommendations. - Recommend the best relevant features, not blindly
copy every competitor feature. - Identify gaps, possible
differentiators, technical risks, and an achievable MVP. - Adapt
recommendations to budget, skills, deadline, team size, and available
hours. - Provide source URLs and research dates for external claims. -
State uncertainty and evidence gaps. Never claim an idea is completely
original based on a limited search. - Help the user build a worthwhile,
practical, potentially launchable result; do not promise commercial
success.

### Core modules and priority

  -----------------------------------------------------------------------
  Priority                Module                  Scope
  ----------------------- ----------------------- -----------------------
  P0                      Dashboard               One clear overview of
                                                  projects, today's
                                                  tasks, progress,
                                                  upcoming deadlines, and
                                                  quick actions

  P0                      Voice-to-text           Record idea, transcribe
                                                  through selected
                                                  provider, edit
                                                  transcript, then submit
                                                  to AI

  P0                      AI research/report and  Research existing
                          suggestions             solutions; compare;
                                                  recommend best
                                                  features, improvements,
                                                  MVP, risks, and sources

  P0                      Personalized roadmap    Generate milestones and
                                                  daily tasks based on
                                                  time, skills, deadline,
                                                  and project goals

  P0                      Tracker                 Task completion, daily
                                                  progress, overall
                                                  project progress,
                                                  milestone progress,
                                                  streaks

  P0                      Notifications           Daily reminders,
                                                  pending tasks, streak
                                                  warnings, deadlines,
                                                  achievements;
                                                  user-controlled
                                                  preferences

  P1                      GitHub integration      Secure account
                                                  connection, choose/link
                                                  repository, display
                                                  commits/issues/PR
                                                  activity, connect tasks
                                                  to issues where
                                                  feasible

  P1                      Project-aware AI chat   Answer using project
                                                  brief, research,
                                                  selected features,
                                                  roadmap, and current
                                                  progress

  P1                      Collaboration           Preserve/improve
                                                  existing team, invite,
                                                  comments, and
                                                  notifications if
                                                  already implemented

  P2                      Netlify deployment      Link a supported GitHub
                                                  repository, deploy,
                                                  show status and live
                                                  URL

  P3 / lowest             Code compiler/editor    Only after all higher
                                                  priorities are stable;
                                                  consider Monaco/editor
                                                  or sandboxed execution
                                                  as future scope
  -----------------------------------------------------------------------

**Compiler/editor is the lowest priority. Do not start it unless all
P0/P1 work is complete, tested, and there is sufficient time for
regression testing.**

------------------------------------------------------------------------

## 2. Current architecture --- verify, do not assume

Prior project documentation has described the following technologies,
but Claude must confirm each against the current repository before
relying on it:

-   Monorepo: PNPM / Turborepo
-   Mobile client: Expo / React Native
-   Backend: NestJS
-   Database: PostgreSQL / Prisma
-   Background jobs: Redis / BullMQ
-   Authentication: Clerk
-   AI orchestration: Vercel AI SDK and existing model provider(s)
-   Web research: Tavily
-   Landing page: existing web app/site

Do not replace the stack simply because another framework is available.
Preserve existing folder conventions and API contracts.

------------------------------------------------------------------------

## 3. Milestone 0 --- repository audit (no edits)

### Claude task

1.  Inspect repository structure and package manifests.
2.  Check branch and `git status`.
3.  Identify app entry points, frontend routes/screens, backend
    modules/controllers/services, Prisma schema/migrations, auth, AI,
    research, task/roadmap, notifications, collaboration, and
    integrations.
4.  Identify existing tests and commands.
5.  Run the smallest safe baseline checks: package manager/version,
    lint/typecheck/test/build commands that are already configured. Do
    not install or upgrade dependencies without approval.
6.  Map each feature in Section 1 to `Implemented`,
    `Partially implemented`, `Missing`, or `Broken`, with file
    references.
7.  Identify the smallest implementation sequence that fits the
    deadline.

### Deliverable

A compact audit table:
`Feature | Status | Relevant files | Missing work | Risk`

Also report: - Actual stack and versions - How to run app and backend -
Required environment variable *names only* (never values) - Database
migration command - Existing test commands - Any blockers

**Stop after the audit. Do not modify files. Ask for approval before
Milestone 1.**

### Audit smoke test

-   [ ] Repository opens and dependencies are understood.
-   [ ] Existing app/backend startup commands are identified.
-   [ ] Baseline lint/typecheck/test/build results are recorded.
-   [ ] No tracked files changed.

------------------------------------------------------------------------

## 4. Milestone 1 --- Dashboard (P0)

### Goal

Create or complete a useful dashboard that gives the user an immediate
understanding of what to do next.

### Suggested dashboard content

-   Greeting and project selector.
-   Today's task list with completion checkboxes.
-   Daily completion indicator (e.g., `2 of 4 tasks`).
-   Overall project progress.
-   Milestone progress and next milestone.
-   Upcoming deadlines / overdue items.
-   Streak and weekly activity summary.
-   Quick actions: capture idea, open project, add task.
-   Empty state for a new user with a clear "Create your first project"
    action.

### UX guidance

Keep the dashboard calm and readable. Use one primary action, clear
hierarchy, restrained colors, and responsive cards. Avoid clutter and
excessive charts. Use accessible labels and visible loading/error/empty
states.

Design references: - Material Design 3: https://m3.material.io/ -
Material 3 dashboard/layout guidance:
https://m3.material.io/foundations/layout/understanding-layout/overview -
Apple Human Interface Guidelines:
https://developer.apple.com/design/human-interface-guidelines/ - Expo UI
/ React Native docs: https://docs.expo.dev/ - Mobbin (reference library;
inspect patterns, do not copy): https://mobbin.com/ - Dribbble dashboard
inspiration (visual inspiration only):
https://dribbble.com/tags/productivity_dashboard

### Implementation rules

-   Reuse current dashboard components and API endpoints.
-   Do not create fake/demo metrics in production screens.
-   Use existing API data; if an endpoint is missing, add the smallest
    authenticated endpoint.
-   Handle loading, no-project, no-task, error, and offline states.
-   Keep calculations consistent with the Tracker milestone.

### Smoke test immediately after this feature

-   [ ] Existing user can sign in and open dashboard.
-   [ ] New user sees a useful empty state.
-   [ ] Existing project and task data display correctly.
-   [ ] Task completion updates the visible daily progress.
-   [ ] Project/milestone progress matches backend values.
-   [ ] Refresh/reopen does not lose state.
-   [ ] No crash on small screen / common device dimensions.
-   [ ] Run focused frontend tests, lint, and typecheck.
-   [ ] Run relevant backend tests if API changes were made.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 5. Milestone 2 --- Voice-to-text idea capture (P0)

### Goal

Allow a user to speak an idea, transcribe it, edit the transcript, and
submit it to the existing BLISP idea/project analysis flow.

### Provider research and official links

-   xAI API documentation: https://docs.x.ai/
-   xAI API reference: https://docs.x.ai/api
-   xAI speech-to-text documentation:
    https://docs.x.ai/docs/guides/audio
-   xAI pricing: https://x.ai/api
-   Expo Audio: https://docs.expo.dev/versions/latest/sdk/audio/
-   Expo permissions: https://docs.expo.dev/
-   NestJS file upload: https://docs.nestjs.com/techniques/file-upload

**Important pricing rule:** do not assume Grok/xAI speech-to-text is
free. Verify the current model name, endpoint, supported formats,
maximum file size/duration, language support, rate limits, and pricing
from official xAI documentation/account before implementation. If the
account has free credits or a promotional allowance, record its limits
and do not describe it as permanently free.

### UX flow

1.  User taps microphone.
2.  Explain/obtain microphone permission.
3.  Show recording state, elapsed time, and stop/cancel controls.
4.  User stops recording.
5.  Upload audio securely to backend.
6.  Backend calls the configured transcription provider.
7.  Display transcript in an editable text field.
8.  User corrects mistakes and confirms.
9.  Pass confirmed text to existing BLISP idea-analysis flow.
10. Show clear errors and allow retry.

### Technical rules

-   Use the existing Expo audio package if suitable; do not add a second
    recording library without reason.
-   Keep xAI key on backend only.
-   Validate file type, size, duration, user ownership, and request
    limits.
-   Do not log audio content or secrets.
-   Delete temporary audio after processing according to a clear
    retention policy; do not retain recordings by default without a
    product reason and user notice.
-   Create a provider abstraction such as `TranscriptionProvider` so
    provider changes do not require rewriting the UI.
-   Start with record → upload → transcribe → edit → submit. Real-time
    streaming is optional future work.
-   If provider access is unavailable, implement a clean provider
    interface and report the blocker; do not fake a successful
    transcription.

### Smoke test immediately after this feature

-   [ ] Microphone permission granted: recording starts and stops.
-   [ ] Permission denied: user receives helpful explanation and can
    retry via settings.
-   [ ] Valid recording transcribes successfully in the configured test
    account.
-   [ ] Transcript is editable before submission.
-   [ ] Confirmed transcript enters the existing idea flow exactly once.
-   [ ] Empty, too-large, unsupported, or failed audio produces a clear
    error.
-   [ ] API key is absent from client bundle and logs.
-   [ ] Test on a physical device/development build.
-   [ ] Run focused tests, lint, typecheck, and backend tests.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 6. Milestone 3 --- AI research, report, and feature recommendations (P0 --- signature feature)

### Goal

Transform the current idea analysis into an evidence-informed product
discovery and improvement report.

### Expected report sections

1.  User idea summary and assumptions.
2.  Problem statement and target users.
3.  Existing products / comparable solutions.
4.  Competitor and feature comparison.
5.  Strongest relevant features worth adopting.
6.  Gaps, weaknesses, and opportunities.
7.  Recommended features for this user's project.
8.  Proposed differentiators / unique value proposition.
9.  MVP scope: must-have, should-have, later.
10. Technical feasibility, suggested architecture, and stack.
11. Complexity, dependencies, risks, and rough effort.
12. Questions requiring user clarification.
13. Sources, URLs, and research date.

### AI behavior rules

-   Do not reject an idea because similar products exist.
-   Do not equate "existing product" with "no opportunity."
-   Recommend feature selection based on the user's context, not feature
    count.
-   Separate `Verified from sources`, `AI analysis`, and
    `Recommendation`.
-   Cite external claims with source title, URL, and retrieval/research
    date.
-   Do not invent sources, prices, adoption statistics, or product
    capabilities.
-   State when research is incomplete or sources disagree.
-   Avoid claiming a product is "best" without explaining criteria.
-   Ask only essential clarification questions; do not block useful
    initial research unnecessarily.
-   Explain why each recommended feature matters to the target user.
-   Do not overwhelm a beginner: provide an executive summary and
    expandable/detail sections if the existing UI supports them.

### Research provider

Reuse the existing Tavily integration if present and suitable: - Tavily
documentation: https://docs.tavily.com/ - Tavily API reference:
https://docs.tavily.com/documentation/api-reference/introduction -
Tavily search endpoint:
https://docs.tavily.com/documentation/api-reference/endpoint/search -
Tavily extract endpoint:
https://docs.tavily.com/documentation/api-reference/endpoint/extract

Do not add another search provider unless the existing one cannot meet a
documented requirement. Verify current API limits/pricing before relying
on a free tier.

### AI orchestration references

-   Vercel AI SDK: https://ai-sdk.dev/docs/introduction
-   Vercel AI SDK structured output:
    https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
-   NestJS providers: https://docs.nestjs.com/providers

### Implementation rules

-   Inspect existing idea-analysis and research services first.
-   Prefer a typed structured response schema with validation.
-   Persist report metadata, sections, source URLs, research timestamp,
    and project association using the current database conventions.
-   Handle provider errors, timeouts, partial research, and malformed
    model output.
-   Do not silently overwrite an approved report; preserve versions or
    ask before regeneration.
-   Ensure the report is scoped to the authenticated user's project.
-   Keep prompts concise and avoid sending unnecessary full conversation
    history.

### Smoke test immediately after this feature

-   [ ] A common idea (e.g., university LMS) is not rejected just
    because LMS products exist.
-   [ ] Report identifies comparable products and relevant features.
-   [ ] Recommendations explain why features fit the user's context.
-   [ ] Sources are clickable and correspond to retrieved results.
-   [ ] Unsupported claims are labelled as uncertain or omitted.
-   [ ] MVP and later-scope features are distinguishable.
-   [ ] Report is saved and can be reopened.
-   [ ] Regeneration does not silently destroy an approved report.
-   [ ] Malformed/failed AI response is handled safely.
-   [ ] Run focused service/controller/UI tests, lint, typecheck.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 7. Milestone 4 --- Personalized roadmap and task tracker (P0)

### Goal

Generate a practical schedule and make progress measurable.

### Inputs

Use existing project/user fields where available. Ask only for missing
essentials: - Desired completion date. - Available hours per day. -
Working days / rest days. - Skill level and relevant experience. -
Individual or team project. - Selected MVP features and dependencies.

### Roadmap output

-   Milestones with target dates.
-   Daily tasks with estimated effort.
-   Task dependencies and priority.
-   Acceptance criteria for important tasks.
-   Buffer time for testing and unexpected delays.
-   Clear distinction between MVP and later features.

### Tracker definitions

Use one consistent source of truth: - Daily completion = completed
planned tasks / total planned tasks for that day. - Overall project
progress should be weighted by estimated effort or defined task points,
not just raw task count. - Milestone progress should use the same
underlying task/effort rules. - A task should not be counted twice. -
Cancelled/deferred tasks should not distort completion percentages. -
Recalculate only remaining work when a user falls behind; preserve
completed work and avoid silently changing approved scope.

### UX guidance

-   A visible "Today" list.
-   Clear task status and priority.
-   Milestone timeline.
-   Daily and overall progress shown separately.
-   Weekly history and streak view.
-   "Reschedule remaining work" action with preview/confirmation.
-   Avoid shame-based language.

Design references: - Material Design progress indicators:
https://m3.material.io/components/progress-indicators/overview -
Material Design lists:
https://m3.material.io/components/lists/overview - Mobbin:
https://mobbin.com/ - Dribbble productivity dashboard:
https://dribbble.com/tags/productivity_dashboard

### Smoke test immediately after this feature

-   [ ] Roadmap respects the selected deadline and availability.
-   [ ] Tasks have sensible estimates and milestone links.
-   [ ] Completing a task updates daily, milestone, and overall progress
    correctly.
-   [ ] Reopening the app preserves completion state.
-   [ ] A missed day does not erase completed work.
-   [ ] Rescheduling preserves completed tasks and requests
    confirmation.
-   [ ] Zero-task days and cancelled tasks do not cause divide-by-zero
    or misleading percentages.
-   [ ] User cannot read or modify another user's project tasks.
-   [ ] Run focused tests, lint, typecheck, and relevant migration
    checks.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 8. Milestone 5 --- Notifications and streaks (P0)

### Goal

Send helpful reminders that bring users back to BLISP and encourage
consistent progress without creating notification fatigue.

### Notification types

-   Daily task reminder.
-   Pending-task reminder.
-   Streak-at-risk reminder.
-   Upcoming milestone/deadline reminder.
-   Daily completion celebration.
-   Weekly progress summary.
-   Roadmap rescheduling notice.

### Suggested defaults

-   Ask permission at an appropriate onboarding moment, not immediately
    on first launch.
-   Let users choose reminder time and working days.
-   Respect device timezone and quiet hours.
-   Provide per-category controls and a global off switch.
-   Limit duplicate reminders.
-   Use supportive wording, never guilt or pressure.

### Streak rules

-   A streak day is earned when the user completes at least one
    meaningful task on a scheduled working day.
-   Rest days should not break a streak.
-   Completing every planned task may earn a separate daily-completion
    achievement.
-   Define timezone and day-boundary rules on the backend.
-   If grace days are implemented, explain the rule to users.
-   Backend is the source of truth; do not trust client-only streak
    calculations.

### API / implementation references

-   Expo Notifications:
    https://docs.expo.dev/versions/latest/sdk/notifications/
-   Expo push notifications overview:
    https://docs.expo.dev/push-notifications/overview/
-   Expo push setup:
    https://docs.expo.dev/push-notifications/push-notifications-setup/
-   NestJS task scheduling:
    https://docs.nestjs.com/techniques/task-scheduling
-   BullMQ: https://docs.bullmq.io/
-   BullMQ repeatable jobs: https://docs.bullmq.io/guide/jobs/repeatable
-   PostgreSQL: https://www.postgresql.org/docs/

Use the existing Redis/BullMQ infrastructure if it is already working.
Do not introduce a second job scheduler without a clear reason.

### Smoke test immediately after this feature

-   [ ] User can opt in and register a device token.
-   [ ] User can opt out and update preferences.
-   [ ] Test push reaches a physical device/development build.
-   [ ] Daily reminder is sent at the configured local time.
-   [ ] Quiet hours and rest days are respected.
-   [ ] Streak warning appears only when the streak is genuinely at
    risk.
-   [ ] Completing one task updates streak state correctly.
-   [ ] Duplicate jobs/notifications are prevented.
-   [ ] Invalid/expired device tokens are handled.
-   [ ] User A cannot trigger or view User B's notification data.
-   [ ] Run focused tests and inspect scheduled job behavior.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 9. Milestone 6 --- GitHub integration (P1)

### Goal

Let a user connect a GitHub account, associate a repository with a BLISP
project, and see useful development activity.

### MVP scope

1.  Secure GitHub authorization.
2.  Show repositories the user can access.
3.  Link an existing repository to a BLISP project.
4.  Display repository name, owner, default branch, and URL.
5.  Display recent commits.
6.  Display issues and pull requests where API access permits.
7.  Optionally create a GitHub issue from a BLISP task.
8.  Link a BLISP task to its GitHub issue/PR.
9.  Show last sync time and useful connection errors.

Do not build a GitHub clone. Do not promise automatic code changes or AI
commits in this milestone.

### Official API and security references

-   GitHub REST API: https://docs.github.com/en/rest
-   GitHub repositories: https://docs.github.com/en/rest/repos
-   GitHub commits: https://docs.github.com/en/rest/commits
-   GitHub issues: https://docs.github.com/en/rest/issues
-   GitHub pull requests: https://docs.github.com/en/rest/pulls
-   GitHub Apps overview: https://docs.github.com/en/apps/overview
-   GitHub App authentication:
    https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app
-   OAuth Apps: https://docs.github.com/en/apps/oauth-apps
-   Webhooks: https://docs.github.com/en/webhooks
-   Webhook signature validation:
    https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

### Security rules

-   Prefer a GitHub App where its permission model fits; otherwise use
    the least-privilege supported OAuth approach.
-   Never ask users to paste personal access tokens into BLISP.
-   Store tokens server-side, encrypted at rest using the project's
    established secret-management approach.
-   Request minimum permissions.
-   Validate state/CSRF protections during authorization.
-   Validate webhook signatures.
-   Enforce project ownership and team permissions.
-   Never log tokens or return secrets to the client.
-   Use webhooks for updates if practical; avoid aggressive polling.
-   Handle revoked permissions and disconnected accounts.

### Smoke test immediately after this feature

-   [ ] User can authorize and return to BLISP.
-   [ ] User can see only repositories they are authorized to access.
-   [ ] User can link and unlink a repository.
-   [ ] Repository metadata and recent activity load.
-   [ ] Token is never exposed in client responses or logs.
-   [ ] Revoked/expired authorization produces a recoverable error.
-   [ ] Webhook signature validation rejects invalid requests.
-   [ ] Project-level access is enforced.
-   [ ] Test issue creation only if implemented and confirm it creates
    exactly one issue.
-   [ ] Run focused backend/frontend tests and security checks.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 10. Milestone 7 --- Project-aware AI assistant (P1)

### Goal

Give each project an AI assistant that understands its current approved
context.

### Context to use

-   Project idea and objectives.
-   Approved research report and recommendations.
-   Selected MVP features.
-   Technology stack and architecture.
-   Roadmap, milestones, and tasks.
-   Completed and pending work.
-   GitHub repository activity, if connected.

### Example actions

-   Explain today's task in beginner-friendly steps.
-   Break a task into subtasks.
-   Explain a technical concept.
-   Suggest how to implement an approved feature.
-   Summarize project progress.
-   Identify blockers and risks.
-   Suggest a roadmap adjustment.
-   Explain what remains before the next milestone.

### Rules

-   Reuse the existing AI service and provider.
-   Send only the relevant project context, not the entire database or
    all chat history.
-   Clearly distinguish project facts from suggestions.
-   Never claim a task is completed based only on chat.
-   Confirm before making consequential changes to the roadmap or tasks.
-   Enforce project membership and data isolation.

### References

-   Vercel AI SDK: https://ai-sdk.dev/docs/introduction
-   AI SDK tools:
    https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
-   NestJS authorization: https://docs.nestjs.com/security/authorization

### Smoke test

-   [ ] Assistant answers using the correct project's context.
-   [ ] It can explain a task and summarize actual progress.
-   [ ] It does not invent completed work.
-   [ ] It does not leak another project's context.
-   [ ] Roadmap/task changes require confirmation.
-   [ ] Provider failures and long responses are handled.
-   [ ] Run focused tests and lint/typecheck.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 11. Milestone 8 --- Collaboration verification (P1)

First audit existing team collaboration, invitations, comments, and
notifications. If these already work, do not rebuild them.

### Verify

-   Invite and accept/reject flow.
-   Project membership roles and permissions.
-   Task assignment.
-   Comments and activity history.
-   Notification visibility.
-   Removing a member and access revocation.

### Smoke test

-   [ ] Owner can invite a teammate.
-   [ ] Authorized teammate can access shared project.
-   [ ] Unauthorized user cannot access project.
-   [ ] Task assignments and comments persist.
-   [ ] Removing a member revokes access.
-   [ ] Run focused tests.

**If collaboration is already stable, spend this time on regression
testing rather than adding new features.**

------------------------------------------------------------------------

## 12. Milestone 9 --- Netlify deployment (P2)

### Goal

Demonstrate a limited, reliable deployment flow for a supported web
project connected to GitHub.

### MVP scope

-   Connect Netlify account securely.
-   Select/link a supported site or repository.
-   Trigger a deployment only where the API and permissions allow.
-   Show deployment status, timestamp, and live URL.
-   Show useful error information when deployment fails.

### Official references

-   Netlify API guide:
    https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/
-   Netlify API reference: https://open-api.netlify.com/
-   Netlify build/deploy docs: https://docs.netlify.com/build/
-   Netlify Git integration:
    https://docs.netlify.com/welcome/add-new-site/

### Rules

-   Verify current authentication and API capabilities before
    implementation.
-   Keep credentials server-side and apply least privilege.
-   Do not claim arbitrary projects can be deployed automatically.
-   Clearly list the supported framework/build configuration for the
    demo.
-   Avoid storing deployment secrets in project-visible fields.

### Smoke test

-   [ ] User can connect/select the intended Netlify site.
-   [ ] A supported test project deploys successfully.
-   [ ] Status and live URL are accurate.
-   [ ] Failed deployment shows a useful error.
-   [ ] Credentials are not exposed.
-   [ ] Run focused tests.

**Stop and report before continuing.**

------------------------------------------------------------------------

## 13. Milestone 10 --- Code editor/compiler (P3, absolute lowest priority)

**Do not begin until Dashboard, Voice-to-Text, Research,
Roadmap/Tracker, Notifications, GitHub, and required regression tests
are stable.**

If time remains: - Consider Monaco Editor for a web-based code editor:
https://microsoft.github.io/monaco-editor/ - Monaco is a web editor
component; it is not a complete cloud IDE. - For code execution, use a
properly isolated sandbox/service. Never execute arbitrary user code
directly inside the NestJS server. - Piston reference:
https://github.com/engineer-man/piston - VS Code extension
documentation: https://code.visualstudio.com/api

Preferred first increment: save/view code snippets attached to a project
task. Defer execution, terminals, full IDE, and VS Code extension unless
the core application is already complete.

### Smoke test if implemented

-   [ ] Editor loads only where supported.
-   [ ] Snippets save and reopen.
-   [ ] User/project access is enforced.
-   [ ] No arbitrary code executes on the application server.
-   [ ] Test on supported screen sizes.

------------------------------------------------------------------------

## 14. Shared UI/UX direction

### Visual language

-   Modern, clean productivity product.
-   Dark mode may be the default if consistent with the existing
    product; provide a readable light mode if already supported.
-   Use a restrained palette and consistent spacing.
-   Keep typography readable and hierarchy obvious.
-   Use progress visuals sparingly and meaningfully.
-   Make the next action obvious on every screen.
-   Use skeleton/loading, empty, error, success, and offline states.
-   Design for mobile first; verify web layouts if the product supports
    web.
-   Accessibility: contrast, touch target size, labels, focus order, and
    screen-reader semantics.

### Design systems and inspiration

-   Material 3: https://m3.material.io/
-   Apple Human Interface Guidelines:
    https://developer.apple.com/design/human-interface-guidelines/
-   Expo: https://docs.expo.dev/
-   Mobbin pattern library: https://mobbin.com/
-   Dribbble productivity dashboard inspiration:
    https://dribbble.com/tags/productivity_dashboard
-   Dribbble task management inspiration:
    https://dribbble.com/tags/task_management
-   Dribbble voice assistant inspiration:
    https://dribbble.com/tags/voice_assistant
-   Dribbble analytics dashboard inspiration:
    https://dribbble.com/tags/analytics_dashboard
-   Figma Community: https://www.figma.com/community

These are reference and inspiration links, not pre-generated BLISP
mockups. Do not copy a design verbatim. Follow the existing BLISP brand
and design tokens.

------------------------------------------------------------------------

## 15. Testing strategy --- smoke test after EVERY feature

A smoke test is a short, focused check that proves the main user journey
still works after a change. It is not a replacement for unit/integration
tests.

### After every milestone

1.  Start the changed service/app using the repository's documented
    commands.
2.  Test the main happy path manually.
3.  Test at least one failure/empty/permission path.
4.  Verify data persists after refresh/reopen.
5.  Verify authentication and project ownership if an API/data change
    was made.
6.  Run focused tests for changed code.
7.  Run lint and typecheck for affected workspace(s).
8.  Run a relevant build or regression check before merging.
9.  Inspect `git diff` and `git status`.
10. Commit only after the user accepts the milestone.

### Final end-to-end smoke test

Use a fresh test account and a sample project: - \[ \] Sign up/sign
in. - \[ \] Open dashboard and create/select a project. - \[ \] Record
an idea, transcribe, edit, and submit. - \[ \] Generate research report
and verify source links. - \[ \] Review/select recommended features. -
\[ \] Generate roadmap using a deadline and daily availability. - \[ \]
Complete a task and verify daily/project progress. - \[ \] Receive a
test reminder on a physical device. - \[ \] Verify streak changes
correctly. - \[ \] Connect GitHub and link a test repository. - \[ \]
View repository activity. - \[ \] Use project-aware AI assistant. - \[
\] Test team collaboration if included. - \[ \] Deploy a supported web
project to Netlify if included. - \[ \] Verify logout and data
isolation.

Never use real confidential project/user data for demonstration. Keep
test credentials and API keys out of screenshots and recordings.

------------------------------------------------------------------------

## 16. Suggested execution window

The deadline is tight. This is a priority sequence, not a promise that
every integration can be completed.

  -----------------------------------------------------------------------
  Date                                Focus
  ----------------------------------- -----------------------------------
  10 Nov                              Repository audit, baseline tests,
                                      dashboard gaps

  11 Nov                              Dashboard completion and smoke test

  12 Nov                              Voice-to-text integration and smoke
                                      test

  13 Nov                              Research/report/feature
                                      recommendations and smoke test

  14 Nov                              Roadmap, tracker, progress
                                      calculations

  15 Nov                              Notifications, reminders, streaks

  16 Nov                              GitHub integration and
                                      project-aware AI, based on audit
                                      complexity

  17 Nov                              Integration, collaboration
                                      verification, optional Netlify

  18 Nov                              Feature freeze, full regression and
                                      end-to-end smoke test

  19 Nov                              Report, diagrams, screenshots, demo
                                      preparation

  20 Nov                              Final submission
  -----------------------------------------------------------------------

If a feature threatens stability, reduce its scope. Do not sacrifice
testing to claim more features.

------------------------------------------------------------------------

## 17. Standard Claude Code prompt for each milestone

Copy this prompt and replace the milestone name:

``` text
Work ONLY on: [MILESTONE NAME] from BLISP_IMPLEMENTATION_PLAN.md.

First inspect only the files relevant to this milestone and check git status.
Do not reread the entire repository unless necessary.
Do not modify unrelated features or refactor working architecture.

Before editing:
1. Briefly state the current implementation you found.
2. List the exact files you intend to change.
3. Identify any dependency or database migration.
4. State the acceptance criteria and focused smoke tests.

Then implement the smallest complete version using existing patterns.
Keep secrets server-side. Enforce authentication and project-level authorization.
Do not invent successful API responses or mock a real integration.
Do not add dependencies without explaining why.

After implementation:
1. Run focused tests.
2. Run relevant lint/typecheck.
3. Perform the milestone smoke test.
4. Inspect git diff and git status.
5. Report changed files, commands, test results, known issues, and a suggested commit message.

Do not start another milestone. Stop and wait for my approval.
```

### Compact smoke-test prompt

``` text
Smoke-test ONLY the feature just implemented.
Inspect the relevant code and existing test commands.
Run the focused happy path, one failure/empty path, persistence check,
authorization check if applicable, and relevant lint/typecheck/tests.
Do not change unrelated files.
Fix only defects directly related to this feature, rerun the failed checks,
and report exact results. Do not claim a test passed unless it ran successfully.
```

------------------------------------------------------------------------

## 18. Definition of done

A feature is not done because the screen looks complete. It is done only
when: - The real user flow works. - Data persists correctly. - Loading,
empty, and error states exist. - Authentication and authorization are
enforced. - Secrets are protected. - Focused tests and smoke tests
pass. - Existing core flows still work. - The user has reviewed and
approved the milestone.

**Final instruction:** Build a stable, coherent BLISP experience. The
strongest FYP demonstration is one complete journey from voice idea →
research-informed recommendations → personalized roadmap → daily task
completion and motivation → GitHub/deployment visibility. Do not spend
precious time building a compiler before this journey works.


---

## 19. Repository-specific starting note

The public repository page was reachable during preparation and currently identifies `usman-faisal/blisp` as a public repository. Its visible root listing includes `apps/`, `packages/`, `CLAUDE.md`, `CODEX.md`, `docker-compose.yaml`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and `turbo.json`.

Repository page: https://github.com/usman-faisal/blisp

This is only a shallow public listing, not a source-code audit. Claude Code must clone/open the actual current checkout, read `CLAUDE.md` and `CODEX.md`, inspect the apps/packages, and verify the real implementation before changing anything. Do not infer feature status from the root listing.

### Reference verification notes
- xAI's current Speech-to-Text guide documents `grok-voice-transcribe-2.0`, REST transcription at `https://api.x.ai/v1/stt`, and a streaming WebSocket endpoint at `wss://api.x.ai/v1/stt`. Confirm current model/endpoint details again before coding: https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
- xAI's published Speech-to-Text pricing page currently lists REST and streaming prices. Do not label the API free without checking the user's account/credits and the live pricing page: https://docs.x.ai/developers/models/speech-to-text
- Expo's current push setup requires notification permission and an Expo push token; follow the setup and device credential steps for the actual target platforms: https://docs.expo.dev/push-notifications/push-notifications-setup/
- GitHub recommends GitHub Apps over OAuth Apps in many integration scenarios; choose permissions narrowly: https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api

**Design-link clarification:** the earlier visual suggestions were generated as image inspiration, not as custom Figma files or finished BLISP screen designs. The design URLs in this plan are public reference libraries, design-system documentation, and inspiration searches. Use them as guidance, not as assets or screens to copy.
