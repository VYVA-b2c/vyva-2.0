# Senior Symptom Triage Content Specification

This document describes the senior symptom triage system currently implemented in the repository. It is a source-of-truth description of existing behavior only. It does not propose new behavior, redesign clinical rules, add thresholds, or define future content.

Primary implementation references:

- `src/triage/`
- `server/routes/triage.ts`
- `server/routes/reports.ts`
- `server/routes/triageScan.ts`
- `server/lib/triageWizardMatrix.ts`
- `server/lib/dailySafetyCheck.ts`
- `server/routes/vitalsEngine.ts`

Note: there is no `src/safety/` directory in the current repository snapshot. Daily Safety deterministic logic is currently implemented in `server/lib/dailySafetyCheck.ts`.

## 1. Purpose

The senior symptom triage system helps an older adult describe a current symptom, answer structured safety questions, and receive a deterministic next-step recommendation. The system is assistive and safety-oriented. It does not diagnose conditions or replace clinician judgment.

The implemented flow has three main responsibilities:

- Guide the user through a symptom-specific wizard.
- Calculate a deterministic urgency and next-step level from structured answers, profile risk flags, vitals, and optional scan results.
- Produce a report summary that can be saved and handed off to doctor or caregiver recipients when configured.

The current production triage path starts at `server/routes/triage.ts` and calls exported helpers from `src/triage/index.ts`. The deterministic rule engine is in `src/triage/engine/evaluateTriage.ts`, vitals overlays are in `src/triage/engine/evaluateVitalsOverlay.ts`, profile overlays are in `src/triage/engine/evaluateProfileModifiers.ts`, and route-level deterministic outcome shaping is in `src/triage/engine/routeOutcome.ts`.

## 2. Safety Principles

The implemented safety model follows these principles:

- Deterministic rules are the safety authority for urgency and next-step floors.
- Selected critical red flags short-circuit the route into a safety alert before OpenAI summary generation.
- OpenAI may enrich wording, but the route applies `evaluateTriageSafetyFloor` to prevent AI output from downgrading deterministic urgency.
- MediSearch may provide evidence context and follow-up chips, but it does not own deterministic urgency.
- Optional scan results can raise urgency to at least `urgent` and next step to at least `doctor_today`; they do not replace emergency red-flag handling.
- Telemetry is non-blocking and must not change triage outcomes.
- The user-facing disclaimer states that the assessment is informational and is not medical advice.

Critical red flags are listed in `CRITICAL_RED_FLAG_IDS` in `src/triage/engine/routeOutcome.ts`. When `selectedSafetyAnswer` finds one of these answers, `server/routes/triage.ts` returns a safety alert with emergency-contact guidance and support-stage quick replies.

## 3. Urgency Levels

The engine uses four internal next-step levels and maps them to three public urgency values.

| Next-step level | Public urgency | Current label behavior |
| --- | --- | --- |
| `emergency` | `urgent` | Call emergency services now. |
| `doctor_today` | `urgent` | Talk to a doctor today. |
| `doctor_24_48` | `routine` | Talk to a doctor within 24-48 hours. |
| `monitor` | `monitor` | Monitor at home, with doctor access ready. |

`evaluateTriage.ts` ranks levels in this order: `emergency`, `doctor_today`, `doctor_24_48`, `monitor`. The highest matching rule wins. `routeOutcome.ts` then merges deterministic reasons, recommendations, watch signs, profile considerations, vitals notes, scan notes, and the final next-step label into the returned summary.

## 4. Symptom Paths

The implemented wizard has 12 symptom paths. The wizard questions and quick replies live in `server/lib/triageWizardMatrix.ts`. The deterministic path protocols live in `src/triage/engine/evaluateTriage.ts`.

| Path id | User-facing path | Current deterministic behavior summary |
| --- | --- | --- |
| `chest` | Chest discomfort | Emergency for chest pressure, rest symptoms, breathing trouble, faintness/sweating, spreading pain, coughing blood, one swollen calf, strong symptoms, or worsening. Otherwise new or unexplained chest discomfort generally receives same-day doctor advice. |
| `pain` | Pain/headache | Emergency for chest pain, sudden severe pain, stroke signs, back/bladder/weakness symptoms, fever/stiff neck headache, or cold/blue limb. Same-day advice applies to fall-related pain, new headache after 50, night back pain, or limb deformity. |
| `breathing` | Breathing | Emergency for inability to speak, breathlessness at rest, blue/confused appearance, chest pain with breathing symptoms, coughing blood, one swollen calf, low oxygen, or strong breathing symptoms. Same-day advice applies to worse-than-usual breathing, worse lying flat, fever/cough/phlegm, worsening, or new symptoms. |
| `fever` | Fever | Emergency for confusion with fever, sepsis-like signs, stiff neck, low-immunity fever, or cancer-treatment fever. Same-day advice applies to high fever, urine/back symptoms, breathing symptoms, wound symptoms, low urine/weakness, uncertain trend, week-plus fever, worsening, new symptoms, or strong symptoms. |
| `dizzy` | Dizziness/faintness | Emergency for unresolved fainting, fainting with chest symptoms, stroke signs, chest pain, or inability to stand. Same-day advice applies to fall risk, standing dizziness, head-movement dizziness, strong symptoms, worsening, or new symptoms. |
| `tired` | Very tired/weak | Emergency for one-sided weakness, inability to stand, hard-to-wake state, new confusion, chest/breathing symptoms, opioid breathing risk, low sugar, or high sugar with sickness. Same-day advice applies to infection signs, poor drinking, strong symptoms, worsening, or new symptoms. |
| `stomach` | Stomach/bowel | Emergency for severe abdominal pain, blood/vomit/stool concerns, rigid belly, inability to pass stool/gas, inability to pee, or collapse. Same-day advice applies to inability to keep fluids, fever or severe pain, diabetes with vomiting, worsening today, vomiting/diarrhea for 24 hours, strong/worse/new symptoms, or poor drinking. Some constipation or ongoing symptoms map to `doctor_24_48`. |
| `urinary` | Urine problem | Emergency for inability to pee, urine symptoms with confusion or weakness, or heavy blood. Same-day advice applies to fever/back pain, chills, side pain, blood, catheter symptoms, strong symptoms, worsening, or new symptoms. Mild ongoing urine symptoms can map to `doctor_24_48`; profile risk can raise this. |
| `fall` | Fall/injury | Emergency for head hit with red flags, inability to stand, heavy bleeding, deformity, or hip/back pain after fall. Same-day advice applies to head hit on blood thinner, loss of consciousness, fall from height, being alone after fall, strong symptoms, or worsening. Moderate painful but usable injury can map to `doctor_24_48`. |
| `skin` | Skin/wound/rash | Emergency for allergic swelling, skin sepsis signs, or non-fading rash. Same-day advice applies to spreading wound, fever after surgery, shingles near the eye, shingles with immune risk, early shingles, pus/bad smell, uncertain trend, strong symptoms, worsening, or new symptoms. |
| `confusion` | Confusion/not like myself | Emergency for sudden confusion, hard-to-wake state, stroke signs, urine-related confusion or weakness, sepsis signs, new confusion, or self-harm concern. Same-day advice applies to unsafe behavior, medicine-change confusion, strong symptoms, worsening, or new symptoms. Mild slow changes can map to `doctor_24_48`. |
| `other` | Something else | Emergency for unclear symptoms with serious warning signs such as inability to stand, new severe symptoms, new confusion, hard-to-wake state, chest pain, breathlessness at rest, stroke signs, unresolved fainting, severe bleeding, or allergic swelling. Same-day advice applies to unclear symptoms involving chest/breathing, neuro/fall, infection, sudden worsening, medication/surgery/fall context, strong/worse/new symptoms, or poor drinking. Unclear or non-improving symptoms can map to `doctor_24_48`. |

The adaptive stage flow is implemented in `nextAdaptiveStage` in `src/triage/engine/routeOutcome.ts`. The route asks one wizard question at a time until the stage reaches `complete` or a safety alert is selected.

## 5. Profile Modifiers

Profile risk flags are normalized in `profileRiskFlags` in `src/triage/engine/routeOutcome.ts` from health memory text, conditions, allergies, medications, latest vitals, and latest symptom report.

Current recognized profile flags include:

- Diabetes or glucose medication.
- COPD, asthma, oxygen therapy, or home oxygen.
- Heart failure or fluid risk.
- Heart disease.
- Atrial fibrillation or irregular heartbeat.
- Hypertension or stroke risk.
- Blood thinner or bleeding risk.
- Low immunity, cancer treatment, steroid use, transplant, or chemotherapy.
- Cognitive concern, dementia, memory loss, or confusion.
- Kidney disease or dialysis.
- Stroke or TIA history.
- Falls, frailty, walking aid, or balance risk.
- Parkinson's, mobility, or swallowing risk.
- Osteoporosis or fragility fracture history.
- Active cancer.
- Recent surgery or hospital discharge.
- UTI history.
- Liver disease.
- Depression, anxiety, self-harm, or loneliness terms.
- Sedating medication.
- Opioid medication.
- Diuretic medication.

Profile modifiers affect the system in three places:

- Profile-aware red-flag quick replies in `profileRedFlagReplies` in `server/routes/triage.ts`.
- Per-path protocol profile modifiers in `TRIAGE_PROTOCOLS` in `src/triage/engine/evaluateTriage.ts`.
- Global profile overlays in `evaluateProfileModifiers.ts`.

The global profile overlays currently raise concern for:

- Fever with low immunity, cancer, or steroid risk.
- Breathing, weakness, dizziness, fall, or confusion changes with heart or breathing history.
- Dizziness, tiredness, fever, urine, stomach, confusion, or unclear symptoms with diabetes, kidney disease, or diuretic risk and a dehydration/strong/worse pattern.
- Pain, dizziness, fall, confusion, or unclear symptoms with blood thinner, stroke history, or hypertension and strong/worse/new symptoms.

Profile consideration notes are generated in `profileConsiderationsFor` in `routeOutcome.ts`.

## 6. Vitals Overlays

Symptom triage vitals overlays are implemented in `src/triage/engine/evaluateVitalsOverlay.ts`. They are context-sensitive and depend on symptom path and selected answer IDs.

| Signal | Current triage overlay behavior |
| --- | --- |
| Oxygen saturation | `<=88` raises to `emergency` for chest, breathing, tired, confusion, or fever. `<=92` raises to `doctor_today` for chest, breathing, tired, or fever. |
| Respiratory rate | For fever, skin, urinary, stomach, or confusion, `>=25` raises to `emergency`; `>=21` raises to `doctor_today`. |
| Pulse | In infection-like paths, `>130` raises to `emergency`; `91-130` raises to `doctor_today`. For chest, breathing, dizzy, tired, or confusion, pulse `>=130` or `<=45` raises to `emergency`. |
| Temperature | Fever path with active cancer risk and temperature `>=38 C` raises to `emergency`. Infection-like paths with temperature `>=38 C` raise to `doctor_today`; temperature `<36 C` also raises to `doctor_today`. |
| Blood pressure | Systolic `>=180` or diastolic `>=120` plus chest, pain, dizzy, confusion, or breathing raises to `emergency`. The same BP threshold without that symptom context raises to `doctor_today`. Systolic `<90` plus fever, dizzy, tired, confusion, or fall raises to `emergency`. Systolic `91-100` plus fever, dizzy, tired, or confusion raises to `doctor_today`. |
| Glucose | For dizzy, tired, confusion, stomach, fever, or other, glucose `<54`, or `<70` with unsafe symptoms, raises to `emergency`. Glucose `<70` raises to `doctor_today`. Glucose `>=300` with poor drinking, strong symptoms, new confusion, or stomach path raises to `emergency`. |
| Abnormal vitals flags | Chest plus abnormal pulse or breathing rate raises to `doctor_today`. Breathing plus abnormal breathing rate raises to `doctor_today`. Dizzy, tired, confusion, or fall plus abnormal pulse raises to `doctor_today`. |

Vitals notes are generated by `vitalsNotesFor` in `routeOutcome.ts`. A respiratory rate `>=24` or `<=10` is specifically described as something to share with a clinician in the report note layer.

Daily Safety has a separate vitals threshold system in `server/lib/dailySafetyCheck.ts`. It is longitudinal and independent from symptom-path context. Current Daily Safety thresholds include:

- Pulse: `>=130` or `<=40` maps to `urgent_help`; `>=110` or `<=50` maps to `contact_doctor`; `>=100` or `<=55` maps to `recheck`.
- Respiratory rate: `>=30` or `<=8` maps to `urgent_help`; `>=24` or `<=10` maps to `contact_doctor`; `>=21` maps to `recheck`.
- Systolic BP: `>=180` maps to `urgent_help`; `>=160` maps to `contact_doctor`; `>=140` maps to `recheck`.
- Glucose: `<=54` or `>=400` maps to `urgent_help`; `<=70` or `>=250` maps to `contact_doctor`; `<=80` or `>=180` maps to `recheck`.
- Oxygen saturation: `<=88` maps to `urgent_help`; `<=92` maps to `contact_doctor`.
- Temperature: `>=39.5 C` maps to `urgent_help`; `>=38 C` maps to `contact_doctor`.

## 7. Caregiver Escalation

There are two implemented caregiver-related flows.

The symptom report handoff flow is in `server/routes/reports.ts`:

- `/api/reports/triage` validates and saves the triage report.
- `recordTriageReportHandoff` looks up GP and caregiver profile fields.
- If at least one GP or caregiver recipient exists, it inserts a `caregiverAlerts` record with `alert_type: "triage_report"` and `severity` equal to the saved triage urgency.
- The route returns `sent_to` with the handoff recipients.
- If a caregiver recipient is present, the route emits non-blocking `caregiver_escalation_triggered` telemetry.

The Daily Safety caregiver alert flow is in `server/routes/vitalsEngine.ts`:

- `runAnalysis` builds a deterministic Daily Safety check, optionally merges Claude output, stores the pattern window, and calls `maybeRecordCaregiverAlert`.
- `statusShouldEscalate` in `dailySafetyCheck.ts` returns true for statuses at or above `share_with_caregiver`.
- `maybeRecordCaregiverAlert` checks profile caregiver consent, accepted care-team invitations that can receive health alerts, and recent unresolved duplicate alerts.
- If eligible recipients exist, it inserts a `caregiverAlerts` record with `alert_type: "vitals_safety_check"`.

The triage engine telemetry type includes `caregiverEscalationTriggered`, but deterministic symptom triage currently sets that field to false. Caregiver side effects occur in route adapters and report/vitals persistence flows.

## 8. Daily Safety Interaction

Daily Safety is separate from symptom triage. Its current deterministic implementation is `server/lib/dailySafetyCheck.ts`, with route orchestration in `server/routes/vitalsEngine.ts`.

Daily Safety inputs include:

- Recent signal summaries.
- Latest saved triage report context.
- Medication adherence context.
- Language.

Daily Safety uses the latest triage report as one input:

- Latest triage `next_step_level: "emergency"` maps to Daily Safety `urgent_help`.
- Latest triage `next_step_level: "doctor_today"` maps to `contact_doctor`.
- Latest triage `next_step_level: "doctor_24_48"` maps to `contact_doctor`.

Daily Safety also considers baseline changes, repeated baseline changes, multiple signal deviations, and medication adherence. It emits `safety_status`, `recommended_action`, `risk_tier`, `risk_score`, `senior_message`, optional `caregiver_note`, contributing signals, pattern labels, and `rule_version`.

`mergeAiSafetySuggestion` can merge Claude output into the Daily Safety result, but it preserves the maximum safety status and risk score rather than allowing AI to downgrade deterministic findings.

## 9. OpenAI/MediSearch Interaction

OpenAI and MediSearch are route-adapter concerns in `server/routes/triage.ts`.

MediSearch:

- `getMediSearchTriageContext` is called during non-final wizard turns and final summary generation when the latest message is from the user.
- MediSearch context can provide evidence sources and follow-up chips.
- MediSearch failures are handled so deterministic wizard questions continue.
- MediSearch does not calculate urgency or own thresholds.

OpenAI:

- The route creates an OpenAI client with `OPENAI_API_KEY` and currently calls model `gpt-4o`.
- The system prompt tells OpenAI that the deterministic senior triage protocol is the safety authority.
- OpenAI is asked to return a final `TRIAGE_JSON` block only when the adaptive stage is complete.
- The route parses the JSON summary, then calls `evaluateTriageSafetyFloor`.
- If OpenAI is unavailable because no API key is configured, the route returns `buildFallbackTriageReportWithTelemetry`.
- If OpenAI returns no usable summary, the route falls back to the deterministic summary.

The deterministic route floor can change the summary urgency, next-step level, reasons, recommendations, watch signs, profile considerations, vitals notes, and scan notes after OpenAI output.

## 10. Rule Ownership

Current rule ownership is:

| Area | Current owner |
| --- | --- |
| Symptom path deterministic protocols | `src/triage/engine/evaluateTriage.ts` |
| Vitals overlays for symptom triage | `src/triage/engine/evaluateVitalsOverlay.ts` |
| Profile overlays for symptom triage | `src/triage/engine/evaluateProfileModifiers.ts` |
| Route-level deterministic outcome composition | `src/triage/engine/routeOutcome.ts` |
| Triage public exports | `src/triage/index.ts` |
| Compatibility adapter for current protocol exports | `src/triage/adapters/fromCurrentProtocol.ts` |
| Wizard question matrix and emergency contact lookup | `server/lib/triageWizardMatrix.ts` |
| Triage route transport, OpenAI, MediSearch, and response assembly | `server/routes/triage.ts` |
| Triage report persistence and report handoff | `server/routes/reports.ts` |
| Optional triage scan route | `server/routes/triageScan.ts` |
| Triage scan shared types | `shared/triageScans.ts` |
| Daily Safety deterministic rules | `server/lib/dailySafetyCheck.ts` |
| Daily Safety route, persistence, Claude merge, and caregiver alert side effects | `server/routes/vitalsEngine.ts` |
| Triage observability | `src/triage/telemetry/` plus route calls in `server/routes/triage.ts` and `server/routes/reports.ts` |

Current rule storage is TypeScript. There is no YAML, JSON, or database-backed clinical content store for triage rules in the current implementation.

## 11. Test Coverage

Current relevant test coverage includes:

- `src/triage/__tests__/parity.test.ts`: deterministic engine parity for the 12 production symptom protocols and threshold/profile behavior.
- `src/triage/__tests__/routeParity.test.ts`: parity for route-owned outcome behavior now exposed through `src/triage`, including optional scan floor, profile normalization, adaptive completion, and deterministic safety-floor composition.
- `src/triage/__tests__/telemetry.test.ts`: telemetry event emission, failure isolation, unchanged summary shape, vitals/profile metadata, and direct engine telemetry.
- `src/lib/triageProtocols.test.ts`: protocol rule coverage.
- `src/lib/triageWizardMatrix.test.ts`: wizard matrix coverage.
- `server/__tests__/triage-route.test.ts`: route response shape, deterministic fallback, telemetry, optional scan notes/escalation, MediSearch follow-ups, MediSearch failure handling, safety alert behavior, and post-report vital refinement.
- `server/__tests__/triage-scan-route.test.ts`: optional scan route validation and structured result behavior.
- `server/__tests__/daily-safety-check.test.ts`: Daily Safety deterministic rules, repeated baseline changes, AI non-downgrade, and latest emergency triage interaction.
- `server/__tests__/vitals-engine-auth.test.ts`: vitals engine authentication boundaries.
- `src/components/TriageChat.test.tsx`: client handoff behavior for language, follow-up chips, safety alerts, and optional scan result flow.

The current tests are regression and parity tests around the implemented behavior. They are not a complete clinical validation suite.

## 12. Governance

Current governance is implemented through repository structure, deterministic code ownership, tests, and route safety floors:

- Deterministic clinical behavior is held in code, not in generated prompt text.
- The route states that deterministic triage is the safety authority.
- AI-generated summaries are passed through deterministic safety-floor logic before returning to the user.
- Daily Safety AI suggestions are merged without allowing a downgrade below deterministic status.
- Triage and safety rules are covered by parity and regression tests.
- Observability records categorical rule, path, modifier, overlay, completion, and escalation metadata without storing free-text symptoms, names, raw vital values, images, report content, or OpenAI/MediSearch payloads.
- Optional photo/scan analysis is described as appearance-only and is not a diagnostic source.
- The current source of truth for deterministic symptom triage is `src/triage/`.
- The current source of truth for Daily Safety is `server/lib/dailySafetyCheck.ts`.

Any repository change that alters thresholds, urgency mapping, symptom-path outcomes, profile modifiers, vitals overlays, caregiver escalation behavior, or route response shape changes this implemented specification and requires corresponding test updates.
