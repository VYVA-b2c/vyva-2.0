# Voice Canvas real-device QA sign-off matrix

Status: **pending execution**  
Use this file to record the deployed, real-device launch-readiness pass for ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

Do not mark the Canvas launch-readiness goal complete until every required row below has a passing result, an evidence link or note, and a reviewer/date.

Keep `Status` as **pending execution** until this matrix is fully filled. For final launch sign-off, change it to **ready for launch** only after every required environment, device, behavior, rollback, copy/accessibility, privacy, and sign-off row remains present; every `Pending` cell is replaced with a passing result/evidence note; no row contains a failed/blocked/not-ready result; and all final sign-off roles have a name, a `YYYY-MM-DD` date, and an approved-for-launch decision. Then run:

```bash
npm run test -- src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts
```

## Environment record

| Field | Value |
| --- | --- |
| Environment URL | Pending |
| Build or commit SHA | Pending |
| Test account | Pending |
| Browser versions | Pending |
| Voice provider/session mode | Pending |
| Analytics sink reviewed | Pending |
| Initial flag state | Pending |
| Rollback flag state | Pending |

## Device coverage

Each flow must pass on a real phone, tablet, and desktop/laptop. Browser emulation is useful preflight evidence, but it does not replace this table.

| Flow | Phone | Tablet | Desktop/laptop | Evidence |
| --- | --- | --- | --- | --- |
| Ride Voice Canvas | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Pending | Pending | Pending | Pending |

## Required behavior checklist

Record one pass/fail line for each flow and behavior. If a behavior is not applicable, explain why and identify the substitute evidence.

| Flow | Start/resume | Refresh/reconnect | Browser back | Cancel/exit | Flag rollback/fallback | No external action before explicit confirmation | Duplicate/stale guard | Senior-friendly copy and what happens next | Privacy-safe analytics | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ride Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Feature endpoint and rollback checks

For each endpoint, verify disabled, enabled, malformed or missing config behavior, and an in-session rollback from Canvas to the existing path.

| Flow | Endpoint | Server key | Disabled payload checked | Enabled payload checked | In-session rollback checked | Existing fallback shown | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ride Voice Canvas | `/api/config/features/ride-voice-canvas` | `ride` | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | `/api/config/features/appointment-voice-canvas` | `appointment` | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | `/api/config/features/medication-refill-voice-canvas` | `medicationRefill` | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | `/api/config/features/shopping-delivery-voice-canvas` | `shoppingDelivery` | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | Pending | Pending | Pending | Pending | Pending |

## Copy and accessibility read-through

| Check | Result | Evidence |
| --- | --- | --- |
| English copy uses one clear decision at a time | Pending | Pending |
| Spanish copy and long labels remain readable without horizontal overflow | Pending | Pending |
| Waiting states explain what is happening and what is not happening | Pending | Pending |
| Blocked states explain what is needed and provide retry or exit | Pending | Pending |
| Completed states explain the outcome without implying extra action | Pending | Pending |
| Keyboard-only completion works for each flow | Pending | Pending |
| Focus moves meaningfully when scenes change | Pending | Pending |
| Screen-reader announcements fire for waiting, blocked, and completed states | Pending | Pending |
| Reduced-motion mode remains calm and usable | Pending | Pending |

## Analytics privacy review

Confirm production or staging analytics receives only the allowed Canvas telemetry envelope fields: `name`, `step`, `input`, `attempt`, `restored`, and `revision`.

| Forbidden data class | Result | Evidence |
| --- | --- | --- |
| Spoken transcripts | Pending | Pending |
| Typed free text | Pending | Pending |
| Addresses or saved-place labels | Pending | Pending |
| Medication names, strengths, quantities, or symptoms | Pending | Pending |
| Provider names, reply text, notes, references, phone numbers, or emails | Pending | Pending |
| Shopping item names, prices, fees, or retailer names | Pending | Pending |
| Dates, times, identities, or contact details | Pending | Pending |

## Final sign-off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Product | Pending | Pending | Pending | Pending |
| Engineering | Pending | Pending | Pending | Pending |
| QA | Pending | Pending | Pending | Pending |
| Operations/rollback owner | Pending | Pending | Pending | Pending |
