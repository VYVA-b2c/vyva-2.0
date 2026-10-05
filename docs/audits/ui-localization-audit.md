# UI localization audit

Status: medication hub and shared controls corrected; application-wide cleanup remains incomplete.

## Causes

- JSX labels bypass the translation system.
- Some translation keys exist only in English, so the English fallback is displayed alongside translated controls.
- Refill alerts store English sentences on the server. Rendering those sentences directly ignores the current UI language.

## Corrected

- Medication hub copy, empty/loading/completed states, guidance, actions, dose timing, known frequency codes, and accessibility labels use complete six-language dictionaries.
- Both translation APIs consume the same merged resources.
- Canonical header controls use localized accessible labels everywhere the shared component is used.
- The shared refill card builds its text from status, medicine name, and estimated days. Home, medication, and caregiver consumers reuse this correction. Stored text is preserved; medication names and user-entered clinical text are not translated or overwritten.
- Missing estimates are not displayed as zero days.
- Tests check all six languages without fallback, interpolation, and hard-coded JSX in the medication hub.
- Repository-wide coverage tests reject new missing catalogue entries. `knownMissingTranslations.json` records existing debt, not completed translations. Do not expand it to admit untranslated new features.

## Remaining audit findings

Missing English-catalogue keys in the merged non-English catalogues:

| Language | Missing keys |
| --- | ---: |
| Spanish | 311 |
| French | 512 |
| German | 488 |
| Italian | 614 |
| Portuguese | 614 |

The source audit also found 2,953 hard-coded UI text candidates. These require review: some are names, developer/admin content, or non-translatable values. The scan does not prove every other string is localized; dynamic keys, backend text, and strings assembled in code also need verification.

Reproduce with `npm run audit:i18n`; use `-- --json` for key and file/line details. `-- --strict` reports a failing exit status while the backlog remains.

## Verification

- Spanish medication preview inspected in the browser, including dose timing, header controls and refill alerts.
- Six-language refill-card rendering and catalogue coverage tests pass.
- Broader Home, caregiver and symptom-screen regression tests pass.
- Full application TypeScript checking still reports extensive existing errors, including translation-tree typing and unrelated social feature types; this is not a clean full-project typecheck.
- These changes are local, not deployed.
