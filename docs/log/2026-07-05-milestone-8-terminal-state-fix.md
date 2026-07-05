---
date: 2026-07-05
task: milestone-8-terminal-state-fix
---

# Milestone 8 follow-up: accept/discard terminal-state bug found and fixed

## What changed

Did the live API-level verification of Milestone 8's new endpoints
that the earlier log entry deferred to the user. Found a real bug in
both directions:

- A **discarded** draft could still be accepted afterward — the
  status silently flipped `discarded → accepted` and genuinely called
  the stub CMS adapter (a fresh `acceptedCmsPrescriptionRef` was
  issued). In a real system this would mean a doctor's explicit
  "discard" decision gets silently overridden and submitted as a real
  prescription later.
- The same bug existed in reverse: an **accepted** draft (already
  "submitted" to the CMS, with a real `acceptedCmsPrescriptionRef`)
  could still be discarded afterward, which would leave this module's
  own record showing `discarded` while the CMS still has the submitted
  prescription — a state inconsistency an auditor would have no way to
  reconcile.

Both use-cases only guarded against re-doing their *own* terminal
state (accept-after-accept, discard-after-discard) but not the
*other* one. Fixed by adding an explicit `BadRequestException` in each
use-case when the draft is already in the other terminal state.
Verified live against three fresh recordings run through the real
pipeline: `discard` → `accept` now correctly 400s
("This draft was discarded and cannot be accepted."), and `accept` →
`discard` now correctly 400s ("This draft was already accepted and
cannot be discarded.").

Also verified (before finding the bug) that the happy paths work
correctly against real data: `PATCH .../extraction` correctly writes
to `edited_extraction` without touching the original `extraction`,
`status` transitions `draft → edited` as expected, and `accept`
correctly no-ops on a second call (same `acceptedCmsPrescriptionRef`
and original `reviewedByRef`, not a re-submission).

## Files touched

- `apps/api/src/modules/clinical-ai/application/accept-review-draft.use-case.ts`
  — throws if `status === 'discarded'`.
- `apps/api/src/modules/clinical-ai/application/discard-review-draft.use-case.ts`
  — throws if `status === 'accepted'`.

## Decisions made

- No ADR — this is a bug fix to already-decided behavior (accept/discard
  are supposed to be terminal per architecture.md §7 stage 12/13's
  framing of "doctor accepts or discards"), not a new design decision.

## Follow-ups / left undone

- Live browser click-through (actually using `ReviewDraftPanel` in the
  UI, not just its backing endpoints) is still the user's to do — this
  entry only covers direct API-level verification.
