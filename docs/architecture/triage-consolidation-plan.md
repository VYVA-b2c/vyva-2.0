# Triage Consolidation Architecture Review

Source snapshot: `origin/main` at `cae2013` on branch `feat/triage-consolidation`.

This is an architecture-review artifact only. It maps current behavior, compares duplicated logic, identifies proposed ownership, and defines a parity-preserving migration path. It does not recommend clinical behavior changes, threshold changes, new symptom paths, new UI, or production-rule edits.

## Scope Guardrails

- Do not change clinical behavior in this PR.
- Do not add or remove symptom paths.
- Do not add, remove, or tune thresholds.
- Do not move runtime code in this PR.
- Do not modify UI, migrations, production routes, or persistence schemas.
- Treat the JSON inventories in `artifacts/` as evidence for future parity checks, not runtime inputs.
- Treat medical image and wound scan systems as adjacent unless they already feed symptom triage.

## Current File Tree

```text
shared/
  schema.ts
  triageScans.ts

server/
  index.ts
  lib/
    dailySafetyCheck.ts
    triageRules.ts
    triageWizardMatrix.ts
  routes/
    reports.ts
    triage.ts
    triageScan.ts
    vitalsEngine.ts
    woundScan.ts
  __tests__/
    daily-safety-check.test.ts
    triage-route.test.ts
    triage-scan-route.test.ts
    vitals-engine-auth.test.ts

src/
  components/
    TriageChat.tsx
    TriageChat.test.tsx
    TriageScanCard.tsx
  lib/
    triageProtocols.test.ts
    triageScanOffers.ts
    triageScanOffers.test.ts
    triageWizardMatrix.test.ts
  pages/
    InformesScreen.tsx
    SymptomCheckScreen.tsx
    SymptomCheckScreen.intro.test.tsx
```

## Dependency Graph

```text
SymptomCheckScreen
  -> TriageChat
      -> /api/triage/message
          -> server/routes/triage.ts
              -> server/lib/triageWizardMatrix.ts
              -> server/lib/triageRules.ts
              -> MediSearch context
              -> OpenAI summary generation
              -> applyTriageSafetyFloor
                  -> deterministic triage rule decision
                  -> vitals overlays
                  -> optional triage scan overlay

TriageChat
  -> selectTriageScanOffer
      -> TriageScanCard
          -> /api/triage/scan
              -> server/routes/triageScan.ts
                  -> OpenAI appearance-only scan summary
                  -> TriageScanResult
      -> /api/triage/message with wizard.scanResults

SymptomCheckScreen
  -> /api/reports/triage
      -> server/routes/reports.ts
          -> triage_reports
          -> caregiverAlerts triage_report handoff

VitalsTracker / vitals clients
  -> /api/vitals-engine/*
      -> server/routes/vitalsEngine.ts
          -> server/lib/dailySafetyCheck.ts
          -> Claude enrichment when available
          -> caregiverAlerts daily_safety_summary

InformesScreen
  -> reports payloads
      -> urgency display labels and badges
```

Routes are registered in `server/index.ts`: `/api/triage/scan` at line 113, `/api/triage` at line 169, `/api/reports` at line 179, and `/api/vitals-engine` at line 181.

## Current Behavior That Must Be Preserved

### Symptom Paths

The current wizard exposes 12 symptom paths in `server/lib/triageWizardMatrix.ts:61`:

- `pain` - pain/headache.
- `chest` - chest discomfort.
- `breathing` - breathing.
- `fever` - fever.
- `dizzy` - dizziness/faintness.
- `tired` - very tired/weak.
- `stomach` - stomach/bowel.
- `urinary` - urine problem.
- `fall` - fall/injury.
- `skin` - skin/wound/rash.
- `confusion` - confusion/not like myself.
- `other` - something else.

Each path has a protocol entry in `server/lib/triageRules.ts:138` and a wizard entry in `server/lib/triageWizardMatrix.ts:76`.

### Urgency Levels And Next-Step Labels

The deterministic rule engine ranks levels in `server/lib/triageRules.ts:92` and maps levels to urgency in `server/lib/triageRules.ts:99`:

- `emergency` -> `urgent`.
- `doctor_today` -> `urgent`.
- `doctor_24_48` -> `routine`.
- `monitor` -> `monitor`.

Next-step labels are generated in `server/lib/triageRules.ts:105` and route fallback next-step labels are generated in `server/routes/triage.ts:1367`.

### Vitals Overlay Behavior

The triage route passes scanned or manually added vitals into `evaluateTriageRules` in `server/routes/triage.ts:1431`. The vitals values passed are pulse, respiratory rate, oxygen saturation, temperature, systolic BP, diastolic BP, and glucose at `server/routes/triage.ts:1439`.

The report note layer records vitals context in `server/routes/triage.ts:1238`. Respiratory rate notes use a separate report-note threshold of `>=24` or `<=10` at `server/routes/triage.ts:1251`.

### Optional Triage Scan Behavior

Optional triage scan types are defined in `shared/triageScans.ts:1` as `vitals`, `wound_photo`, `urine_photo`, and `stool_photo`.

Scan offers are client-side routing logic in `src/lib/triageScanOffers.ts:168`. They are suppressed during safety alerts and when emergency-blocking red flag IDs are present in `src/lib/triageScanOffers.ts:176` and `src/lib/triageScanOffers.ts:180`.

The scan analysis route is appearance-only and returns `concernLevel` values in `server/routes/triageScan.ts:43`. In the triage summary, urgent scan results set an urgency floor of `urgent` and a next-step floor of `doctor_today`, but do not make an emergency next step by themselves, in `server/routes/triage.ts:1424`, `server/routes/triage.ts:1450`, and `server/routes/triage.ts:1477`.

### Profile Modifier Behavior

Profile risk flags are inferred from health memory, conditions, allergies, medications, latest vitals, and latest symptom report in `server/routes/triage.ts:312`. Protocol-specific profile modifiers are applied in `server/lib/triageRules.ts:667` and configured per symptom path, for example chest at `server/lib/triageRules.ts:150`, pain at `server/lib/triageRules.ts:165`, and fever at `server/lib/triageRules.ts:195`.

Additional global profile overlays live in `server/lib/triageRules.ts:938`, `server/lib/triageRules.ts:947`, `server/lib/triageRules.ts:956`, and `server/lib/triageRules.ts:965`. Profile explanatory notes are generated separately in `server/routes/triage.ts:1210`.

### Caregiver Alert And Report Delivery Flows

Symptom report handoff writes `caregiverAlerts` records from `server/routes/reports.ts:148` when report recipients are present. The saved triage report contract includes `scan_results`, `scan_notes`, `next_step_level`, `vitals_notes`, and related fields in `server/routes/reports.ts:299`.

Daily Safety caregiver escalation is generated from `server/routes/vitalsEngine.ts:399`. It depends on `statusShouldEscalate` from `server/lib/dailySafetyCheck.ts:115`, checks consent in `server/routes/vitalsEngine.ts:378`, deduplicates recent open alerts in `server/routes/vitalsEngine.ts:427`, and inserts `caregiverAlerts` records in `server/routes/vitalsEngine.ts:450`.

### API Contracts And Response Shapes

These response shapes must remain stable during consolidation:

- `/api/triage/message` returns assistant content, `quickReplies`, `wizardStage`, optional `safetyAlert`, optional `summary`, and evidence fields from `server/routes/triage.ts`.
- `TRIAGE_JSON summary` includes `urgency`, `nextStepLabel`, `nextStepLevel`, `triageReasons`, `recommendations`, `watchSigns`, `profileConsiderations`, `vitalsNotes`, `scanNotes`, and `disclaimer` in `server/routes/triage.ts:1033`.
- `/api/triage/scan` returns `TriageScanResult` with `concernLevel`, `summary`, `findings`, and no raw image data from `server/routes/triageScan.ts:183`.
- `/api/reports/triage` validates and stores the current report schema in `server/routes/reports.ts:285`.
- `/api/vitals-engine/*` returns Daily Safety fields including `safety_status`, `recommended_action`, `caregiver_note`, `alert_fired`, and `alert_channel` from `server/routes/vitalsEngine.ts:805`.

## Urgency Calculation Map

| Location | Current responsibility | Current owner assessment |
| --- | --- | --- |
| `server/lib/triageRules.ts:642` | Main deterministic triage evaluation over symptom path, selected answer IDs, profile risk flags, and vitals. | Canonical candidate for symptom triage urgency. |
| `server/lib/triageRules.ts:92` | Rule-level ranking. | Keep with canonical triage engine. |
| `server/lib/triageRules.ts:99` | Maps rule levels to public urgency. | Keep with canonical triage engine. |
| `server/lib/triageRules.ts:138` | Stores path-specific emergency, same-day, 24-48 hour, monitor, and profile modifier rules. | Keep with canonical triage engine until content is externalized. |
| `server/routes/triage.ts:565` | Short-circuits selected critical red flags into a support/safety response. | Duplicate route-level emergency gate; future owner should be `src/triage/`. |
| `server/routes/triage.ts:574` | Determines whether deterministic answers are enough to complete the wizard. | Route flow logic that depends on clinical rule concepts. |
| `server/routes/triage.ts:1367` | Generates fallback next-step labels from summary urgency and answer IDs. | Should become response shaping over canonical decision output. |
| `server/routes/triage.ts:1407` | Applies deterministic safety floor to AI-generated summary. | Adapter should call canonical triage engine and merge output. |
| `server/routes/triage.ts:1424` | Finds urgent optional scan results. | Triage scan overlay should belong to `src/triage/` as an optional overlay. |
| `server/routes/triage.ts:1450` | Raises urgency to at least urgent for urgent optional scan results. | Triage scan overlay duplicate of urgency-floor concept. |
| `server/routes/triage.ts:1477` | Raises scan next step to at least `doctor_today`. | Triage scan overlay should remain parity-preserved. |
| `server/routes/triage.ts:1548` | Returns urgent support response for selected safety answer before LLM path. | Emergency gate should eventually call canonical triage red-flag decision. |
| `server/routes/triage.ts:1643` | Applies deterministic floor after OpenAI output. | Keep route as adapter only after migration. |
| `server/lib/dailySafetyCheck.ts:214` | Longitudinal Daily Safety status and recommended action. | Canonical Daily Safety logic, separate from symptom triage. |
| `server/routes/vitalsEngine.ts:769` | Builds deterministic Daily Safety check, optionally merges AI, stores pattern window, and records caregiver alert. | Adapter/orchestrator around `src/safety/` in target architecture. |
| `server/routes/reports.ts:148` | Records triage report handoff to doctor/caregiver recipients. | Report delivery side effect, not clinical urgency source. |
| `src/pages/SymptomCheckScreen.tsx:404` | Converts summary `nextStepLevel` or urgency into report display configuration. | Client display only. |
| `src/pages/InformesScreen.tsx:70` | Converts stored urgency into report badge styling. | Client display only. |

## Threshold Map

This section records current thresholds only. It does not recommend changes.

| Signal | Location | Current threshold behavior |
| --- | --- | --- |
| SpO2 | `server/lib/triageRules.ts:694` | `<=88` can raise to `emergency` for chest, breathing, tired, confusion, or fever. |
| SpO2 | `server/lib/triageRules.ts:701` | `<=92` can raise to `doctor_today` for chest, breathing, tired, or fever. |
| SpO2 | `server/lib/dailySafetyCheck.ts:160` | `<=88` maps to Daily Safety `urgent_help`. |
| SpO2 | `server/lib/dailySafetyCheck.ts:162` | `<=92` maps to Daily Safety `contact_doctor`. |
| Respiratory rate | `server/lib/triageRules.ts:710` | RR is evaluated for infection-like symptom paths. |
| Respiratory rate | `server/lib/triageRules.ts:711` | `>=25` can raise to `emergency`. |
| Respiratory rate | `server/lib/triageRules.ts:717` | `>=21` can raise to `doctor_today`. |
| Respiratory rate | `server/routes/triage.ts:1421` | Route-level `abnormalBreathingRate` is `>=24` or `<=10`. |
| Respiratory rate | `server/routes/triage.ts:1251` | Vitals report note says `>=24` or `<=10` should be shared with a clinician. |
| Respiratory rate | `server/lib/dailySafetyCheck.ts:142` | `>=30` or `<=8` maps to Daily Safety `urgent_help`. |
| Respiratory rate | `server/lib/dailySafetyCheck.ts:144` | `>=24` or `<=10` maps to Daily Safety `contact_doctor`. |
| Respiratory rate | `server/lib/dailySafetyCheck.ts:145` | `>=21` maps to Daily Safety `recheck`. |
| BP | `server/lib/triageRules.ts:775` | Systolic `>=180` or diastolic `>=120` plus chest, pain, dizzy, confusion, or breathing symptom path can raise to `emergency`. |
| BP | `server/lib/triageRules.ts:781` | Systolic `>=180` or diastolic `>=120` without the symptom-path context can raise to `doctor_today`. |
| BP | `server/lib/triageRules.ts:789` | Systolic `<90` plus fever, dizzy, tired, confusion, or fall can raise to `emergency`. |
| BP | `server/lib/triageRules.ts:795` | Systolic `91-100` plus fever, dizzy, tired, or confusion can raise to `doctor_today`. |
| BP | `server/lib/dailySafetyCheck.ts:148` | Systolic `>=180` maps to Daily Safety `urgent_help`. |
| BP | `server/lib/dailySafetyCheck.ts:150` | Systolic `>=160` maps to Daily Safety `contact_doctor`. |
| BP | `server/lib/dailySafetyCheck.ts:151` | Systolic `>=140` maps to Daily Safety `recheck`. |
| Glucose | `server/lib/triageRules.ts:804` | Glucose is evaluated for dizzy, tired, confusion, stomach, fever, and other. |
| Glucose | `server/lib/triageRules.ts:805` | `<54`, or `<70` with unsafe symptoms, can raise to `emergency`. |
| Glucose | `server/lib/triageRules.ts:811` | `<70` can raise to `doctor_today`. |
| Glucose | `server/lib/triageRules.ts:817` | `>=300` with poor intake, strong symptoms, new confusion, or stomach path can raise to `emergency`. |
| Glucose | `server/lib/dailySafetyCheck.ts:155` | `<=54` or `>=400` maps to Daily Safety `urgent_help`. |
| Glucose | `server/lib/dailySafetyCheck.ts:156` | `<=70` or `>=250` maps to Daily Safety `contact_doctor`. |
| Glucose | `server/lib/dailySafetyCheck.ts:157` | `<=80` or `>=180` maps to Daily Safety `recheck`. |

## Caregiver Escalation Map

| Location | Current behavior | Proposed owner |
| --- | --- | --- |
| `server/routes/reports.ts:148` | Symptom report handoff inserts `triage_report` caregiver alert when doctor or caregiver recipients exist. | Report adapter; shared helper may live in `src/safety/` later. |
| `server/lib/dailySafetyCheck.ts:115` | Daily Safety status rank decides whether a status should escalate. | `src/safety/`. |
| `server/lib/dailySafetyCheck.ts:281` | Daily Safety creates caregiver note for statuses at or above `share_with_caregiver`. | `src/safety/`. |
| `server/routes/vitalsEngine.ts:378` | Consent parser allows caregiver health alert delivery. | Shared caregiver helper in `src/safety/`. |
| `server/routes/vitalsEngine.ts:399` | Vitals engine records caregiver alert for escalating Daily Safety statuses. | Route adapter around shared helper. |
| `server/routes/vitalsEngine.ts:427` | Avoids duplicate open Daily Safety alerts within 12 days. | Persistence adapter. |
| `server/routes/vitalsEngine.ts:450` | Inserts `caregiverAlerts` record with severity derived from safety status. | Persistence adapter. |

## Profile Modifier Map

| Location | Current behavior | Proposed owner |
| --- | --- | --- |
| `server/routes/triage.ts:312` | Parses profile risk flags from health memory text. | `src/triage/` profile-normalization helper. |
| `server/routes/triage.ts:909` | Adds profile-aware quick replies for red-flag stage. | `src/triage/` content/flow helper, route adapter for delivery. |
| `server/routes/triage.ts:1026` | Prompts OpenAI to adapt concern to health memory. | AI enrichment prompt adapter; must not own deterministic rules. |
| `server/lib/triageRules.ts:667` | Applies protocol-level profile modifiers. | `src/triage/` deterministic engine. |
| `server/lib/triageRules.ts:938` | Low-immunity fever overlay. | `src/triage/` deterministic engine. |
| `server/lib/triageRules.ts:947` | Heart/breathing history overlay. | `src/triage/` deterministic engine. |
| `server/lib/triageRules.ts:956` | Diabetes/kidney/diuretic overlay. | `src/triage/` deterministic engine. |
| `server/lib/triageRules.ts:965` | Blood thinner/stroke/hypertension overlay. | `src/triage/` deterministic engine. |
| `server/routes/triage.ts:1210` | Adds profile explanation notes to summaries. | Response shaping from canonical decision metadata. |

## Rule Storage

Current rule storage is mixed:

- Symptom path rules are hardcoded TypeScript in `server/lib/triageRules.ts:138`.
- Wizard path questions and answer IDs are hardcoded TypeScript in `server/lib/triageWizardMatrix.ts:61`.
- Vitals thresholds for symptom triage are hardcoded TypeScript in `server/lib/triageRules.ts:694`.
- Daily Safety thresholds are hardcoded TypeScript in `server/lib/dailySafetyCheck.ts:142`.
- Optional triage scan types are hardcoded TypeScript in `shared/triageScans.ts:1`.
- Optional scan analysis prompts are hardcoded TypeScript in `server/routes/triageScan.ts:37`.
- Persisted outputs are stored in database tables declared in `shared/schema.ts:388` and `shared/schema.ts:1023`.

No JSON or YAML content source currently owns the clinical triage rules.

## Canonical Ownership Proposal

This proposal is about code ownership only. It is not a clinical change proposal.

### `src/triage/`

Own these after parity tests exist:

- Symptom paths and answer IDs.
- Deterministic triage urgency calculation.
- Next-step level calculation.
- Vitals overlays used by symptom triage.
- Profile risk flags and modifiers used by symptom triage.
- Optional triage scan overlay that can raise to current scan floors.
- Regression fixture runner for parity checks.

### `src/safety/`

Own these after parity tests exist:

- Daily Safety longitudinal status.
- Shared status ranking and caregiver-escalation helpers.
- Shared consent parsing for caregiver health alerts.
- Shared caregiver-alert severity mapping.

### Server Routes

Keep routes as adapters for:

- Authentication and entitlements.
- Persistence.
- Third-party AI enrichment.
- Request validation.
- Response shaping.
- Audit/logging side effects.

## Duplicated Implementations To Eventually Remove

Do not remove these in this PR. Remove only after golden parity tests pass.

- `server/routes/triage.ts:565` and `server/lib/triageRules.ts:686` both treat critical red flags as emergency concepts.
- `server/routes/triage.ts:1367` and `server/lib/triageRules.ts:105` both own next-step wording.
- `server/routes/triage.ts:1421` duplicates respiratory abnormality thresholds outside `server/lib/triageRules.ts:710`.
- `server/routes/triage.ts:1210` duplicates profile explanation logic outside rule evaluation metadata.
- `src/lib/triageScanOffers.ts:40` contains emergency-blocking IDs that overlap red-flag concepts in `server/routes/triage.ts:128` and `server/lib/triageRules.ts:138`.
- `server/lib/dailySafetyCheck.ts:142` and `server/lib/triageRules.ts:694` both define vitals thresholds, but they serve different products. They should remain separate unless a shared threshold catalog can preserve context-specific outcomes.
- `server/routes/reports.ts:148` and `server/routes/vitalsEngine.ts:399` both insert caregiver alerts with separate eligibility logic.

## Adjacent Scan And Image Systems

`server/routes/woundScan.ts` is a broader medical image assistant route and is not part of current deterministic symptom triage rules. Its adjacent image taxonomy includes `xray`, `wound_photo`, `stool_image`, `skin_lesion`, `other_medical_image`, and `unclear` in `server/routes/woundScan.ts:19`. It should remain out of triage consolidation unless a future product decision explicitly connects it to triage decisions.

`server/routes/triageScan.ts` is in scope only because its `TriageScanResult.concernLevel` feeds `server/routes/triage.ts:1424` as an optional overlay. Its image interpretation prompt remains an AI enrichment layer, not a deterministic clinical rule source.

## Migration Plan

1. Freeze current behavior with inventories.
   - Use `artifacts/triage-rule-inventory.json` and `artifacts/triage-threshold-inventory.json` as parity fixtures.
   - Add golden tests before any logic moves.

2. Introduce `src/triage/` behind existing route behavior.
   - Move no behavior until test parity covers symptom path decisions, next-step labels, vitals overlays, profile modifiers, and scan overlays.
   - Keep server routes calling the same public behavior.

3. Extract deterministic triage decisions.
   - Keep current public interfaces stable.
   - Return structured decision metadata for reasons, profile notes, vitals notes, and scan notes.

4. Convert `server/routes/triage.ts` to an adapter.
   - Leave auth, entitlement, AI enrichment, MediSearch context, and response shaping in the route.
   - Remove duplicate route-level rule calculations only after parity tests prove no response shape changes.

5. Introduce `src/safety/` around Daily Safety.
   - Preserve `daily-safety-v1`.
   - Preserve current `buildDailySafetyCheck`, status ranking, caregiver note, and caregiver escalation behavior.

6. Consolidate caregiver alert helpers.
   - Share consent parsing and severity mapping.
   - Keep persistence and duplicate-alert windows route/database owned.

7. Retire duplicates incrementally.
   - Remove one duplicate owner at a time.
   - Compare against inventories and golden tests after each move.
   - Do not change clinical thresholds or outcomes while consolidating.

## Validation For This PR

- Confirm only this document and the two inventory artifacts changed.
- Run `git diff --check`.
- Parse both inventory JSON files.
- Manually verify that inventory entries cite real source files and line references.
