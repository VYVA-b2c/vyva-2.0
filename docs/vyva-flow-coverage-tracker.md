# VYVA Flow Coverage Tracker

Source of truth: Google Sheet `vyva workflow voice - final`.

This tracker keeps the product flow map centralized while implementation stays in small PR slices. A flow can be visible in the app before it is fully lifecycle-covered. Use the status column to decide the next slice.

## Status Key

- `covered`: implemented with start, detail collection, confirmation, handoff/outcome, and recovery/history where relevant.
- `partial`: visible or partly wired, but missing one or more lifecycle stages.
- `planned`: documented in the product flow map but not yet implemented as a guided flow.
- `deferred`: intentionally held for a later product/legal/ops decision.

## Concierge Track

| Flow | Visible entry points | Canonical reference | Status | Next implementation step |
| --- | --- | --- | --- | --- |
| Book ride / transport | Book Ride, Concierge ride handoff | `FLOW_TRANSPORT_BOOKING` | covered | Monitor provider replies and expand transport partners. |
| OTC pharmacy help | OTC pharmacy, medication support handoff | `FLOW_OTC_PHARMACY` | covered | Keep prescription medicines blocked; improve OTC item suggestions. |
| Medical appointment | Book Now, medical handoffs | `FLOW_MEDICAL_APPOINTMENT` | covered | Expand supported booking/form integrations. |
| Home service | Home Care, Find Plumber, home-service voice handoff | `FLOW_HOME_SERVICE` | covered | Monitor provider replies and expand provider search partners. |
| Scam / fraud check | Check Scam, scam voice handoff | `FLOW_SCAM_CHECK` | covered | Add direct email forwarding, camera/upload, phone verification, and live reputation lookup integrations. |
| Insurance / admin help | Insurance/admin, paperwork handoffs | `FLOW_INSURANCE_ADMIN` | covered | Expand direct email/call/upload execution behind confirmation. |
| Call, email, form, or application | Tool-gated voice handoffs | `FLOW_TOOL_GATED_TASK` | covered | Expand confirmed phone, email, WhatsApp, and external form tools. |
| Safe home / safety support | Safe Home, safety voice handoff | `FLOW_SAFE_HOME_SUPPORT` | covered | Monitor Safe Home task outcomes and expand direct upload/caregiver integrations. |
| Shopping / groceries / meals | Order In, Groceries, Prepared Meals | none yet | partial | Split groceries/meals from OTC pharmacy and add confirmation/outcome coverage. |
| Find care / residence | Find Care, Personal Care, Find Residence | `FLOW_TOOL_GATED_TASK` today | partial | Decide if this needs its own canonical flow or remains provider-search/tool-gated. |
| Government help | Government appointment/forms | `FLOW_INSURANCE_ADMIN` today | partial | Separate routine government bookings from insurance/admin documents if needed. |
| Paperwork help | Paperwork Help | `FLOW_INSURANCE_ADMIN` / `FLOW_TOOL_GATED_TASK` today | partial | Keep as tool-gated unless we add document-specific upload/review outcomes. |

## Health Track

| Flow | Visible entry points | Status | Next implementation step |
| --- | --- | --- | --- |
| Health picker | My Health | partial | Keep as router; align voice actions with sub-flow refs. |
| Symptom support | Feel Better | covered | Continue improving triage safety and report handoff quality. |
| Stay-well check-in | Stay Well | partial | Confirm daily check-in, reminder, and care-plan completion coverage. |
| Medication support | My Medication | partial | Audit dose, missed-dose, refill, side-effect, and reminder subflows. |
| Vitals review | My Vitals, Check Vitals | partial | Verify add-reading, trend, and service-action handoffs. |
| Reports summary | My Reports | partial | Add export/share confirmation coverage if not already done. |
| Visual scan | Visual Scan | partial | Confirm upload/save/share permissions and outcome history. |
| Doctor support | Talk Doctor | partial | Align notes, appointment prep, and Concierge handoff references. |

## Mind And Brain Training Track

| Flow | Visible entry points | Status | Next implementation step |
| --- | --- | --- | --- |
| Mind activity picker | My Mind | partial | Keep as router; ensure all cards route to real activity pages. |
| Memory activity | Strengthen Memory, Memory Check | partial | Finish cross-game tutorial persistence and results consistency. |
| Remember Later | Memory games | covered | Continue content tuning after live use. |
| Reflex / attention activity | Train Reflexes, Play Game | partial | Audit tutorial once-only logic and level progression. |
| Focus activity | Boost Focus, Calm Focus | planned | Define exact games/tasks included. |
| Senses activity | Sharpen Senses, Listen Closely | covered | Continue content expansion and asset quality. |
| Calm breathing | Relax Breathe | covered | Monitor safety-block rules and completion loop. |
| Learning activity | Learn Words / Learn Something New | partial | Continue visual lesson redesign and content strategy. |

## Community Track

| Flow | Visible entry points | Status | Next implementation step |
| --- | --- | --- | --- |
| Community picker | My Community, Join In | partial | Keep Join In routed to room list and reduce duplicate entry logic. |
| Join room | Room list / Join In | covered | Continue room-list usability and proximity rules. |
| Share plan | Together Room composer | covered | Monitor plan creation and sensitive-review notes. |
| Respond to plan | Plan cards | covered | Expand status/actions only if users need it. |
| Match / connect | Room connect actions | partial | Add clearer contact-permission and comfort checks. |
| Room reply | Room reply actions | covered | Continue tone/safety polish. |
| Vote / poll | Poll cards | covered | Keep simple; avoid overbuilding. |
| Safety report | Room safety help | covered | Continue moderation workflow hardening. |

## Next Suggested Slices

1. Shopping split: define groceries/meals as separate from OTC pharmacy, with provider/search criteria and final confirmation.
2. Health flow audit: map Medication, Vitals, Reports, Visual Scan, and Doctor Support to the same coverage model.
3. Safe Home upload/caregiver expansion: add direct media/caregiver integrations behind confirmation.
