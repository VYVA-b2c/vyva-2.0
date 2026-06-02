# Brain Coach Caregiver Loop Audit

Date: 2026-06-02
Branch: `audit/brain-coach-caregiver-loop`
Base audited: `origin/main` at `addd7df`

This is a report-only audit. No product code was changed.

## Executive Verdict

The caregiver-controlled Brain Coach loop is largely in place for V1: senior consent can grant exact Brain Coach permissions, caregiver dashboard controls are gated by those permissions, plan preferences feed the deterministic planner, in-app nudges are stored without outbound communication, and the senior Activities screen can surface the latest caregiver nudge through the persisted daily plan response.

The largest remaining weakness is schedule truth. The caregiver Brain Coach panel exposes "schedule rhythm" controls, but those controls update `cognitive_caregiver_settings`, not the existing `scheduled_interactions` `BRAIN_COACH` row. That means caregiver schedule edits influence planner preference copy and pause state, but do not yet reliably govern scheduled Brain Coach calls.

## Verified Loop

1. Senior grants Brain Coach access in `src/pages/settings/PrivacySettings.tsx`.
2. Permission updates call `PATCH /api/caregiver/brain-coach/permissions/:membershipId`.
3. Backend stores exact permissions under `profile_memberships.permissions.brain_coach`.
4. Backend access is centralized in `server/lib/brainCoachCaregiverAccess.ts`.
5. Caregiver dashboard reads summary/settings from `server/routes/caregiverBrainCoach.ts`.
6. Caregiver controls are disabled with senior-consent messaging when permissions are missing.
7. Plan settings write to `cognitive_caregiver_settings` and are audited in `consent_audit_logs`.
8. Deterministic plan generation merges caregiver settings through `mergeCaregiverSettingsIntoPreferences`.
9. In-app nudges write a `caregiver_nudge` event to `cognitive_daily_plan_events`.
10. `/api/games/daily-plan` projects the latest nudge as `caregiverNudge`.
11. `src/pages/ActivitiesScreen.tsx` renders the caregiver nudge on the senior Brain Coach surface.

## Permission Coverage

| Permission | Verified behavior |
| --- | --- |
| `view_summary` | Allows caregiver read-only Brain Coach summary/settings view. Legacy care-team dashboard + journal summary consent maps to this. |
| `manage_plan_preferences` | Allows preferred domains, excluded activities, weekly goal, and session length edits. |
| `manage_schedule` | Allows caregiver edits to preferred training time and pause state in Brain Coach settings. It does not update `scheduled_interactions`. |
| `send_nudges` | Allows in-app-only Brain Coach nudges when today's daily plan already exists. |
| `preview_plan` | Allows deterministic plan preview without persisting a plan. |

## Audit Log Coverage

Audited:

- Senior permission updates: `brain_coach_permission_update`.
- Caregiver/self settings changes: `brain_coach_settings_caregiver` or `brain_coach_settings_self`.
- Caregiver/self nudges: `brain_coach_nudge_caregiver` or `brain_coach_nudge_self`.

Not audited:

- Plan preview requests. This is acceptable for a non-persisting preview, but it is still a visibility gap if previews become operationally important.

## Findings

### 1. Schedule Controls Do Not Update Scheduled Brain Coach Calls

Impact: High. A caregiver can believe they changed Brain Coach scheduling, but scheduled call records may remain unchanged.

Complexity: Medium.

Estimated effort: 2-3 engineering days.

Priority: P1.

Evidence: `cognitive_caregiver_settings.preferredTrainingTimes` and `paused` are updated by caregiver APIs, while `scheduled_interactions` has a separate `BRAIN_COACH` schedule path in `server/routes/scheduledSupport.ts`.

### 2. Caregiver Nudges Require Today's Plan To Already Exist

Impact: Medium-high. If the senior has not opened Brain Coach and generated today's persisted plan, the caregiver receives a 409 and cannot send the nudge.

Complexity: Low-medium.

Estimated effort: 1 day.

Priority: P1.

Evidence: `POST /api/caregiver/brain-coach/:profileId/nudges` calls `loadTodayPlan` and returns "Today's Brain Coach plan is not available yet" when no plan exists.

### 3. In-App Nudges Are Only Visible Through Brain Coach Plan Fetch

Impact: Medium. The nudge is safe and in-app only, but it is passive; the senior must reach the Activities/Brain Coach surface and fetch the daily plan.

Complexity: Medium.

Estimated effort: 2-3 engineering days.

Priority: P2.

Evidence: Nudges are stored in `cognitive_daily_plan_events` and surfaced by `/api/games/daily-plan`, not by a general notification/inbox surface.

### 4. Full Authenticated Browser E2E Is Still Missing

Impact: Medium. Unit and component coverage is good, but the exact senior consent to caregiver dashboard to senior Activities loop is not yet covered as one authenticated browser scenario.

Complexity: Medium.

Estimated effort: 2-3 engineering days.

Priority: P2.

Evidence: Focused tests cover the individual pieces, but no single browser test creates senior/caregiver state, toggles permissions, sends a nudge, and verifies senior rendering.

### 5. Plan Preview Is Not Audit-Logged

Impact: Low-medium. Preview is read-only today, but it still exposes caregiver influence over future plan intent.

Complexity: Low.

Estimated effort: 0.5 day.

Priority: P3.

### 6. Protected Route Smoke Has Unrelated Startup Noise

Impact: Low. Unauthenticated protected routes redirect to login, but smoke output includes `/api/profile` returning 500 and a blocked `freeipapi.com` lookup.

Complexity: Low.

Estimated effort: 0.5-1 day.

Priority: P3.

## ROI Ranking

Highest ROI:

- Sync caregiver `manage_schedule` changes to the `BRAIN_COACH` scheduled interaction.
- Allow caregiver nudge flow to create or fetch today's persisted plan before sending.
- Add one authenticated end-to-end caregiver loop test.

Medium ROI:

- Add a small in-app notification/read state for caregiver nudges.
- Audit plan preview events.
- Improve empty/no-plan caregiver dashboard copy so caregivers know what action is blocked and why.

Low ROI:

- Clean unrelated unauthenticated smoke noise.
- Add extra dashboard polish beyond the current consent-disabled states.

## Recommended Next Build

If there is only one short follow-up slot, build schedule synchronization first. It is the highest-risk mismatch because the UI currently says "Schedule rhythm" while the authoritative scheduled call system lives elsewhere. The fix should make `manage_schedule` update the active `scheduled_interactions` `BRAIN_COACH` row, audit the schedule row id, and keep `cognitive_caregiver_settings` as planner preference state.

After that, make nudges robust by ensuring today's persisted plan exists before accepting the nudge. That closes the most likely caregiver-facing 409.

## Validation

Passed:

- `npm test -- src/pages/settings/PrivacySettings.test.tsx src/pages/CaregiverDashboardPage.test.tsx src/pages/ActivitiesScreen.test.tsx src/lib/brainCoachCaregiverPermissions.test.ts`
  - 4 files passed, 22 tests passed.
- Server focused tests with local test database:
  - `server/__tests__/brainCoachCaregiverAccess.test.ts`
  - `server/__tests__/brainCoachCaregiverAccessResolver.test.ts`
  - `server/__tests__/brainCoachCaregiverSettings.test.ts`
  - `server/__tests__/games.test.ts`
  - `server/__tests__/brainCoachPlanLifecycle.test.ts`
  - 5 files passed, 28 tests passed.
- `npm run typecheck`
- `npm run build`

Blocked / warning:

- `npm run lint` failed on an existing unrelated warning in `src/pages/SharedCheckinReport.tsx:206`.

Browser smoke:

- With frontend and backend running locally, unauthenticated `/caregiver-dashboard` and `/activities` redirected to `/login`.
- Console noise observed from expected unauthenticated `/api/auth/me` 401, `/api/profile` 500, and blocked `freeipapi.com` lookup.
