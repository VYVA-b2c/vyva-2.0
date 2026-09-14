# Health caregiver/operator escalation projections

Task 14 / Stage 9 adds a default-disabled projection layer for authorized Health escalation visibility.

It is intentionally not a new source of truth. The authoritative Health flow, flow audit/event records, existing caregiver permissions, existing `caregiver_alerts` rows, and existing Concierge/operator queue statuses keep their current meanings.

## Runtime boundary

The Health preventive flow may propose an escalation only after a newly persisted authoritative completion whose result has `flag_caregiver: true`.

The Stage 9 adapter then:

1. resolves the default-disabled pilot flag;
2. re-reads current Stage 9 purpose consent from `profiles.data_sharing_consent`;
3. resolves eligible caregivers through the existing Health domain access helper;
4. evaluates caregiver/operator authorization and purpose consent;
5. writes minimized projection rows only for allowed decisions;
6. leaves the existing alert and queue rows unchanged.

Hook failures are non-blocking and cannot change the Health completion response.

## Consent

Stage 9 uses a narrow purpose-scoped consent object:

```json
{
  "health_caregiver_operator_escalation": {
    "caregiver_projection_allowed": true,
    "operator_projection_allowed": true,
    "revision": 1,
    "approval_reference": "stage9-consent",
    "revoked_at": null
  }
}
```

The adapter does not infer Stage 9 consent from push consent, outbound-call consent, semantic-memory consent, general engagement preferences, caregiver relationship, or existing caregiver-alert booleans.

Revoked or missing consent fails closed. Projection reads and acknowledgement both recheck current Stage 9 consent at disclosure time and fail closed after revocation. Creation-time consent is audit evidence, not permanent disclosure authority.

## Projection model

The additive table is:

- `health_caregiver_operator_escalation_projections`

Each row includes:

- subject/profile identifiers;
- target audience: `caregiver` or `operator`;
- target actor for caregiver projections;
- Health flow ID/version/instance;
- source Health event ID;
- optional existing alert ID reference;
- completion reference and answer digest;
- authorization and consent reason codes;
- minimized safe summary;
- visibility status;
- distinct acknowledgement state;
- deterministic idempotency key and semantic digest.

The safe summary intentionally contains stable reason codes and classification only. It does not store raw Health answers, transcripts, model reasoning, secrets, or provider payloads.

## Acknowledgement

Acknowledgement is a separate auditable state transition on the projection row.

Read and acknowledgement use the Stage 9 authorized disclosure boundary, not the raw persistence lookup. That boundary accepts an authenticated actor ID and reloads current authority before any projection data is returned or acknowledged:

- caregiver/family disclosure reloads current Stage 9 consent and current Health caregiver domain access;
- operator/admin disclosure reloads current Stage 9 consent and current server-owned operator/admin role authority;
- caller-supplied role strings cannot grant operator access;
- authorization resolver failure, revoked consent, lost caregiver relationship, lost operator role, cross-user probes and guessed IDs return generic no-data/not-found outcomes.

It records:

- acknowledgement ID;
- actor ID;
- actor role;
- timestamp;
- original flow/audit linkage retained by the projection.

Duplicate acknowledgement by the same authorized actor is idempotent. Cross-user acknowledgement, wrong actor acknowledgement, caregiver acknowledgement of operator-only projections, and ordinary-user operator acknowledgement fail closed without disclosing projection existence. Acknowledgement does not mutate Health flow state.

## Feature flag and rollback

Flag:

- `VYVA_HEALTH_CAREGIVER_OPERATOR_ESCALATION_MODE`

Supported modes:

- `disabled`
- `pilot`

Default is disabled. Allowlist, denylist, rollout and production-gate parsing is strict and whitespace-polluted values fail closed.

Rollback is operationally simple:

1. set the Stage 9 mode to `disabled`;
2. existing caregiver alerts remain unchanged;
3. existing concierge queue views remain unchanged;
4. existing caregiver permissions remain unchanged;
5. projection rows remain inert/auditable.

## PostgreSQL freeze proof

The CI job `task14-postgres-freeze-proof` uses PostgreSQL 16 with disposable database `vyva_task14_test`.

It runs:

1. migration 0082 proof;
2. schema reset;
3. authoritative baseline bootstrap through `npm run db:push:manual -- --force`;
4. real projection-store PostgreSQL proof.

The PostgreSQL proof covers concurrent duplicate projection creation, unique-conflict classification, acknowledgement idempotency, cross-user acknowledgement rejection, current-consent revocation blocking later disclosure/acknowledgement while preserving the audit row, current caregiver-access denial, current operator-role denial, baseline alert table presence, baseline queue table presence, and preservation of existing alert/queue row semantics.
