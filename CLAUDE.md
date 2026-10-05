# VYVA — Project Context for Claude Code

## Who and what

**Karim**, founder of Moka Digiteck SL (Tarifa, Andalucía). Working solo with
AI assistants — no separate development team. Replit is the backend and
deployment environment.

**VYVA** is a voice-first AI companion for seniors 65+. Deployments in
progress: Cruz Roja Alemana / DRK (Germany), Diputación de Zamora (Spain),
Telefónica partnership in development.

**No live users yet.** Nothing is user-facing in production. Breaking changes
are cheap right now — take advantage while it lasts.

### Working style

- Interpret direction and execute autonomously. Minimal back-and-forth.
- Low verbosity. Get to the point.
- Tell it straight — don't soften bad news about the codebase.
- Strong opinions welcome. Practical above all.
- Formal but relaxed.

---

## Stack and environment

Replit · Express · Drizzle ORM · PostgreSQL · React · TypeScript/Vite ·
ElevenLabs (TTS) · OpenAI · Mem0

**Repo:** `VYVA-b2c/vyva-2.0` on GitHub.

**Database:** Replit-hosted Postgres. Development and Production both exist.
**Development only.** Production is never touched directly.

### Environment gotcha — read this before debugging any DB failure

`.env` contains a stale `helium` placeholder for `DATABASE_URL`, and tests
use an unreachable `127.0.0.1:1` placeholder. Real credentials are injected
by Replit at runtime, inside the Replit workspace only.

Consequence: **anything requiring a live database connection must run from
the Replit Shell tab**, not from an external agent shell. This has caused
repeated false conclusions — migrations reported as "not applied" when they
were, content reported as missing when it existed. If a DB operation fails
with `ENOTFOUND helium` or a connection error to `127.0.0.1:1`, the
environment is wrong, not the code.

The Supabase project named "VYVA" holds no `cc_*` tables — Cognitive Compass
data lives only in Replit Postgres.

**The `cc_item_bank` content was loaded into Production, not Development.**
Production holds 935 rows (per language: 120 stories, 60 similarities,
3 phonemic, 4 semantic fluency). Development started with only duplicated
fluency seeds. `scripts/copy-cc-item-bank-prod-to-dev.mjs` is the one
sanctioned Production read: it reads Production read-only (`PROD_DATABASE_URL`
Secret), writes only Development, dedupes fluency, and relabels uploaded rows
to `ai_generated` / unreviewed. Dry run by default; `--apply` commits.

### Known pre-existing test failures — not yours, don't chase them

These fail on `origin/main` independently of any current branch. Verified.

- `realRouterParity.test.ts` — 2 side-effect mismatches
- `voiceContext.test.ts` — expects `health`, receives `wellness`
- `advisors.test.ts` — response shape mismatch
- `callback-onboarding.test.ts` — 500s, DB-connection-dependent
- `games.test.ts` — expects `garden`, receives `cake`

Roughly 42 further server test failures are purely the `127.0.0.1:1`
placeholder and resolve when run with a real connection.

If client tests fail en masse with missing `node_modules/tsx/dist/cli.mjs`,
run `npm ci` — dependencies drift after merging main.

---

## Two separate systems — do not conflate them

### 1. Brain Coach — 13 games

Training and enjoyment. Played voluntarily, 3–5 minutes each. Four
member-facing pillars:

| Pillar | Games |
|---|---|
| Strengthen Memory | Face-Name Match, Story Builder |
| Train Reflexes | Dual Task Walk, Sequences, Rhythm Tap, Number Trails |
| Boost Intelligence | Category Sort, Spatial Navigator |
| Sharpen Senses | Listen Closely, Breath Garden, Scent Memory |

Plus Remember Later (prospective memory), Opinion Circle (social engagement,
unscored), Curious Minds (divergent thinking, unscored).

Each is grounded in a published paradigm — Number Trails is Trail Making,
Category Sort is Wisconsin Card Sorting, Face-Name Match comes from Harvard
Aging Brain Study work on associative binding.

### 2. Cognitive Compass — the assessment

A recurring check-in that **measures**. Nobody plays it for fun. 12 tasks,
~15 minutes, currently wizard-only (tap and type).

**No shared tables, routes, or scoring between the two.** Games write to
per-game tables. The assessment writes to `cc_*`.

---

## Current state of Cognitive Compass

Established by audit, June 2026, and the English content audit in
`docs/audits/cognitive-compass-en-content-audit.md` (October 2026). Trust
these over older brief documents.

### The 12 live tasks — all active

1. `orientation` · 2. `story_recall_immediate` · 3. `fluency_semantic` ·
4. `fluency_phonemic` · 5. `digit_span` · 6. `similarities` ·
7. `clock_drawing` · 8. `story_recall_delayed` · 9. `mood_screen` ·
10. `sleep_energy` · 11. `function_iadl` · 12. `subjective_concern`

### Content inventory per language

| Task | Items |
|---|---|
| Story recall | 120 |
| Similarities | 60 |
| Semantic fluency | 4 |
| Phonemic fluency | 3 |
| Orientation forms | 4 |
| Static tasks | 1 config each |

935 rows in Production `cc_item_bank`, all `is_active = true`, **none
reviewed**. Stories and similarities were LLM-generated and bulk-uploaded with
the admin "Skip admin review" checkbox, which defaults to on and stamps rows
`source = 'human_written'`. Production still carries that false label; the
Development copy is relabelled `ai_generated` with `reviewed_at/by` cleared
(still active so the runner works). Export for review with
`node scripts/export-cc-content-audit.mjs en` (Replit Shell, Development).

### Key tables

`cc_task_definitions` · `cc_item_bank` · `cc_rotation_forms` ·
`cc_sessions` · `cc_task_responses` · `cc_user_consents` ·
`cc_program_enrollments`

**Raw SQL, not Drizzle.** `shared/schema.ts` has no `cc_*` definitions.
Deliberate architectural split — don't "fix" it without asking.

### Where the code lives

- Migrations: `migrations/0050–0053_cognitive_compass_*.sql`, `0060`, `0062`
- Readiness: `server/lib/cognitiveAssessmentReadiness.ts`
- Runner API: `server/routes/cognitiveAssessment.ts`
- Runner UI: `src/pages/CognitiveAssessmentRunnerPage.tsx`
- Scoring: `shared/cognitiveAssessmentScoring.ts` — the only scorer. The server
  scores every response on save from the content it served; clients send raw
  answers only. Voice must go through the same function.
- Trends: `server/lib/cognitiveAssessmentTrends.ts`
- Report UI: `src/pages/CognitiveAssessmentReportPage.tsx`
- Admin upload validation: `shared/contentBulkUpload.ts`

---

## Open issues — ranked

**1. Unapplied migrations, including the entire game layer.**
`0027_cognitive_session_index` is not recorded as applied. That table is what
all 13 games write to for the Cognitive Pattern Engine. Also unrecorded:
`0011_spatial_navigator`, `0012_dual_task_walk`, `0013_face_name_match`,
`0014_category_sort`, `0015_number_trails`, `0040_remember_later`,
`0042_scent_memory`, `0043_listen_closely`, `0044_breath_garden`.

Verify from inside Replit whether these tables physically exist despite not
being tracked — the tracking table has proven unreliable. If they don't
exist, the games are writing into nothing.

**2. Scoring — moved into one module (`cc_scoring_v2`), gaps remain.**
Orientation, similarities, clock, fluency, digit span and questionnaires are now
scored for correctness on the server (migration 0105 aligns `scoring_config`).
Still open: story idea units are the legacy word-dump lists (scored, but
`needs_review`); semantic fluency has no validity lists (`needs_review`);
similarities match against the flawed example lists (unmatched answers held for
review); no review queue reads `needs_review` yet; a PHQ-2 `threshold_met` flag
is stored but nothing acts on it.

**3. No abandonment write path.** `cc_sessions.abandon_task_id` exists and
nothing writes to it. Cheap fix. Do it before real users arrive.

**4. Content unreviewed and unpaired.** All rows active without review;
`item_family_id` is always null so cross-language equivalence can't be
checked. Item selection ignores difficulty tier and prior exposure.

**5. Premature trend display.** Confirmed: "above/below usual range" shows
after 3 prior sessions using min–max, which flags pure noise ~50% of the time.
"Baseline ready" shows after one session.

### Resolved — do not re-investigate

- **Migration 0062** is applied and verified. `interaction_logs_outcome_check`
  contains `REMINDER_QUEUED`, `REMINDER_SKIPPED`, `TEST_REMINDER_QUEUED`
  alongside the original five outcomes. Earlier audits reporting it missing
  were run from a shell with no database access.

---

## Licensing status

| Instrument | Status |
|---|---|
| PHQ-2 (`mood_screen`) | **Public domain.** Pfizer released the PHQ family. No permission needed. Keep attribution. |
| Lawton IADL (`function_iadl`) | GSA holds copyright. Verify commercial terms. |
| `wechsler_logical_memory_adapted` | Cosmetic only — stories are original content. Renamed to `narrative_recall_idea_units` in migration 0105. |
| Sunderland (clock drawing) | Scoring method reference, not reproduced items. Fine. |
| Word lists (CERAD / RAVLT) | Not sourced. Licensing conversation in progress. |
| Digit span sequences | Provenance undocumented. |

---

## Immediate task

**Build the voice input path for the assessment** — after the fixes in the
content audit §7 (pipeline, shared scoring, selection).

`supports_voice` is `true` on every task definition, but the runner only uses
the wizard path. **Additive.** The wizard path stays. Both modes run the
identical task sequence and write identical `cc_task_responses` rows.

Reuse the existing Web Speech API pattern from Story Builder's retell phase
and the `DualInput` component built for Curious Minds. Don't build new
dictation plumbing.

---

## Hard rules

**UID discipline — non-negotiable.** A real bug was caught this way (Scent
Memory, migration 0042, TEXT where UUID was required).

- Every `user_id` is `UUID REFERENCES auth.users(id) ON DELETE CASCADE`
- Every RLS policy uses `auth.uid() = user_id` — never `auth.uid()::text`
- Never reference `profiles.id` as a foreign key. Known drift: `profiles.id`
  is TEXT while `auth.users.id` is UUID
- Run a UID audit before any merge touching a table with a `user_id`

**Migrations.** Additive only. Never edit an applied migration — write a new
one. Development first, always. Never run against Production. Note that
`db-sync.mjs` can silently skip migrations when the tracking table believes
it is current — verify constraints directly rather than trusting its output.

**Member-facing language.** This is a measurement instrument, and age-based
stereotype threat measurably depresses cognitive test performance. The copy
is part of the instrument.

Never use: *test, score, correct, wrong, assessment, performance, failed,
normal, abnormal, pass, fail, risk score*, or any age reference.

Use instead: *check-in, tracking signal, change since last check, areas
checked, coverage, context*.

Frame as maintenance, not demonstration. "Let's keep things sharp" beats
"let's see how well you do."

Standing disclaimer where appropriate: *Tracking signals are not a diagnosis.
They are intended to support reflection and better conversations with a
healthcare professional.*

**Scientific integrity.** No invented norms, cutoffs, sensitivity figures or
citations. Every scientific claim either carries a verifiable source or is
labelled explicitly as product-design rationale. Positioned as wellness, not
a medical device — EU MDR registration is a later-stage decision.

**Content pipeline.** AI-generated content lands `is_active = FALSE` and
requires human review before activation. Read RLS policies filter on
`is_active = TRUE`. The admin review surface already exists — extend it
rather than building a second one.

---

## Design decisions already locked

Six decisions for Cognitive Compass. Don't relitigate without reason:

1. **Task selection** — 8 cognitive + 4 whole-person modules
2. **Practice effects** — hybrid: item banks for high-signal tasks, rotation
   for the rest
3. **Voice biomarkers** — not in v1. Acoustic feature capture needs VAD and
   an audio-quality gate first, plus separate explicit consent
4. **Clinical report** — 1-page PDF, VYVA composite plus an approximate
   MoCA-equivalent band, no interpretations. The clinician interprets
5. **Regulatory** — wellness positioning now, MDR later
6. **Structure** — single anchored weekly session

### About the brief documents in `/docs/`

Earlier briefs may describe a leaner task set — word lists replacing story
recall, several tasks dropped. That design was written before the audit
revealed the full system was already built. Where a brief and the database
disagree, **the database is correct.**
