# Cognitive Compass — English content audit (pre-voice)

Date: 2026-10-04. Scope: everything a member sees or that determines a
tracking signal, in English. Done before any voice work, as the brief asked.

## What could and could not be read

| Source | Read? |
|---|---|
| Task definitions, static content (digit span, clock, PHQ-2, sleep, IADL, SCD) — `migrations/0050` | Yes |
| Fluency prompts, orientation forms — seeded in `0050` | Yes |
| Every runner string — `src/pages/CognitiveAssessmentRunnerPage.tsx`, labels in `server/routes/cognitiveAssessment.ts` | Yes |
| Item selection, scoring, trend gating | Yes |
| **120 stories, 60 similarities (EN)** | **No.** They were bulk-uploaded through the admin page into the **Production** database; Development has none until `scripts/copy-cc-item-bank-prod-to-dev.mjs --apply` runs. They are not in the repo or in the Supabase project. |

So the two questions the brief cares most about — whether the stories are 120
distinct items or one template, and whether tier-5 similarities can be
answered — **can't be answered yet**. Run this from the Replit Shell (copy
Production → Development first, then export from Development):

```
node scripts/copy-cc-item-bank-prod-to-dev.mjs          # dry run
node scripts/copy-cc-item-bank-prod-to-dev.mjs --apply
node scripts/export-cc-content-audit.mjs en
```

It is read-only (`begin read only` … `rollback`). It writes
`docs/audits/cc-content-export-en.json` and prints automated checks: repeated
story openings, reused character names, duplicate titles, idea-unit counts,
tier distribution, duplicate and repeated similarity words, and provenance per
row. Commit the file or paste it back and the item-level review follows.

What *can* be said about those rows from the code is below (§1), and some of
it changes how the rest should be read.

---

## Bottom line

The content isn't the binding problem. **The scoring and selection logic is.**
Most "signals" this instrument produces right now measure whether the member
filled in the field, not how well they did. Several tasks would give the same
tracking signal for a blank-faced guess as for a perfect answer. Item
selection ignores difficulty, so week-to-week change is mostly item noise.
The trend layer then flags that noise as change about half the time.

Voice should not be built on top of this as-is. Wiring voice to the current
scoring would carry these defects into a second input path (open issue #2 in
`CLAUDE.md`, but worse than described there).

---

## 1. Content pipeline — the "935 rows, none reviewed" explanation

- `src/pages/admin/CognitiveAssessmentAdminPage.tsx:488` —
  `useState(true)` for **Skip admin review**. It is ticked by default.
- `shared/contentBulkUpload.ts:77-84` — when skipped, the row is written
  `is_active = true`, **`source = 'human_written'`**, with `reviewed_at` and
  `reviewed_by` stamped.

So LLM-generated stories and similarities were most likely stored as
human-written and reviewed. That breaks the content-pipeline rule in
`CLAUDE.md`, and it falsifies provenance, which matters later for MDR. The
export's provenance table will confirm it either way.

- Every upload is written with `item_family_id = null`
  (`contentBulkUpload.ts:106,145`). Nothing links an EN story to its ES/DE/FR/PT
  counterpart, so cross-language equivalence (open issue #4) **cannot be
  checked from the data at all**. The items were never paired.
- Every story is forced to `difficulty_tier = 1` (`:105`). Upload validation
  requires 40–60 words and a self-reported grade level of 3–5. Nothing checks
  idea-unit count or quality.
- I found no approve/reject action for `cc_item_bank` in
  `server/routes/adminCognitiveAssessment.ts`. The CC admin page uploads but
  doesn't review. "Extend the existing review surface" means the Curious Minds
  one, if that's the one meant.

## 2. Scoring — what each signal actually measures

| Task | Runner sets `score` to | Consequence |
|---|---|---|
| `orientation` | number of fields **non-empty** (`RunnerPage.tsx:213-218`) | "1999 / Banana / Tuesday" scores 5/5. The signal carries no information. |
| `similarities` | number of fields non-empty (`:268-274`). `max_score` is ×2 but the 2/1/0 abstract/concrete rule is never applied | Any text scores as an answer. `abstract_answer_examples` / `concrete_answer_examples` are stored and never read. |
| `clock_drawing` | 1 if both dropdowns chosen (`:287`). The target time is never compared | The member sees "Set the clock to 10:11" and picks "10" and "11" from two dropdowns. That is transcription. There's no drawing, planning or number placement, and none of the Sunderland criteria can occur. `max_score: 10` and `sunderland_method_geometric` in `scoring_config` describe a task that doesn't exist. |
| `fluency_*` | count of unique typed strings (`:233-238`) | No validity check: "asdf, qwer, zxcv" counts as 3. `acceptable_responses_reference: "en_animals_v1"` points to lists that exist nowhere in the repo. Intrusions, proper nouns and perseverations — all configured as penalties — are not handled. |
| `digit_span` | longest span forward + backward | Mechanically sound. Paradigm problems in §4. |
| `story_recall_*` | idea units matched (`shared/cognitiveStoryRecallScoring.ts`) | A unit counts if **any one** of its slug tokens (≥3 chars) appears as an exact token. "curtains" misses `curtain`. "I had a kitchen window" credits both `location_kitchen` and `main_object_window_curtain`. No stemming, synonyms or stop-word list. False positives and false negatives both occur. |
| PHQ-2, sleep, IADL, SCD | sum of chosen values | Correct. |

**Typing confounds everything.** In the wizard, fluency is "type one word,
press Enter" for 60 seconds. For a 75-year-old on a phone, that measures
typing speed first and word generation second. Story recall and digit span are
typed too. This is the strongest argument *for* the voice path, but only once
scoring is real. Fluency in particular is only valid spoken.

## 3. Item selection — practice effects and difficulty noise

`server/routes/cognitiveAssessment.ts:525-600`

- Items are chosen by a hash of `sessionId`. **Difficulty tier and prior
  exposure are ignored.**
- Similarities: 4 of 60 drawn from **all tiers** together. One week can be
  four tier-1 items and the next four tier-5. The 0–8 signal then swings on
  item difficulty, not the member. Odds of seeing at least one repeated
  similarity item: **58% by the 3rd session, 99% by the 6th.**
- Stories: one of 120, no exposure memory. P(repeat) = 12% by session 6, 43% by
  session 12, 95% by session 26. With weekly sessions, a member re-reads a story
  within half a year. (Two weeks apart, that is a practice effect, not
  long-term recall.)
- Fluency: category drawn at random from animals / food / clothing / body
  parts. Letter drawn from F / A / S. These are not equivalent forms. Animals
  is the most productive category and body parts the least (a bounded set).
  Rotating them adds category difficulty into the trend. Product-design
  rationale, not a sourced claim: fix the category per language (animals) and
  fix the letter, or report each prompt as its own series.
- Clock: four target times rotate. 10:11 / 11:10 are the classic "pull"
  times. 2:45 / 3:40 are easier. Same issue.

This is design decision #2 ("item banks for high-signal tasks") implemented
without the part that makes item banks work: matched difficulty and no
repeats.

## 4. Paradigm fidelity

- **Story recall is read, not heard.** It is shown on screen for
  `0.6 s/word`, clamped 25–45 s, and can be dismissed early. Every logical-memory
  paradigm is auditory. The voice path should present it by TTS, once, at a
  fixed rate. The written version then becomes a separate, non-comparable mode.
  Store `presentation_mode`.
- **Delay is uncontrolled.** Delayed recall sits ~7 min of tasks after
  immediate recall. But the runner says "You can pause and come back", so the
  delay can be days. The delay isn't stored and isn't capped. Store it; above
  some cap, mark the delayed signal unusable.
- **Digit span is visual and simultaneous.** All digits appear together for
  `0.7 s/digit` (2.2–5 s). The standard is auditory, one digit per second.
  `forward_prompt` says "I will say some numbers…" while showing them.
  Content overlaps:
  - Forward and backward use **identical sequences** at lengths 5, 6, 7 and 8
    (`1-5-2-8-6`, `5-3-9-4-1-8`, `8-1-2-9-3-6-5`, `9-4-3-7-6-2-5-8`). A
    member who reaches length 5 forward is given a sequence they just typed,
    to reverse.
  - Forward-8 trial 2 (`7-2-8-1-9-6-5-3`) begins with forward-6 trial 2
    (`7-2-8-1-9-6`).
  - Static content, so every session uses the same sequences.
  - Provenance of the sequences is undocumented. If they came from a published
    digit-span form, that's a licensing question.
- **`story_recall` `max_score: 25`, `reference: wechsler_logical_memory_*`.**
  Stories are 40–60 words. 25 idea units in 50 words isn't realistic, and the
  live max is `idea_units.length`. The label is the rename already flagged in
  `CLAUDE.md`, and it applies to both immediate and delayed.
- **Clock "voice_prompt"** ("Describe where you would place the numbers…")
  and `sunderland_method_adapted_verbal`: there is no validated verbal
  clock-drawing paradigm I can cite. If it's built, label it explicitly as a
  product-design adaptation with no established scoring.
- **IADL** `threshold_flag: 6` on a 4-item, 0–8 paraphrased subset: this cutoff
  has no source. Lawton's instrument has 8 domains with different items. Either
  source it or remove it (scientific-integrity rule).
- **PHQ-2** English wording and response options match the published
  instrument. `threshold_flag: 3` matches the published cutoff
  (Kroenke, Spitzer & Williams 2003, *Med Care* 41:1284). Attribution text isn't
  shown anywhere in the UI. Separately, what happens when the flag trips? I
  found no safety path. In a wellness product a positive PHQ-2 needs one.
- **SCD item 1** "How often do you notice concerns about your memory?" is
  awkward. "How often do you worry about your memory?" matches the DE/ES
  versions.
- **Orientation** `what_season`: ambiguous near season boundaries and in the
  southern hemisphere. `what_home_type` ("What kind of home are you in?") has
  no checkable answer. With scoring fixed, both need explicit
  accept-rules or should be dropped.

## 5. Member-facing copy (runner, English)

**All runner chrome is hard-coded English.** ES/DE/FR/PT members get localized
items inside English instructions, buttons, labels and feedback. The same holds
for `TASK_LABELS` / `DOMAIN_LABELS` on the server and the story-delayed prompt
(`cognitiveAssessment.ts:584`). For the DRK and Zamora deployments this is a
blocker on its own, independent of voice.

Strings that break the language rules (`CLAUDE.md` → member-facing language):

| Where | String | Problem |
|---|---|---|
| Intro `:394` | "The assessment will use the member's VYVA language…" | Written for an operator, not the member. Uses "assessment". |
| Intro `:397`, `:407` | "Assessment language", "Start assessment" | banned word |
| Loading / errors `:1576`, `:1589-1591`, `:1646`, `:1757` | "Loading assessment", "Assessment unavailable", "…not available in this database yet" | banned word; leaks implementation |
| Header back button `:350` | "Back to Cognitive Assessment" | banned word (product name is "Cognitive Compass") |
| Digit span feedback `:910` | "Correct. Try the next one." / "That one was not exact." | banned word; per-trial right/wrong feedback |
| Digit span `:857`, `:958`, `:983-985` | "Digit span complete", "Both rounds are complete. 11 total span." | clinical label; shows a running score |
| Digit span panel `:966-970` | Live "Forward 6 / Backward 4" counters | live score display |
| Digit span `:995` | "Length 7" | difficulty counter, a performance cue |
| Fluency `:727-728` | live "unique" counter | live score display |
| Fluency `:742`, `:795` | "Done" then "Start again" | Pressing Done early and then Start again resumes the remaining seconds with the words kept. A timed round can be paused at will, and that isn't recorded. |
| Fluency `:678` | "Say words that start with F" | The wizard can't hear; the instruction contradicts the UI. |
| Fluency `:791` | "Repeats are okay. Only different words count." | "count" frames it as scoring. Fine in intent. |
| Story `:578` | "Delayed recall" | clinical label |
| Task labels (server) | "Digit span", "Similarities", "Delayed story recall", "Clock drawing", "Category fluency", "Letter fluency" | clinical labels; "Clock drawing" doesn't describe the task |
| Domain labels (server) | "Self concern", "Attention" (for digit span), "Awareness" | "Self concern" reads as a symptom label |
| Questionnaire `:1306` | "Quick check" | fine |
| Transition `:1435` | "Take a breath" | good |
| Intro `:416` | "This wellness check helps track changes over time. It does not diagnose a medical condition." | Good. Use the standard disclaimer wording from `CLAUDE.md`. |

Report page: careful overall ("Not a score. A starting point…"). But
"Complete baseline" / "Baseline ready" appear after a **single** session
(`ReportPage.tsx:72,126,1834`), and "Scored signal" (`:1462`) is on screen.

## 6. Trend gating (open issue #5) — answered

`server/lib/cognitiveAssessmentTrends.ts:333-353`: a domain shows
"Above/Below recent usual range" once there are **3 prior** values. The range
is plain min–max of those 3.

With no true change at all, a 4th value falls outside the min–max of 3
exchangeable values **50% of the time** (2 of 4 orderings put it at an
extreme). Combined with §3's difficulty noise, most domains will flip
"above"/"below" on most sessions. That's a false-change generator, shown to the
member.

Product-design suggestion, not a sourced norm: no member-facing direction
until there are ≥5–6 sessions *and* fixed-difficulty items; use a
noise-aware band rather than min–max; and keep "Baseline ready" until then.

## 7. Recommended order before voice

1. **Pipeline:** default `skipAdminReview` to `false`. Never write
   `source = 'human_written'` from an upload. Run the export and decide on
   deactivation (an additive migration, Dev first).
2. **Scoring out of the runner into one shared module** that reads
   `scoring_config` (open issue #2). Real orientation checks, similarities 2/1/0
   against the example lists (LLM-assisted judging with stored rationale is
   reasonable here), fluency validity lists, and a clock target comparison.
   Voice then calls the same module.
3. **Selection:** filter by tier (fixed tier per session slot). Exclude items
   the user has already seen (`cc_task_responses` has the history). Fix the
   fluency prompt or split series.
4. **Paradigm fields:** `presentation_mode` (audio/text), `recall_delay_sec`,
   and de-duplicated digit sequences in rotating forms.
5. **Copy:** localize the runner chrome. Remove live counters and right/wrong
   feedback. Rename labels.
6. **Then voice**, reusing the Story Builder Web Speech pattern and
   `DualInput`. Story and digits are presented by TTS; fluency is spoken only.

Abandonment write path (open issue #3) is independent and cheap. Do it
alongside step 1.

## Not verified here

- Item-level quality of the 120 stories / 60 similarities (needs the export).
- Whether the uploaded rows really carry `source = 'human_written'`. This is
  inferred from code defaults; the export prints it.
- FR/PT/ES/DE copy.
