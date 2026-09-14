# Proactive Engagement Shadow Policy

Task 8 implements Stage 3 as an audit-only proactive engagement policy runtime.
It normalizes due-schedule facts, consent, channel preferences, quiet hours,
limits, fallback and durable audit decisions without sending outreach.

Task 8 does not send push notifications, SMS, WhatsApp, email or calls. It does
not call Twilio, ElevenLabs, Resend, SendGrid, SMTP, Mem0, Specialists, Tools or
the Central Orchestrator policy engine. An `allow` decision is only an audited
shadow-policy result, not dispatch authorization. A `block` decision is only an
audited shadow-policy result, not suppression of current live behavior.

## Runtime status

- Default mode: disabled.
- Supported runtime mode: `audit_shadow`.
- Delivery authority: none.
- Dispatcher authority: none.
- Candidate delivery: not implemented and not approved.
- Authoritative delivery: not implemented and not approved.
- Live dispatcher behavior: unchanged.

The current implementation provides:

- shared strict contracts in `shared/engagement/proactiveEngagement.ts`;
- a deterministic policy evaluator in `server/engagement/proactivePolicy.ts`;
- a pure scheduled-interaction snapshot adapter in
  `server/engagement/schedulePolicyAdapter.ts`;
- a default-disabled shadow observer in `server/engagement/proactiveRuntime.ts`;
- idempotent audit persistence in
  `server/engagement/proactiveAuditPersistence.ts`;
- minimized replaceable telemetry in `server/engagement/proactiveTelemetry.ts`;
- one additive audit migration:
  `migrations/0077_proactive_engagement_shadow_audit.sql`.

No live route, dispatcher, provider or worker imports the Task 8 runtime in this
stage.

## Supported repository facts

Task 8 is based on existing repository evidence:

- schedules: `scheduled_events`, `scheduled_interactions`;
- logs/outcomes: `scheduled_event_logs`, `interaction_logs`,
  `communications_log`, `consent_attempts`;
- consent: `consent_log`, `consent_audit_logs`,
  `profiles.data_sharing_consent`, schedule consent fields;
- preferences: `user_channel_preferences`, `user_channel_identity`,
  concierge notification preference;
- quiet hours/timezone: scheduled-interaction quiet hours and timezone,
  profile timezone, existing daily check-in local-day logic;
- delivery infrastructure: current communication dispatcher and provider
  adapters are inspected but not called.

## Contract model

All Task 8 contracts use schema version `1.0.0` and fixed
`nonExecutable: true`.

The evaluation input contains only minimized facts:

- schedule occurrence ID and schedule ID;
- purpose ID;
- due and evaluated timestamps;
- IANA timezone;
- purpose/channel consent facts;
- channel preferences and eligible candidates;
- quiet-hours policy;
- recent attempt summaries without message content;
- explicit limit/fatigue policy facts;
- existing audit states for duplicate detection;
- source classification.

The policy decision contains:

- `allow` or `block`;
- proposed channel only for `allow`;
- considered fallback chain;
- closed reason codes;
- consent, quiet-hours, limit and duplicate classifications;
- `shadowOnly: true`;
- `nonExecutable: true`.

The audit record contains:

- deterministic idempotency key;
- decision digest;
- minimized normalized facts and classifications;
- no message body, contact address, provider payload, token, prompt, memory or
  medical detail;
- `shadowOnly: true`;
- `nonExecutable: true`.

## Supported channels

The current closed channel vocabulary is derived from repository evidence:

- `in_app`;
- `sms`;
- `whatsapp`;
- `email`;
- `voice_call`.

`push` is intentionally not included in Task 8 because the repository assessment
found no current PushManager subscription persistence, VAPID/web-push adapter,
service-worker `push` handler or notification-click deep-link handling. Push is
reserved for Stage 5.

Automatic non-call-to-voice fallback is prohibited by default. A `voice_call`
fallback can be selected only when the current purpose has an explicit
purpose-specific fallback permission from the preferred channel to `voice_call`
and the voice channel also has valid channel consent.

When push is introduced in Stage 5, push-to-call fallback must follow this same
rule: no automatic call unless an explicit purpose-specific opt-in and policy
fact exist.

## Consent policy

Consent is purpose-scoped and channel-scoped where current facts support it.

Rules:

1. Only user-subject consent can authorize user outreach in Task 8.
2. Caregiver/operator consent does not silently substitute for user consent.
3. Future-dated consent is not active.
4. Expired consent is not active.
5. Unknown or missing consent fails closed.
6. A channel-specific grant for one channel does not authorize another channel.
7. Explicit channel denial/revocation removes that channel.
8. Purpose-level denial/revocation blocks all channels for that purpose.
9. Newest active consent wins by:
   effective timestamp, then revision, then recorded timestamp, then stable
   consent ID.
10. Same-order conflicting facts are a policy-configuration failure.
11. Emergency policy is separate and not implemented in Task 8.

Task 8 never writes or revokes consent.

## Deterministic evaluation order

The policy evaluator uses this order:

1. Descriptor-safe clone and strict schema validation.
2. Schedule occurrence identity validation.
3. Due-state validation.
4. Existing occurrence/idempotency duplicate validation.
5. IANA timezone validation.
6. Purpose-scoped consent validation.
7. Channel-specific consent validation.
8. Eligible channel calculation.
9. Quiet-hours evaluation.
10. Cooldown, frequency and fatigue limits.
11. Preferred-channel selection.
12. Deterministic fallback selection.
13. Final allow/block decision.

The same input produces the same decision and digest. No `Math.random()` is used.

## Quiet hours and timezone

Quiet hours support:

- `none`;
- same-day window;
- cross-midnight window;
- explicit `full_day`.

Window boundaries are start-inclusive and end-exclusive. A window of
`22:00`-`07:00` blocks at `22:00`, before midnight and after midnight, and stops
blocking at exactly `07:00`.

Local time is derived from absolute timestamps using the supplied IANA timezone
through platform `Intl.DateTimeFormat`. Server-local timezone is never used.
Task 8 timezone fields are contract-validated as bounded IANA identifiers and
canonicalized at the shared contract boundary with
`Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone` before
policy evaluation. Accepted aliases are not preserved in semantic data: for
example, `Etc/UTC` is stored as `UTC`, and `US/Eastern` is stored as
`America/New_York`. Offset-shaped values such as `+01:00`, slashless
abbreviations such as `PST`, whitespace-padded values and invented zones are
rejected. Invalid timezone input fails contract parsing with `invalid_input`;
`timezone_invalid` remains a closed policy reason for any unexpected platform
local-time resolution failure after validation. DST spring-forward gaps, DST
fall-back folds, UTC, half-hour zones and quarter-hour zones are covered by
tests.

All semantic timestamp fields are contract-validated as explicit-offset ISO
instants and canonicalized to UTC with `new Date(epochMs).toISOString()`.
Decisions, audits, persistence records, comparisons and semantic digests use
only canonical UTC timestamp strings. Task 8 does not use lexical timestamp
ordering, so equivalent instants with different valid offsets compare as equal
and produce the same semantic output.

## Frequency, cooldown and fatigue

Limits are supplied as explicit validated facts. Task 8 does not invent hidden
global defaults and does not mutate counters.

Supported checks:

- attempts per local calendar day in the user timezone;
- attempts in a rolling time window;
- purpose-specific counters;
- channel-specific counters;
- minimum cooldown;
- consecutive failures;
- recent no-answer fatigue;
- recent dismissal fatigue;
- duplicate occurrence.

If limit enforcement is marked `required`, at least one explicit limit must be
provided or the input is rejected. Exact cooldown expiry is allowed; before
expiry blocks.

## Fallback

Fallback evaluation is deterministic:

1. Preferred channel is considered first.
2. Configured fallback chain follows.
3. Remaining candidates are considered by rank and channel name.
4. Duplicate fallback channels are rejected.
5. Unavailable channels are removed only when supplied as observed facts.
6. Fallback cannot bypass consent.
7. Fallback cannot bypass quiet hours.
8. Fallback cannot bypass global or channel-specific limits.
9. Automatic fallback to `voice_call` is prohibited unless explicitly allowed.
10. Empty eligible set blocks with `no_eligible_channel`.

Task 8 does not call providers to test availability.

## Outcome normalization

Recent attempts are normalized into closed outcomes only:

- `not_attempted`;
- `delivered`;
- `failed`;
- `dismissed`;
- `opened`;
- `answered`;
- `no_answer`;
- `cancelled`;
- `consent_revoked`.

Task 8 does not create provider outcomes or execute remediation.

## Reason codes

Allow reasons:

- `consent_valid`;
- `outside_quiet_hours`;
- `within_frequency_limit`;
- `eligible_preferred_channel`;
- `eligible_fallback_channel`;
- `occurrence_not_previously_evaluated`.

Block reasons:

- `invalid_input`;
- `schedule_not_due`;
- `consent_missing`;
- `consent_denied`;
- `consent_revoked`;
- `consent_expired`;
- `channel_not_consented`;
- `no_eligible_channel`;
- `quiet_hours`;
- `timezone_invalid`;
- `frequency_limit_reached`;
- `fatigue_limit_reached`;
- `cooldown_active`;
- `duplicate_occurrence`;
- `policy_configuration_invalid`;
- `persistence_unavailable`;
- `shadow_disabled`.

Raw internal errors, provider errors, Zod details and database errors are not
exposed as reason codes.

## Durable audit persistence

The additive table is `proactive_engagement_shadow_audits`.

Stored facts include:

- audit ID;
- schema and policy versions;
- deterministic idempotency key;
- schedule occurrence and schedule IDs;
- purpose ID;
- decision and proposed channel;
- reason codes;
- due and evaluated timestamps;
- timezone;
- consent, quiet-hours, limit and duplicate classifications;
- source classification;
- minimized normalized audit JSON;
- canonical semantic digest;
- `shadow_only = true`;
- `non_executable = true`;
- creation time.

The table does not store message bodies, notification copy, phone numbers,
email addresses, postal addresses, provider payloads, provider tokens, push
subscription endpoints, device tokens, authorization headers, cookies, profile
records, health details, medical symptoms, prompts, memory content or raw
database errors.

## Idempotency and digest

One schedule occurrence produces one durable shadow audit decision per policy
version and purpose.

The idempotency identity is derived from:

- policy version;
- schedule occurrence ID;
- purpose ID.

The persisted idempotency key is a bounded fixed-domain SHA-256 representation
of those facts, not a raw concatenation of source identifiers.

The semantic digest uses Task 7 canonical JSON conventions with a Task 8 audit
domain. Exact duplicate identity + digest is a no-op. Same identity with changed
semantics is rejected as a semantic conflict. Database uniqueness is the final
enforcement layer.

## Inert input boundary

Every public Task 8 runtime entry that receives caller-owned structured input
accepts `unknown` and first calls Task 7 `descriptorSafeDeepInertClone`. The
exported public Task 8 contract schemas also apply a descriptor-safe inert
preprocess boundary before their internal Zod object parsers run, so direct
`.parse()`/`.safeParse()` callers cannot bypass accessor, sparse-array or
explicit-undefined rejection.

Clone failure performs:

- zero ID generation;
- zero clock access;
- zero feature-flag resolution;
- zero telemetry;
- zero evaluation;
- zero duplicate lookup;
- zero transaction;
- zero write.

Accessor properties are rejected without invoking getters or setters. Sparse
arrays and explicit `undefined` are rejected. Optional means absent; explicit
`null` is only valid where the schema allows it.

## Feature flag and kill switch

Flag:

- ID: `flag.engagement.audit_shadow`;
- version: `1.0.0`;
- default mode: `disabled`;
- allowed modes: `disabled`, `audit_shadow`.

Environment:

- `VYVA_ENGAGEMENT_AUDIT_SHADOW_MODE`;
- `VYVA_ENGAGEMENT_AUDIT_SHADOW_ROLLOUT_BPS`;
- `VYVA_ENGAGEMENT_AUDIT_SHADOW_ALLOW_PRODUCTION`;
- `VYVA_ENGAGEMENT_AUDIT_SHADOW_EXPIRY`;
- `VYVA_ENGAGEMENT_AUDIT_SHADOW_OWNER_REFERENCE`;
- `VYVA_ENGAGEMENT_AUDIT_SHADOW_AUDIT_REFERENCE`;
- `NODE_ENV`.

The resolver uses deterministic SHA-256 cohort rollout. Missing, malformed,
expired or incomplete configuration resolves disabled. Production requires exact
`VYVA_ENGAGEMENT_AUDIT_SHADOW_ALLOW_PRODUCTION=true`.

The kill switch is setting mode to `disabled` or unsetting it. Disabled mode
stops evaluation, audit writes and success telemetry without changing live
dispatcher behavior.

## Resource limits

The runtime performs:

- one evaluation attempt;
- one persistence attempt;
- no retry loop;
- no queue;
- no worker;
- no lease;
- fixed timeout with hard cap of 250 ms;
- cooperative `AbortSignal` to persistence;
- late-promise rejection consumption.

Durable scheduling, multi-instance leasing and workers remain later-stage work.

## Telemetry

Telemetry is replaceable and non-persistent by default:

- `setProactiveEngagementTelemetrySink`;
- `resetProactiveEngagementTelemetrySink`;
- `emitProactiveEngagementTelemetry`.

Telemetry is strict, versioned, minimized, failure-isolated, `shadowOnly: true`
and `nonExecutable: true`.

It may include:

- observation ID generated only after inert parsing and audit-shadow selection;
- policy version;
- runtime outcome;
- decision classification;
- proposed channel classification;
- reason codes;
- timezone-valid boolean;
- consent, quiet-hours, limit and duplicate classifications;
- persistence classification;
- latency bucket.

It does not include user/profile/schedule IDs, raw contact data, message
content, provider payloads, prompts, memory content or raw errors.

## Failure behavior

Failure classifications are fixed and safe:

- invalid input;
- disabled shadow;
- schedule not due;
- duplicate occurrence;
- consent blocked;
- quiet hours blocked;
- limit blocked;
- no eligible channel;
- policy configuration invalid;
- persistence unavailable;
- duplicate;
- semantic conflict;
- timeout.

All Task 8 failures are contained and cannot alter dispatcher behavior.

## Integration seam

The current safe seam is intentionally deferred. The repository has live
dispatch authority inside schedule, callback, consent and communication
dispatcher services that also mutate queue state and call providers. Task 8 does
not insert itself into that path.

The implemented adapter accepts a minimized already-established
scheduled-interaction snapshot and returns a shared evaluation input. A future
local/test shadow hook may call the observer after an authoritative due
occurrence has been selected, but before any staging or production use that hook
must be reviewed separately.

## Operational disable procedure

1. Set `VYVA_ENGAGEMENT_AUDIT_SHADOW_MODE=disabled` or unset it.
2. Confirm telemetry shows disabled/no new audit writes.
3. Leave the additive table in place unless retention review approves dropping
   it.

## Current limitations

- No live dispatcher hook is installed.
- No push vocabulary is active yet.
- No push subscription or web-push infrastructure is implemented.
- No deep-link token is generated.
- No Health Flow is started or restored.
- No caregiver/operator escalation is executed.
- No provider receipt is consumed.
- No durable queue, worker or lease exists.

## Prerequisites before local/test shadow

- Product-owner approval for the exact audit-only hook location.
- Synthetic due-occurrence snapshot coverage for scheduled interactions.
- Confirmed nonblocking behavior around existing dispatcher calls.
- Database migration applied in the target local/test environment.

## Prerequisites before staging shadow

- Local/test audit evidence reviewed.
- Privacy review of audit and telemetry fields.
- Operational owner and audit references configured.
- Rollout cohort and expiry configured.
- Disable procedure rehearsed.

## Prerequisites before production shadow

- Explicit production authorization guard.
- Data-retention approval for audit rows.
- Observability dashboard/runbook.
- Load/concurrency review.
- Security/privacy review for any future hook.

## Later-stage responsibilities

- Stage 4: first Health Flow runtime integration.
- Stage 5: PWA push subscription, push delivery and notification-click entry.
- Stage 6: outbound voice-call entry and provider lifecycle normalization.
- Later stages: caregiver/operator escalation policy, durable queue leasing,
  multi-instance proactive execution, and production dispatch authority review.
