#!/usr/bin/env bash
#
# End-to-end smoke test: one voice-style prompt all the way to a verified
# completion, across two real accounts.
#
#   voice prompt -> project -> roadmap -> invite -> notification -> accept
#   -> assign -> notify -> complete -> verification verdict -> notify owner
#
# plus the authorization, rate-limit and header checks that have no UI.
#
# Every step asserts rather than printing, so a regression fails loudly instead
# of scrolling past. Steps that depend on an id abort the run when it is
# missing: an assertion of the form "must NOT contain X" would otherwise pass
# against a 404 body and report a check that never ran.
#
# Usage, with the backend and docker services up:
#
#   ./scripts/smoke-test.sh
#   REUSE_PROJECT=<uuid> ./scripts/smoke-test.sh   # skip the LLM pipeline
#
# REUSE_PROJECT repeats the collaboration half without spending LLM and search
# quota on a fresh roadmap each time. Use it while iterating; leave it unset for
# the real run, which exercises the pipeline too.
#
# Requires ENABLE_DEV_TOKENS=true (development only — the endpoint mints a token
# for any user without a password).
set -uo pipefail

API="${API:-http://localhost:8080/api/v1}"
DIR="$(mktemp -d)"
trap 'rm -rf "$DIR"' EXIT

# Two real accounts: an owner and someone to collaborate with. Override with
# OWNER_ID / COLLAB_ID to run against different users.
OWNER_ID="${OWNER_ID:-user_3Lumc8Bdtsdaz91x004fxqjC7Fa}"   # mustafabusiness@gmail.com
COLLAB_ID="${COLLAB_ID:-user_3Hlenu6MUb6rcoamEQCM0x47SeZ}" # mustafaawarind@gmail.com

# Tokens are minted here rather than read from disk so the script is runnable
# from a clean checkout. Needs ENABLE_DEV_TOKENS=true, which is dev-only.
mint() { curl -s "$API/dev/token/$1" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }
B="$(mint "$OWNER_ID")"
C="$(mint "$COLLAB_ID")"

if [ -z "$B" ] || [ -z "$C" ]; then
  printf '\033[31mCould not mint dev tokens.\033[0m Is the backend running with ENABLE_DEV_TOKENS=true?\n'
  exit 1
fi

PASS=0; FAIL=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
step() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

assert() {
  if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 — got '$2', wanted '$3'"; fi
}
assert_contains() {
  case "$2" in *"$3"*) ok "$1";; *) bad "$1 — '$3' not in: $(printf '%s' "$2" | head -c 250)";; esac
}
refute_contains() {
  case "$2" in *"$3"*) bad "$1 — '$3' WAS present";; *) ok "$1";; esac
}

api()  { curl -s -H "Authorization: Bearer $B" "$@"; }
apic() { curl -s -H "Authorization: Bearer $C" "$@"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
json() { printf '%s' "$1" | sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p" | head -1; }

step "0. Preconditions"
assert "backend reachable" "$(code "$API/")" "200"
ME="$(api "$API/auth/me")"
assert_contains "owner is mustafabusiness@gmail.com" "$ME" "mustafabusiness@gmail.com"
MEC="$(apic "$API/auth/me")"
assert_contains "collaborator authenticates" "$MEC" "@gmail.com"
assert "no token is rejected" "$(code "$API/auth/me")" "401"

step "1. Brain dump -> project (voice-first entry point)"
# REUSE_PROJECT lets the collaboration half of the run be repeated without
# spending LLM and Tavily quota on a fresh pipeline each time. The dump itself
# is still exercised on an unset run.
if [ -n "${REUSE_PROJECT:-}" ]; then
  PROJECT_ID="$REUSE_PROJECT"
  ok "reusing project $PROJECT_ID (set REUSE_PROJECT= to run the pipeline)"
else
  DUMP='{"prompt":"I want to build a small expense splitter for shared houses. People add expenses, it works out who owes who, and settles up at the end of the month. Needs login, a group, and a simple balance screen."}'
  BD="$(api -X POST -H 'Content-Type: application/json' -d "$DUMP" "$API/brain-dumps")"
  # A dump can yield several projects; take the first id inside "projects":[...].
  PROJECT_ID="$(printf '%s' "$BD" | sed -n 's/.*"projects":\[{"id":"\([^"]*\)".*/\1/p' | head -1)"
fi
if [ -n "$PROJECT_ID" ]; then
  [ -n "${REUSE_PROJECT:-}" ] || ok "brain dump accepted -> project $PROJECT_ID"
else
  bad "no project id: $(printf '%s' "${BD:-}" | head -c 400)"
fi

# Everything below addresses this project by id. Without one the URLs collapse
# to /projects//... which 404s, and assertions written as "must NOT contain X"
# would pass against an error body — reporting success for steps that never ran.
if [ -z "$PROJECT_ID" ]; then
  printf '\n\033[31mABORT: no project was created, so no downstream step can be trusted.\033[0m\n'
  exit 1
fi

step "2. Project readable by its owner"
P="$(api "$API/projects/$PROJECT_ID")"
assert_contains "project fetched" "$P" "$PROJECT_ID"
echo "  title: $(json "$P" "title")"

step "3. Tasks generated on the project"
# Task planning runs on a BullMQ worker, so the project exists before its tasks
# do. Poll rather than read once: a bare read races the worker and reports an
# empty roadmap as a failure.
TASK_ID=""
for attempt in $(seq 1 30); do
  P="$(api "$API/projects/$PROJECT_ID")"
  TASK_ID="$(printf '%s' "$P" | sed -n 's/.*"tasks":\[{"id":"\([^"]*\)".*/\1/p' | head -1)"
  [ -n "$TASK_ID" ] && break
  sleep 4
done
TASK_COUNT="$(printf '%s' "$P" | grep -o '"status":"TODO"\|"status":"IN_PROGRESS"\|"status":"DONE"' | wc -l)"
if [ -n "$TASK_ID" ]; then ok "$TASK_COUNT tasks, first = $TASK_ID"
else bad "no tasks found on project"; fi

if [ -z "$TASK_ID" ]; then
  printf '\n\033[31mABORT: no task to assign, complete or verify.\033[0m\n'
  exit 1
fi

# Steps 4–9 describe a project the collaborator has NOT joined yet. Re-running
# against a project they already belong to reports failures that are the server
# behaving correctly — a non-member check passing with 200 because they are now
# a member, and a second invite correctly rejected as a duplicate. Detect that
# and say so, rather than letting it read as a regression.
MEMBERS_NOW="$(api "$API/projects/$PROJECT_ID/members")"
ALREADY_MEMBER=0
case "$MEMBERS_NOW" in *"$COLLAB_ID"*) ALREADY_MEMBER=1;; esac

if [ "$ALREADY_MEMBER" = "1" ]; then
  printf '\n\033[33mNOTE\033[0m collaborator is already a member of this project.\n'
  printf '     Steps 4-9 (invite flow) need a project they have not joined.\n'
  printf '     Re-run without REUSE_PROJECT for a full invite test.\n'
fi

step "4. Authorization — a non-member is shut out"
# Always valid: no token is no token, member or not.
assert "anonymous gets 401" "$(code "$API/projects/$PROJECT_ID")" "401"

if [ "$ALREADY_MEMBER" = "1" ]; then
  printf '  \033[33mSKIP\033[0m non-member checks — they already joined this project\n'
else
  assert "non-member gets 404 on project" "$(code -H "Authorization: Bearer $C" "$API/projects/$PROJECT_ID")" "404"
  assert "non-member gets 404 on task" "$(code -H "Authorization: Bearer $C" "$API/tasks/$TASK_ID")" "404"
fi

if [ "$ALREADY_MEMBER" = "1" ]; then
  step "5-8. Invitation flow"
  printf '  \033[33mSKIP\033[0m they already joined — needs a project they are not in\n'
else
  step "5. Owner invites the collaborator"
  INV="$(api -X POST -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$COLLAB_ID\"}" "$API/projects/$PROJECT_ID/invites/user")"
  INVITE_ID="$(json "$INV" "id")"
  if [ -n "$INVITE_ID" ]; then ok "invitation sent ($INVITE_ID)"
  else bad "invite failed: $(printf '%s' "$INV" | head -c 400)"; fi

  step "6. Collaborator SEES the pending invitation"
  MYINV="$(apic "$API/invites/pending")"
  assert_contains "invitation visible to invitee" "$MYINV" "$PROJECT_ID"

  step "7. Collaborator RECEIVES an in-app notification"
  sleep 1
  NC="$(apic "$API/notification")"
  # Notifications carry a typed enum, not the raw task id. An invite carries
  # inviteId and a null url by design: the invitee is not a member yet, so a
  # /project/<id> link would 404 for them. Accept/decline hang off inviteId.
  assert_contains "invite notification delivered" "$NC" "PROJECT_INVITE"
  assert_contains "invite notification carries its inviteId" "$NC" "\"inviteId\":\"$INVITE_ID\""

  step "8. Collaborator ACCEPTS the invitation"
  ACC="$(apic -X POST "$API/invites/$INVITE_ID/accept-invite")"
  assert_contains "accept succeeded" "$ACC" "success"
  assert "collaborator can now READ the project" "$(code -H "Authorization: Bearer $C" "$API/projects/$PROJECT_ID")" "200"
fi

step "9. Membership visible"
M="$(api "$API/projects/$PROJECT_ID/members")"
assert_contains "collaborator listed as a member" "$M" "$COLLAB_ID"

step "10. Owner assigns the task to the collaborator"
ASG="$(api -X PATCH -H 'Content-Type: application/json' \
  -d "{\"assigneeId\":\"$COLLAB_ID\"}" "$API/tasks/$TASK_ID/assign")"
assert_contains "task assigned to collaborator" "$ASG" "$COLLAB_ID"

step "11. Collaborator NOTIFIED of the assignment"
sleep 1
NC2="$(apic "$API/notification")"
assert_contains "assignment notification received" "$NC2" "TASK_ASSIGNED"

step "12. Collaborator marks the task DONE"
D="$(apic -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"DONE"}' "$API/tasks/$TASK_ID/status")"
assert_contains "status moved to DONE" "$D" "DONE"

step "13. VERIFICATION — DONE without evidence is not trusted"
V="$(api "$API/projects/$PROJECT_ID/github/tasks/$TASK_ID/verification")"
echo "  $(printf '%s' "$V" | head -c 220)"
# Assert the call succeeded FIRST. A bare "must not contain VERIFIED" would
# also pass against a 404 body, reporting a check that never ran.
assert_contains "verification endpoint answered" "$V" "\"success\":true"
refute_contains "not marked VERIFIED without evidence" "$V" "\"verdict\":\"VERIFIED\""

step "14. Project-wide verification summary"
VP="$(api "$API/projects/$PROJECT_ID/github/verification")"
echo "  $(printf '%s' "$VP" | head -c 220)"
assert_contains "summary returned" "$VP" "\"success\":true"

step "15. Owner NOTIFIED that the assignee completed it"
sleep 1
NO="$(api "$API/notification")"
assert_contains "completion notification to owner" "$NO" "TASK_COMPLETED"
assert_contains "owner also told the member joined" "$NO" "MEMBER_JOINED"

step "16. Notification read-state round trip"
NID="$(json "$NO" "id")"
if [ -n "$NID" ]; then
  assert "mark one as read" "$(code -X PATCH -H "Authorization: Bearer $B" "$API/notification/$NID/read")" "200"
  assert "mark all as read" "$(code -X PATCH -H "Authorization: Bearer $B" "$API/notification/read-all")" "200"
else
  bad "no notification id available"
fi

step "17. Rate limiting is live"
RL=""
for i in $(seq 1 12); do
  RL="$(code -X POST -H "Authorization: Bearer $B" -F "audio=@/dev/null;filename=x.m4a" "$API/transcription/audio")"
done
assert "transcription throttles after 10/min" "$RL" "429"
assert "ordinary routes unaffected by it" "$(code -H "Authorization: Bearer $B" "$API/auth/me")" "200"
assert "collaborator has their own budget" \
  "$(code -X POST -H "Authorization: Bearer $C" -F "audio=@/dev/null;filename=x.m4a" "$API/transcription/audio")" "400"

step "18. Security headers"
H="$(curl -s -D - -o /dev/null "$API/")"
assert_contains "nosniff present" "$H" "X-Content-Type-Options: nosniff"
assert_contains "frameguard present" "$H" "X-Frame-Options"
refute_contains "X-Powered-By removed" "$H" "X-Powered-By"

step "19. No secret leaks in any response seen above"
ALL="$P$M$NO$VP"
refute_contains "no accessToken in payloads" "$ALL" "accessToken"
refute_contains "no api key in payloads" "$ALL" "sk-"

printf '\n\033[1m==================== RESULT ====================\033[0m\n'
printf '  passed: \033[32m%s\033[0m   failed: \033[31m%s\033[0m\n' "$PASS" "$FAIL"
printf '  project: %s\n  task:    %s\n' "$PROJECT_ID" "$TASK_ID"
[ "$FAIL" -eq 0 ] || exit 1
