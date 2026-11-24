# Bug Verification: Appointments page "Could not load patients."

- **Slug**: patients-not-loading
- **Tested**: 2026-11-21
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial

## Summary

The contract defect that caused the error is gone: the live `GET /profiles/Patients` response
now carries `id` on all 15 rows, passes the exact AdminApp patient guard 15/15, and the
control payload without `id` still fails 15/15. Unit, regression and type-check suites are
green. The original browser reproduction was **not** exercised (no browser automation in this
environment), so the result is `partial` rather than `verified`.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | Live Gateway `GET /profiles/Patients` with a `Receptionist` token, then apply the `isPatientRow` predicate (`id`, `firstName`, `lastName` are strings) to every row | pass (automated equivalent) | 15/15 rows pass; 0 missing `id`. Browser steps were not run. |
| Reproduction control | Same predicate against the live rows with `id` stripped | pass (control) | 0/15 pass — proves the check discriminates the original defect. |
| New / updated tests | `npx ng test --watch=false --include="src/app/features/appointments/services/appointment-catalog.service.spec.ts"` | pass | 1 file, 6 tests passed (includes the new "no id" regression test). |
| Regression suite | `npx ng test --watch=false` | pass | 60 files, 476 tests passed. |
| Type-check / build | `npx ng build` | pass | Bundle generated at `dist/AdminApp`; no TS errors. |
| Lint | — | not-run | No lint script is configured in `AdminApp/package.json`. |
| Backend runtime | `docker ps` / live API probes | pass | `innoclinic.profiles-api` is running the rebuilt image; `GET /profiles/Patients/{id}` returns the same `id`. |
| Backend unit tests | — | not-run | No `*.Tests.csproj` exists under `Backend/`; compilation was verified by the successful Docker build. |

## Output Excerpts

Live API (Gateway `http://localhost:5137`, `testreceptionist` token):

```
GET /profiles/Patients status=200
isSuccess=True rows=15 guard-pass=15 guard-fail=0
control(without id): guard-pass=0 guard-fail=15
rows-with-empty-names=0
GET /profiles/Patients/{id} status=200
by-id isSuccess=True id-matches=True
```

Tests and build:

```
Test Files  1 passed (1)
     Tests  6 passed (6)

Test Files  60 passed (60)
     Tests  476 passed (476)

Application bundle generation complete. [8.013 seconds]
Output location: ...\AdminApp\dist\AdminApp
```

Container:

```
innoclinic.profiles-api  Up 2 minutes  infrastructure-profiles-api
started=2026-11-21T11:37:58Z
```

## Residual Risks

- **Browser reproduction not exercised.** The assessment's reproduction is UI-driven
  (sign in, open `/appointments`, observe the toast and the patient combobox). That was not
  run here. The API-level check covers the exact payload the guard validates, but it does not
  prove the rendered page, toast suppression, or combobox behavior.
- The fix is additive on the Profiles API JSON wire. No other backend code constructs
  `PatientProfileDto` positionally (only Mapperly maps it), so the blast radius is the two
  read endpoints.
- The nested duplicate tree `Backend/ProfilesAPI/ProfilesAPI/**` still has the old DTO. It is
  not part of the Docker build, but it will regress if it is ever revived.
- The separate `appointment-slots-empty` bug (Appointments API `Services` table empty) is
  unrelated and still open; the create form may still show no time slots after the patient
  list loads.
- No browser automation tooling is installed; a manual signed-in pass is the remaining step.

## Recommendation

Hold the bug open as `partial` and close it after one signed-in browser pass: sign in as
`testreceptionist`, open `/appointments`, confirm the `Could not load patients.` toast is gone
and the patient combobox lists the 15 patients. If the page still errors, reopen the bug and
re-run `/speckit.bug.assess` with the new evidence (for example a `403` or a different
catalog source failing).
