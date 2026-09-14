# Health Memory Policy Integration

Task 13 implements Stage 8 for the preventive Health Flow:
`health.preventive_check@1.0.0`.

The implementation adds a policy-controlled memory boundary for Health-specific
semantic memory reads and proposed writes. It does not make the client or Mem0
authoritative, does not change the preventive Flow result contract, and does not
change existing unflagged Mem0 behavior.

## Runtime boundary

The Stage 8 path is Health-only and controlled by:

- `VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_MODE=disabled|pilot`
- `VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_USERS`
- `VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_DENY_USERS`
- `VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ROLLOUT_BPS`
- `VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_PRODUCTION`

The flag is default-disabled. Denylist entries win over allowlist and rollout.
Malformed mode, malformed rollout, whitespace in list values, invalid
environment, missing cohort evidence, or production without explicit
authorization fail closed to `disabled`.

Rollout selection is correlated to stable server-side user identity. Request
conversation IDs, Flow instance IDs and session IDs remain provenance or
idempotency evidence; they do not decide rollout eligibility.

When disabled, Health voice context and the main router continue to use the
existing Mem0 search/write paths. When enabled for Health, both Health voice
context and the main Health router path use the policy-filtered PostgreSQL
semantic-memory outbox for reads and do not use the legacy direct Mem0
read/write path. Non-Health routing domains keep the legacy behavior.

## Category policy

The policy evaluator supports these categories:

- `general_preference`
- `routine_health_context`
- `restricted_health`
- `mental_health`
- `safety_emergency`
- `care_instruction`

Only `general_preference` and `routine_health_context` can be read or proposed
as low-risk semantic memory, and only with explicit semantic-memory consent.

Restricted Health, mental-health, safety/emergency, and care-instruction data
never auto-write to Mem0 in Task 13. Restricted and mental-health proposed
writes are retained only as proposal/audit records unless a later explicit
approval mechanism is designed and approved.

Consent is read only from explicit semantic-memory consent fields in profile
data-sharing metadata. General Health data-sharing consent is not treated as
semantic-memory consent. Revocation blocks new reads/writes outside retained
audit records.

## Proposed-write outbox

Migration 0081 adds the durable
`health_semantic_memory_outbox` table. The table records:

- idempotency identity;
- user/profile/Mem0 identity;
- Flow ID, Flow version, Flow instance, completion reference and answer digest;
- memory category, operation, target and status;
- minimized semantic content and content digest;
- policy decision, reason and decision digest;
- source provenance;
- provider state;
- normalized proposal JSON and semantic digest.

Task 13 writes only minimized routine context from authoritative Stage 4
completion evidence. It does not persist raw answer text or raw Specialist
reasoning in the semantic memory proposal.

Mem0 provider delivery is not automatic from the Health route. Delivery is
possible only when an internal caller explicitly passes the approved delivery
option, an authoritative current semantic-memory consent loader is supplied,
current write consent is rechecked immediately before delivery, and the outbox
atomically claims provider-delivery ownership before calling Mem0. Missing or
unavailable current-consent lookup fails closed with a structured non-sensitive
failure reason and does not call the provider. A provider write is marked
`delivered` only after a confirmed successful response with a provider memory
ID. Task 13 never fabricates `mem0.pending` success IDs. Provider failures
update the durable outbox to `delivery_failed` or `deletion_failed` without
losing the proposal.

The delivery claim prevents ordinary concurrent duplicate provider calls for
the same proposal. Task 13 does not yet implement a lease/expiry recovery queue
for records stranded in `delivery_in_progress` or `delete_in_progress` after a
process crash or ambiguous provider timeout; that remains an operational
follow-up before claiming exactly-once provider delivery semantics.

## Correction and deletion

Correction and deletion proposals are linked to the original proposal through
provenance fields:

- `correctionOf`
- `deletionOf`

Once a correction or deletion is accepted locally, the original delivered row is
immediately marked locally suppressed (`corrected` or `deleted`) with
`supersededBy` or `deletedBy` metadata. Reads exclude suppressed originals
immediately, even if the provider correction/delete operation later fails.
Duplicate correction/deletion requests are idempotent when their semantic
proposal is unchanged. Status and suppression updates recompute the normalized
proposal semantic digest so persisted records, duplicate detection and audit
projections remain aligned.

Correction and deletion requests fail closed unless the lifecycle proposal
matches the original memory on subject identity, Flow identity, category,
operation and exact `correctionOf`/`deletionOf` provenance. A proposal generated
for one user or original memory cannot suppress another user's memory.

## Voice context reads

When the Stage 8 flag resolves to pilot for Health, `voiceContext.ts` receives a
Health memory-policy option from the server route. It evaluates read policy by
category and builds the voice memory block only from active delivered outbox
records in allowed categories. Corrected/deleted originals, deletion-operation
rows and locally suppressed records are not readable.

When the flag is absent or disabled, the route does not pass the policy option
and the existing Mem0 behavior remains unchanged.

## PostgreSQL proof

The Task 13 PostgreSQL freeze proof uses PostgreSQL 16 with disposable database
`vyva_task13_test`. CI runs:

1. migration 0081 against PostgreSQL;
2. schema reset;
3. the repository's authoritative baseline schema via `npm run db:push:manual`;
4. the real PostgreSQL semantic-memory store/idempotency test, including
   concurrent delivery claim, duplicate-delivery protection, correction/deletion
   suppression lifecycle, cross-user and mismatched-provenance lifecycle
   rejection, provider-failure persistence, read visibility, delivery-time
   consent revocation and missing current-consent-loader failure.

The gated PostgreSQL tests require `TASK13_POSTGRES_URL` to point to a scratch
database whose name contains `task13` and one of `test`, `tmp`, `ci` or
`scratch`.

## Explicit non-goals

Task 13 does not:

- introduce a new Orchestrator;
- make Mem0 authoritative;
- alter existing unflagged Mem0 search or fire-and-forget write behavior;
- add a public memory-approval UX or API;
- auto-write restricted, mental-health, safety or care-instruction memory;
- change Stage 4 completion authority;
- change Task 8 proactive engagement delivery;
- change push, voice-call, provider, service-worker or caregiver behavior.
