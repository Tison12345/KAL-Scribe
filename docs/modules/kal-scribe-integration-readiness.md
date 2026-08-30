---
module: kal-scribe-integration-readiness
last_updated: 2026-08-29
---

> **Canonical copy lives on the CMS side:**
> `C:\Users\Preetham\Desktop\KAL-clinic-management-solution\context\dev-notes\kal-scribe-integration-readiness.md`.
> That file is being actively edited from both repos (kal-scribe robustness work, CMS-side schema
> verification) — treat it as the source of truth if this copy and that one ever drift. This copy exists so
> kal-scribe's own docs/INDEX.md can point at it and so a kal-scribe-only reader doesn't need cross-repo
> access to see current status.

# Kal-Scribe Robustness Plan (structure-preserving, not integrating yet)

**Source audit:** `kal-scribe-production-readiness-audit.md` (production-readiness score 38/100, static
read-only inspection of the kal-scribe repo — `apps/web`, `apps/api`, `workers/clinical-ai-worker`,
`packages/*`, DB schema).

**Current intent:** kal-scribe is **not being wired into the CMS yet.** The goal right now is to make it
robust as a standalone system, while shaping its schema and conventions to stay close enough to the CMS's
actual schema (`supabase/migrations/002_clinic_management_schema.sql`,
`supabase/migrations/112_audit_log.sql`) that a future merge is a small diff instead of a rewrite.

**How to read this doc:**

- **§1–3 ("Do now")** — robustness fixes and structural conventions to adopt today, entirely inside
  kal-scribe, with no dependency on the CMS. These are the actionable items.
- **§4–6 ("Reference for later")** — the actual integration design (shared-DB decision, the CMS write
  path, auth reuse). Kept in this doc so the earlier analysis isn't lost, but **none of it should be
  started until integration is explicitly kicked off.**
- Authentication/authorization (audit findings D1–D4) are a separate track either way and stay out of
  scope here except where noted.

---

## 1. Robustness fixes — do now, standalone

These are audit findings that are real regardless of integration or auth status — they matter simply
because kal-scribe holds real patient audio and clinical text today.

**Critical / do first:**

- **D5 — silent job-stall bug. FIXED** (kal-scribe branch `robustness/audit-fixes`, 2026-08-29).
  `processTranscriptionJob`'s guard (`workers/clinical-ai-worker/src/main.ts`) no longer treats "a
  transcript exists" as proof the job finished. It now also calls a new `listRecordingJobs` client
  function (`GET /clinical-ai/recordings/:id/jobs`) to check whether an extraction job was actually
  enqueued; if not, it self-heals by enqueueing extraction now instead of silently returning. Not the
  single-transaction approach originally proposed here — a self-healing check on retry, functionally
  equivalent for this failure mode and simpler than adding a new "extraction pending" status.
- **D7 — full transcript text logged to stdout in cleartext. FIXED** (same branch). The log line in
  `main.ts` that printed every segment's verbatim text now logs only shape/metadata — segment count,
  per-speaker segment counts, detected languages. No clinical content in logs.

**High:**

- **E1 — no timeout on Gemini/Groq calls. FIXED** (kal-scribe branch `robustness/audit-fixes`,
  2026-08-29). Both providers' request calls (`gemini-provider.ts`'s `generate()`,
  `groq-provider.ts`'s `callAndValidate()`) now pass `signal: AbortSignal.timeout(120_000)` and surface a
  clear "timed out after Nms" error instead of hanging indefinitely.
- **E5 — connection budget already near the cap. FIXED** (kal-scribe branch `robustness/audit-fixes`,
  2026-08-29). The worker's pg-boss instance now sets `useListenNotify: false` (`main.ts`), reclaiming the
  one connection it was holding beyond its own `max: 4` pool — the only one of the three pools that hadn't
  already disabled it. Trades near-instant job pickup for poll-interval pickup, an acceptable trade for
  this workload. Pool sizing itself unchanged; still worth revisiting before a second worker replica.
- **CORS fully open. FIXED** (same branch). `apps/api/src/main.ts` now restricts origins via a new
  `WEB_APP_ORIGIN` env var (comma-separated, required for any real deployment); unset falls back to
  permissive localhost-only (any port) for local dev.

**Medium — real but not urgent:**

- **E2 — no chunk-level DB tracking. PARTIALLY DONE** (same branch). Added `consultation_recording_chunks`
  (recording_id + sequence, unique-indexed) and a `POST :id/chunks/:sequence/confirm` endpoint the browser
  now calls right after a chunk's PUT actually succeeds (`useUploadSession.ts`), plus `GET :id/chunks` to
  read confirmed chunks back. This is the missing server-side half — chunk existence is no longer purely
  implicit (read-URL-404-or-not). **Still open:** this doesn't yet drive an actual resume-on-reload UX —
  that needs the frontend to load this list on reopen and reconcile it against the browser's own recorder
  state, a separate follow-up. Worker-side transcription still restarts from chunk 0 on any retry (no
  partial-audio checkpointing).
- **E3 — no extraction-stage idempotency. FIXED** (same branch). `processExtractionJob` now checks (via
  the same `listRecordingJobs` call D5 added) whether *this specific job* already reached `completed`
  status before calling the LLM — distinguishes a retry of the same job (skipped) from a genuinely new
  extraction request (a different job id, still allowed — runs stay intentionally multi-valued).
- **E4 — no content-hash audio deduplication. FIXED** (same branch). The worker now computes a sha256 of
  the stitched audio (`computeAudioHash`), persists it on `consultation_recordings.audio_hash`, and asks a
  new `GET :id/duplicate-transcript?audioHash=` endpoint whether another recording already has a transcript
  for that exact hash before calling Gemini — if found, copies that transcript (tagged
  `dedup-reuse:<original provider>`, zero tokens billed) instead of re-transcribing.
- **E7 — no retention/deletion policy. BLOCKED, not implemented.** `ADR-0004` already proposes a 90-day
  default but explicitly states it's "a placeholder engineering default, not a compliance-reviewed policy"
  pending legal/compliance sign-off — implementing deletion logic without that sign-off would be
  overstepping a decision that isn't this pass's to make. (Note if/when this does get built: ADR-0004's
  "BullMQ repeatable cleanup job" wording predates the pg-boss migration, ADR-0015 — would need pg-boss's
  own scheduling instead.)
- **E8 — transcription stage has no model/prompt-version tracking. FIXED** (same branch). Added
  `model`/`prompt_version` columns to `consultation_transcripts`, a new `TRANSCRIPTION_PROMPT_VERSION`
  constant (`gemini-provider.ts`, mirroring `EXTRACTION_PROMPT_VERSION`), threaded through
  `SpeechUnderstandingMetadata` → the worker → `createTranscript`'s request → the DB and back out through
  every transcript-returning endpoint.

**Low, cheap, worth batching in:**

- **Structured logging (Pino/nestjs-pino) — deliberately NOT done this pass.** Genuinely the largest
  remaining item: touches dozens of call sites across both `apps/api` and the worker, plus real decisions
  (log levels, redaction config, output format) that are worth a proper look rather than rushing into an
  existing pass. Still the single highest-leverage remaining item per the original audit.
- `estimated_cost_usd` is a real column but always null — no pricing table maintained; low priority, not
  done this pass.
- Link extraction runs to a git commit SHA (`code_version` column) — small schema change, not done this
  pass; would pair naturally with the structured-logging work above (both are "add operational context" in
  the same spirit).

---

## 2. Structural conventions to adopt now (no CMS dependency)

These don't require touching the CMS or deciding the shared-DB question — they're changes to kal-scribe's
own schema/behavior that happen to make a future merge smaller. Doing them now, while the schema is still
easy to change, is cheaper than doing them as part of an integration crunch later.

**2.1 Reference columns stay `text` for now — deliberately deferred, not forgotten.**
`consultation_ai_sessions.consultation_session_ref`, `consultation_ai_sessions.doctor_id_ref`,
`consultation_reviews.reviewed_by_ref`, and `consultation_ai_audit_log.actor_ref` are free `text` holding
arbitrary placeholder strings (confirmed: `doctorIdRef: "test-doctor"`, used throughout the README and dev
workflow, not an isolated fixture). Retyping to `uuid` now isn't a free mechanical change — it would break
that convention outright and forces a real decision (what does a doctor ID look like before the CMS side
exists to define one) that doesn't have a good answer yet, this early.

**Decision: leave as-is for now, revisit specifically when kal-scribe's own auth work starts** — that's the
point at which "what identifies a doctor" gets answered for real anyway, so the retype and any FK addition
become one natural step instead of an interim convention now followed by a second change later. Nothing to
do here in this phase.

**2.2 Add a `facility_id uuid` column now, nullable, no FK yet. DONE** (kal-scribe branch
`robustness/audit-fixes`, 2026-08-29). Added to `consultation_ai_sessions`
(`apps/api/src/infrastructure/database/schema/consultation-ai-sessions.schema.ts`, migration
`0003_last_warpath.sql`) — nullable, no FK, exactly as scoped here. Confirmed `facility_id` is a real,
pervasive CMS convention before adding it (appears in 5+ CMS migration files, not just the base schema).
Left unpopulated everywhere for now, as intended — nothing writes a real value into it yet.

**2.3 Enforce one-AI-session-per-consultation now.**
`consultation_ai_sessions` is described as "root entity, one per CMS-side consultation." Add a `unique`
constraint on `consultation_session_ref` now if that's the real intent — right now nothing stops two AI
sessions from being created against the same session ref, and that ambiguity will just get harder to
resolve once real data exists.

**2.4 Don't hardcode facility-configurable vocabulary — RESOLVED, confirmed from both sides.**
Checked against `packages/validation/src/clinical-extraction.schema.ts`: `prakrithi`, `dosha`, `dietEat`,
`dietAvoid`, `lifestyleMaintain`, `lifestyleAvoid` are already plain `z.string()`/`string[]` — free text,
not hardcoded enums. The only real enums are `aama` (a 0-3 severity scale) and
`srotasDisturbanceType`/`srotasStatus`.

Checked from the CMS side (`app/components/clinical/ExaminationSection.tsx`,
`app/components/clinical/SrotasSection.tsx`, and the existing inventory in
`context/dev-notes/audit-hardcoded-dropdown-options.md`) whether those two are actually facility-configurable
in the CMS, despite `admin_config`'s table comment listing `prakrithi, dosha, aama` as candidate categories:

- **`prakrithi`/`dosha`** are *currently* a hardcoded 10-value Vata/Pitta/Kapha-combination dropdown in the
  CMS's own UI (`PRAKRITHI_DOSHA_OPTIONS` — not DB-fetched), stored in a plain `text` column with no check
  constraint. kal-scribe's free-text handling is a safe superset of that either way — no change needed.
- **`aama`** is a hardcoded 0-3 Likert scale in the CMS UI (`ExaminationSection.tsx` renders
  `[0,1,2,3].map(...)` directly, stored as `'0'`–`'3'` text) — **not** admin-configurable despite the table
  comment. kal-scribe's fixed 0-3 enum is an exact match.
- **`srotasDisturbanceType`/`srotasStatus`** correspond to `SrotasSection.tsx`'s hardcoded `normal`/
  `disturbed` toggle and fixed 4-value disturbance-type set (`Sanga`, `Vimarga Gamana`, `Atipravritti`,
  `Granthi`) — also not admin-configurable, genuine fixed Ayurvedic clinical taxonomy (Srotas Pariksha's
  physiological-channel assessment). kal-scribe's enum matches.

**Conclusion: no action needed anywhere in this item.** Both the free-text fields and the two enum fields
already match what the CMS actually does today (as opposed to what the `admin_config` table comment
aspirationally lists) — genuine parity, not a drift risk. Worth re-checking only if the CMS later moves
`prakrithi`/`dosha`/`aama` off their hardcoded frontend lists and into real `admin_config` rows, which
hasn't happened yet.

**2.5 Keep the Panchakarma boundary now, not just later — CONFIRMED CLEAN.**
CLAUDE.md is explicit: Panchakarma has its own dedicated protocol builder, already built, never to be
rebuilt or duplicated. Confirmed directly against the extraction types: no `protocolId`/`protocol_id`-shaped
field exists anywhere, and `treatmentType` is explicitly derived client-side rather than LLM-extracted.
Nothing to fix — just worth keeping this boundary in mind as the extraction schema evolves, so it doesn't
accidentally grow into overlap later.

**2.6 Keep patient identity out of kal-scribe.**
Nothing in the audit suggests kal-scribe tries to create or match patient records itself — keep it that
way. Patient identity should always be treated as something passed in from outside (a session ref), never
inferred or created from audio content.

**2.7 Leave formulary-matching honestly unresolved.**
The audit confirms medicine-formulary confidence is "always left null by the model rather than guessed" —
correct and worth protecting. Don't let a future shortcut (e.g. a hardcoded partial medicine list "just for
now") quietly turn `is_from_formulary` into a guess. Keep it null/false until there's a real formulary
source to check against.

**2.8 Keep the CMS-integration seam a single seam.**
`stub-cms-integration.adapter.ts` already exists as the one intended crossing-point into the CMS. Even
though nothing calls it for real yet, don't let other code (the review-accept flow, admin tooling, etc.)
grow direct assumptions about CMS shape elsewhere in the codebase. Every future "write into the CMS"
concern should route through that one adapter, so integration later is "implement the stub," not "find and
update every place that quietly assumed something about the CMS."

---

## 3. Field-by-field extraction-schema audit (pure research, do now)

The kal-scribe paper describes its extraction as "matching a real clinic-management system's schema via
schema-constrained generation" — worth actually verifying that claim now that the real CMS schema exists,
independent of whether integration starts soon. **In progress** — this doc originally had no visibility
into kal-scribe's actual extraction zod schema (`packages/types`, `packages/validation`, `prompt.ts`); §2.4
above is the first slice of this diff, done from the kal-scribe side with cross-confirmation from the CMS
side. The rest of the diff (vitals, personal-history bag, medicines, treatments) still needs doing the same
way, from the kal-scribe side, against the column list below.

Diff the extraction schema's field names/types against the CMS's actual columns, one-for-one:

- `consultations`: `nadi`, `mutra`, `mala`, `jivha`, `shabda`, `sparsha`, `drik`, `akruti`, `prakrithi`,
  `dosha`, `aama`, `examination_notes`, `diagnosis`, `clinical_notes`, `personal_history` JSONB
  (`{diet, bowel, appetite, bladder, sleep, addiction, exercise, menstrual}`), vitals (`weight_kg`,
  `height_cm`, `bp_systolic`, `bp_diastolic`, `pulse`, `temperature_f`), `complaints`,
  `treatment_history` — **plus columns added after the base migration:** `agni`, `ojas`, `vyaadhi`
  (`041_rogi_pariksha_fields.sql`) and `srotas_pariksha` JSONB (`040_srotas_pariksha.sql`, shape
  `{ "<srota_name>": { "status": "normal"|"abnormal", "notes": "..." } }` — note the DB comment says
  `normal`/`abnormal` while the current UI in `SrotasSection.tsx` uses `normal`/`disturbed`; worth checking
  which one kal-scribe's `srotasStatus` enum should actually match against). The base migration's column
  list alone is incomplete — always check for later `ALTER TABLE consultations` migrations too.
- `prescriptions`: `diet_guidance text[]`, `lifestyle_guidance text[]`, `notes`.
- `prescription_medicines`: `medicine_name`, `dosage`, `dosage_unit`, `anupana`, `timing`, `frequency`,
  `duration_days`, `instructions`, `is_from_formulary`.
- `prescription_treatments`: `treatment_name`, `treatment_type check ('panchakarma','general')`,
  `sessions`, `duration_days`, `notes`.

Flag any CMS column kal-scribe never attempts to extract, and any extracted field with no CMS home. This
is useful even fully standalone — it's the concrete check on whether the schema-parity claim in the paper
actually holds, and it feeds directly into §2.4 above.

**Partial check from the kal-scribe side (2026-08-29), against the newly-flagged columns above only —
vitals/personal-history/medicines/treatments still genuinely open, not covered by this note:**

- **`agni`, `ojas`, `vyaadhi` already exist and match by name.** `ClinicalExtraction`
  (`packages/types/src/clinical-extraction.ts`) has `agni: string | null`, `ojas: string | null`,
  `vyaadhi: string | null` — free text, no enum. These were apparently already added at some point without
  this doc's §3 tracking it (kal-scribe's own doc, `docs/modules/clinical-extraction-schema.md`, mentions
  Agni/Ojas as having "their own fixed option sets" per the LLM prompt, which is a narrower constraint than
  the type itself — worth a closer look at `packages/llm-client/src/prompt.ts`'s actual option list for
  these two if the CMS's real option set is needed for a tighter check).
- **The `srotas_pariksha` normal/abnormal-vs-disturbed question resolves in kal-scribe's favor.**
  `packages/validation/src/clinical-extraction.schema.ts` has `srotasStatusSchema = z.enum(["normal",
  "disturbed"])` — kal-scribe already matches the **live UI's** wording (`SrotasSection.tsx`'s
  `normal`/`disturbed`), not the DB column comment's `normal`/`abnormal`. Given the UI is what a doctor
  actually interacts with and the DB comment is just documentation, this reads as the DB comment being
  stale rather than kal-scribe being wrong — but flagging back rather than asserting, since only the CMS
  side can confirm which one the `040_srotas_pariksha.sql` migration's comment was ever meant to track.

---

## 4. Reference for later — the shared-DB decision (do not act on this yet)

kal-scribe's own schema comments say identity is "deliberately kept out of this repo... owned by the
external CMS this module will eventually be merged into." When integration is actually kicked off, this is
the first thing to resolve — **where do kal-scribe's Postgres tables live relative to the CMS's Supabase
project?**

| Option | What it means | Trade-off |
|---|---|---|
| **A. Same Supabase project/schema** (likely direction) | kal-scribe's tables (`consultation_ai_*`) live in the same Postgres instance as `consultations`, `prescriptions`, `patients`. Foreign keys become real (`consultation_session_ref` → `consultations.id`, `doctor_id_ref` → `auth.users.id`). RLS can reuse the existing `user_has_role()` helper and `user_roles` table directly. | Shares the CMS's ~15-connection Supabase pooler budget — already tight with kal-scribe alone (§1/E5), so that must be resolved first regardless. |
| **B. Separate service, integrated over an API** | kal-scribe stays its own deployable with its own DB; the `CMSIntegrationAdapter` (§2.8) pushes/pulls data across a service boundary. | No shared connection budget, but every "foreign key" becomes an application-level contract that can drift, and doctor identity has to be double-checked on both sides. |

This whole project is explicitly a single app, same Supabase project, RLS-based (per CLAUDE.md), and the PK
Protocol Builder precedent was "relocate, don't rebuild, don't run as a separate service" — Option A likely
matches the established pattern, but this should be confirmed explicitly when the time comes, not assumed.

---

## 5. Reference for later — the CMS write path ("accept & save")

When "Accept & save" actually gets wired to the CMS (via the adapter from §2.8), it needs to satisfy three
things the CMS already relies on:

1. **It must fire the CMS's existing audit trigger correctly.** `112_audit_log.sql` attaches a
   `SECURITY DEFINER` trigger to `prescriptions` and `consultations` that stamps `actor_id = auth.uid()`
   on every INSERT/UPDATE. A write made under a service-role connection with no `auth.uid()` context
   (rather than as the authenticated doctor) will log with a **null actor_id** — silently breaking
   traceability for exactly the records this audit log exists to protect.
2. **It must go through the same code path as a manually-created prescription, not a parallel raw insert.**
   `lib/scheduler.ts` triggers a Limechat "prescription created" WhatsApp message off real prescription
   creation. A parallel insert route risks double-firing or silently skipping that trigger.
3. **It must be transactional and idempotent.** A doctor re-clicking "Accept & save" (or a retried request)
   should not create a second `prescriptions` row for the same consultation.

Also relevant at that point: there's currently no path for kal-scribe to check a medicine name against the
CMS's real `formulary` table (per-facility) to set `is_from_formulary` — that contract needs defining
before "accept & save" goes live, not after.

---

## 6. Reference for later — deferred auth (D1–D4)

Tracked as a separate track, listed here only so nothing is forgotten when that work starts:

- **D1** — no authentication anywhere in `apps/api`.
- **D2** — no authorization/ownership checks (any caller with a recording ID can read/write it).
- **D3** — RLS disabled on every kal-scribe table; DB role is superuser-equivalent, not scoped.
- **D4** — admin endpoints (dead-letter list, reprocess, status patch) have zero access control.

One dependency worth noting even though the work is deferred: if Option A (§4) ends up being the direction,
kal-scribe's eventual auth should reuse the CMS's existing `auth.users` / `user_roles` / `user_has_role()`
machinery rather than inventing a parallel identity system. **This is also when §2.1's `text`→`uuid`
retype on the ref columns should happen** — auth work is what actually answers "what does a doctor ID look
like," so do the retype as part of that work, not before it.

---

## Suggested order of operations (current phase only)

1. ~~Fix D5 and D7~~ — **done** (2026-08-29, `robustness/audit-fixes`).
2. Finish the §3 field-by-field schema diff — `agni`/`ojas`/`vyaadhi`/`srotas_pariksha` spot-checked and
   resolved (2026-08-29); vitals, `personal_history`, medicines, and treatments are still genuinely open.
3. Apply the rest of §2 — ~~`facility_id` column~~ **done** (2026-08-29); uniqueness constraint still open
   (§2.3, needs a real intent decision); keeping the adapter as the single seam is an ongoing discipline,
   not a one-time task. §2.1 is deliberately deferred to the auth work, §2.4 and §2.5 are already done, no
   action needed there.
4. Work through the rest of §1 — ~~E1~~, ~~E3~~, ~~E4~~, ~~E5~~, ~~CORS~~, ~~E8~~ **all done**
   (2026-08-29). E2 **partially done** (server-side chunk tracking exists; resume-on-reload UX still
   open). E7 **blocked** on legal/compliance sign-off (`ADR-0004`), not implemented. **Still genuinely
   open:** structured logging (Pino/nestjs-pino) — the single largest remaining item, deliberately not
   rushed into this pass.
5. §4–6 stay untouched until integration is explicitly kicked off.

**Everything in §1 that could be resolved without a new decision or a legal sign-off is now done** — what
remains (E2's resume UX, E7, structured logging, §2.3's intent question, §2.1's retype, the rest of §3's
diff) all either needs a real decision from someone, or is a genuinely large standalone piece of work worth
its own pass rather than a footnote on this one.
