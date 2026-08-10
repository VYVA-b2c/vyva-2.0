# VYVA Flow Alignment Map

## Purpose

This map keeps the main implementation task and any parallel Flow task aligned.
It lists the current Flow surface, the presentation binding that should govern
it, and the remaining runtime contract gap.

## Current Alignment

| Area | Canonical Flow | Owner | Current presentation coverage | Runtime gap |
| --- | --- | --- | --- | --- |
| Home entry | `orchestration.start_flow` and routed domain Flows | `orchestration` | Screen contract locks voice-first and touch-card modes | Needs route-level contract selection once individual Flows start from Home |
| Health preventive | `health.preventive_check` | `preventive_health` | Preventive introduction, choice, scale, progress, interruption, resume, summary, followup | Needs focused runtime contract for persisted answers, interruptions, and output surface |
| Health symptoms | `health.symptom_assessment` | `symptom_assessment` | Catalogue exists; focused UI backlog exists | Needs Flow detail before visual binding is finalized |
| Visual health | `health.visual.*` | `visual_health` | Wound capture, consent, retake, context, safety, summary | Needs per-assessment runtime state and evidence handling |
| Medication | `medication.reminder` and related dose/refill Flows | `medication` | Reminder, confirmation, defer, missed dose, human help, followup | Needs runtime contract for adherence state, reminders, and caregiver/human help gates |
| Mental wellbeing | `wellbeing.support` | `mental_wellbeing` | Summary, check-in, safe fallback | Needs runtime contract for privacy, interruption, and safe fallback |
| Brain coach | `brain_coach.activity_session` | `brain_coach` | Catalogue and specialist migration exist | Needs explicit presentation binding for session levels, listening, pause, and completion |
| Concierge | `concierge.administrative_support` plus service Flows | `concierge` | Request intake, Trusted Help setup, shopping context, safe fallback | Needs runtime contracts per service: provider search, confirmation, payment/contact limits |
| Social | `social.community_connection` | `social` | Summary, rooms, activities, safe fallback | Needs runtime contract for rooms, invitations, caregiver visibility, and safe fallback |
| Trust and Safety | `trust.scam_assessment` | `scam_fraud` | Evidence, exposure, immediate actions, escalation, risk result, followup | Needs runtime contract for sensitive evidence, escalation, and recovery |
| Engagement | `engagement.notification_resume` and outbound call Flows | `engagement` | Notification resume, stale/expired/defer/cancel/fallback, phone fallback | Needs runtime contract for notification state, retry, and cross-flow resume |

## Decision Sequence

Use this order before building a Flow screen:

1. Define the user journey and subflow boundaries.
2. Confirm or add Flow Catalogue entries.
3. Confirm or add Presentation Registry entries.
4. Add a Flow runtime contract binding state, presentation, tools, and
   interruption policy.
5. Implement the live UI through the shared presentation contract.
6. Validate mobile, tablet, desktop, voice mode, touch mode, and interruption
   behavior.

## Parallel Task Handoff Rule

When another task proposes Flow work, it should return a row using this shape:

| Field | Required answer |
| --- | --- |
| Flow ID | Existing ID or proposed new canonical ID |
| Owner | Specialist owner |
| Entry trigger | User, schedule, push, caregiver, operator, system |
| Scenes | Semantic scene IDs |
| Persisted state | What must survive refresh/resume |
| Transient state | Voice/session/loading UI only |
| Presentation IDs | Existing or proposed registry IDs |
| Voice behavior | Orb/listening/speaking/status rules |
| Touch behavior | Cards/form/review/output rules |
| Tools | Allowed tools and provider boundaries |
| Approval gates | User/caregiver/operator/clinical gates |
| Interruptions | Stop, SOS, timeout, mode switch, caregiver, safety |
| Tests | Contract, screen, and runtime assertions |

If a row cannot be filled, the Flow is not ready for implementation yet.
