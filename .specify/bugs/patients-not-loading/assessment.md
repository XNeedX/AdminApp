# Bug Assessment: Appointments page shows "Could not load patients."

- **Slug**: patients-not-loading
- **Created**: 2026-11-21
- **Source**: pasted text (no URL)
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> I have bug when i enter Appointments page a catch Could not load  patients bug fix this

Condensed: opening `/appointments` raises the catalog error toast `Could not load patients.` The
appointment catalogs never finish loading, so the create-appointment form cannot be used.

## Symptom

On entering the Receptionist appointments workspace, `AppointmentCatalogService.load()` runs
five catalog requests in a `forkJoin`. The `patients` leg rejects, the whole catalog load
fails, and `AppointmentsPageComponent.loadCatalogs()` reports the error through
`NotificationService.showError` and `catalogError`. The visible message is exactly
`Could not load patients.` (the `CatalogSourceError` message built from
`Could not load ${source}.` with `source === 'patients'`).

Expected: the patient list from `GET /profiles/Patients` is offered in the create-appointment
combobox and the page loads normally.

## Reproduction

1. Sign in to `AdminApp` as a Receptionist (local user `testreceptionist`).
2. Open `/appointments`.
3. Observe the error toast `Could not load patients.` and the catalog error block.

Live evidence collected against the running local stack (Keycloak
`http://localhost:8080/realms/InnoClinic`, Gateway `http://localhost:5137`, Profiles API
`http://localhost:5154`):

| Request | Result |
|---|---|
| `GET http://localhost:5137/profiles/Patients` with a `Receptionist` bearer token | `200`, `isSuccess: true`, `data.length: 15` |
| Property names of `data[0]` | `photoPath, firstName, lastName, middleName, phoneNumber, dateOfBirth` |

The endpoint returns patients successfully, but **every row has no `id` property**.

## Suspected Code Paths

Frontend:

- `AdminApp/src/app/features/appointments/services/appointment-catalog.service.ts:160-172` —
  `isPatientRow` requires `typeof value['id'] === 'string'`; `isPatientList` requires every row
  to pass it.
- `AdminApp/src/app/features/appointments/services/appointment-catalog.service.ts:317-325` —
  `loadPatients()` wraps `patientsGet()` with `readApiEnvelope(payload, isPatientList)` and
  rethrows any failure as `new CatalogSourceError('patients', error)`.
- `AdminApp/src/app/api/api-envelope.ts:76-88` — `readApiEnvelope` throws
  `ApiContractError('The API returned an unexpected payload shape.')` when the guard fails.
- `AdminApp/src/app/features/appointments/pages/appointments-page/appointments-page.component.ts:123-142`
  — surfaces the rejection as the page error and toast.

Backend:

- `Backend/ProfilesAPI/Profiles.Application/DTOs/PatientProfileDto.cs` — the record has
  `PhotoPath, FirstName, LastName, MiddleName, PhoneNumber, DateOfBirth` and **no `Id`**.
- `Backend/ProfilesAPI/Profiles.Application/Services/PatientService.cs:191-198` —
  `GetPatientsAsync()` projects every `PatientProfile` through `ToPatientViewResponse()`.
- `Backend/ProfilesAPI/Profiles.Application/Mappers/PatientMapper.cs:19` — Mapperly maps
  `PatientProfile` → `PatientProfileDto` by name; `PatientProfile.Id` is dropped because the
  target record has no matching member.
- `Backend/ProfilesAPI/Profiles.API/Controllers/PatientsController.cs:100-107` —
  `GET /api/Patients` returns that projection (Gateway path `/profiles/Patients`).

## Root Cause Hypothesis

**High confidence (confirmed by live probe).** The Profiles API read model
`PatientProfileDto` does not expose the patient `Id`. The AdminApp contract guard requires an
`id` on every patient row, so `readApiEnvelope` rejects the whole 15-row collection and the
catalog load fails with `Could not load patients.`

The frontend cannot compensate: `PatientOption.id` is required by
`AppointmentFormStore`/`AppointmentsFacadeService` to build `POST /Appointments/{patientId}`,
and the Profiles API exposes no alternative list that carries ids. The AdminApp OpenAPI
overlay (`AdminApp/scripts/augment-profiles-openapi.mjs:144-158`) already declares `id` and
states it is present on the backend DTO — that assumption is false in the running backend,
which is why code generation succeeds but runtime validation fails.

## Proposed Remediation

**Preferred (backend — restores patients and appointment creation)**: add `Guid Id` to
`PatientProfileDto` so the projection carries the primary key that Mapperly already has.

- `Backend/ProfilesAPI/Profiles.Application/DTOs/PatientProfileDto.cs`: add `Guid Id` as the
  first positional member.
- No mapper change is needed: Mapperly maps same-named members automatically.
- No AdminApp code change is needed: the generated `PatientProfileDto` already declares
  `id`, `isPatientRow` already requires it, and `toPatientOption` already maps it.
- Only the active project tree is touched (`Backend/ProfilesAPI/Profiles.Application`). The
  nested duplicate `Backend/ProfilesAPI/ProfilesAPI/**` is not referenced by the Dockerfile
  and is left untouched.

Success criteria: `GET /profiles/Patients` rows include a non-empty `id`, and `/appointments`
loads the catalogs without the `Could not load patients.` error.

**Frontend regression guard (this workspace)**: add a focused unit test pinning that a patient
row missing `id` is rejected, so the contract requirement cannot silently regress.

**Alternatives considered**:

- Relax `isPatientRow` to make `id` optional — rejected: it would produce `PatientOption`
  entries with an empty id, and appointment creation would submit an invalid
  `patientId`. It hides a broken contract instead of fixing it.
- Derive ids from another endpoint — rejected: no Profiles API list returns patient ids and
  `GET /Patients/{id}` needs the id it would supply.

**Files likely to change**:
- `Backend/ProfilesAPI/Profiles.Application/DTOs/PatientProfileDto.cs`
- `AdminApp/src/app/features/appointments/services/appointment-catalog.service.spec.ts`

**Tests to add or update**:
- `appointment-catalog.service.spec.ts`: a patient row without `id` rejects the catalog load
  with a `CatalogSourceError` naming `patients` (pins the contract requirement).
- Manual/API check after rebuild: `GET /profiles/Patients` returns `id` on every row and the
  AdminApp catalog load succeeds.

## Risks & Considerations

- Adding a property to a positional record is additive on the JSON wire; existing consumers
  that ignore `id` are unaffected.
- The nested duplicate project tree under `Backend/ProfilesAPI/ProfilesAPI/**` keeps the old
  DTO; it is not part of the Docker build (`Backend/ProfilesAPI/Dockerfile` copies the
  root-level projects), so the duplicate is intentionally out of scope.
- The AdminApp overlay's claim that `id` already exists was wrong; after this change it
  becomes true and should stay in sync with the backend DTO.
- Patient list rows with a null/empty `Guid` would still fail the guard; `Id` is a non-null
  primary key, so this is not expected.

## Open Questions

None. The live probe resolved the earlier uncertainty about the response shape.
