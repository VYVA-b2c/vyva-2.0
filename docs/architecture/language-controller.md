# Central Language Controller

VYVA uses one master language state for user-facing UI. The active profile controls the language after sign-in, and any selector updates the app immediately while saving the preference back to that active profile.

## Data Contract

- Canonical field: `profiles.language_preference`
- Legacy mirror: `profiles.language`
- Resolved profile language: `language_preference ?? language ?? "es"`
- Client request headers:
  - `X-VYVA-Language`
  - `X-VYVA-Language-Source`

## Production Rollout

Deploy the schema migration before deploying code that reads `profiles.language_preference`.

The required migration is:

```sql
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "language_preference" text;
```

During the transition, write both `language_preference` and `language`. Once all server paths have moved to the canonical field and older deployments are gone, `language` can be treated as legacy compatibility only.
