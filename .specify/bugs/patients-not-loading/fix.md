# Bug Fix: Patient list rejects every row because the Profiles API DTO omits `Id`

- **Slug**: patients-not-loading
- **Fixed**: 2026-11-21
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

`GET /profiles/Patients` returned 15 patients without an `id`, while the AdminApp patient
guard requires one, so the whole catalog load failed with `Could not load patients.`. The
Profiles API read model `PatientProfileDto` now exposes `Guid Id`, which restores the patient
catalog and unblocks appointment creation. No AdminApp production code needed changing: the
generated model and guards already expected `id`.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `Backend/ProfilesAPI/Profiles.Application/DTOs/PatientProfileDto.cs` | modified | Added `Guid Id` as the first positional member. Mapperly maps `PatientProfile.Id` by name, so no mapper change was required. |
| `AdminApp/src/app/features/appointments/services/appointment-catalog.service.spec.ts` | added test | Pins that a patient row without `id` fails the catalog load with `CatalogSourceError('patients')`. |

The nested duplicate project tree `Backend/ProfilesAPI/ProfilesAPI/**` was left untouched: it
is not referenced by `Backend/ProfilesAPI/Dockerfile`, which builds the root-level
`Profiles.Application` project.

## Diff Highlights

```csharp
// Backend/ProfilesAPI/Profiles.Application/DTOs/PatientProfileDto.cs
public record PatientProfileDto(
    Guid Id,
    string? PhotoPath,
    string FirstName,
    string LastName,
    string? MiddleName,
    string PhoneNumber,
    DateTime DateOfBirth
);
```

```ts
// appointment-catalog.service.spec.ts
it('fails the catalog load when a patient row has no id', async () => {
  api.patientsGet.mockReturnValue(of(envelope([{ firstName: 'Petr', lastName: 'Petrov' /* no id */ }])));

  await expect(firstValueFrom(service.load())).rejects.toMatchObject({
    name: 'CatalogSourceError',
    source: 'patients',
    message: 'Could not load patients.',
  });
});
```

## Tests Added or Updated

- `AdminApp/src/app/features/appointments/services/appointment-catalog.service.spec.ts` —
  `fails the catalog load when a patient row has no id` pins the contract requirement that
  produced the regression. The existing `exposes every patient ...` test already pins the
  happy path (id + full name + phone).

## Local Verification

- `npx ng test --watch=false --include="src/app/features/appointments/services/appointment-catalog.service.spec.ts"` → 1 file, 6 tests passed.
- `npx ng test --watch=false` (full AdminApp suite) → 60 files, 476 tests passed.
- `dotnet build Profiles.Application/Profiles.Application.csproj` → could not restore locally (`NU1101: InnoClinic.Contracts` is only available from the GitHub package feed configured inside the Docker build); compilation was verified through the container build instead.
- `docker compose up -d --build profiles-api` (from `Backend/Infrastructure`) → image built and container recreated; `docker logs` shows `Application started` and `Bus started`.
- Live API, Gateway `http://localhost:5137`, `testreceptionist` token:
  - `GET /profiles/Patients` → `200`, `isSuccess: true`, 15 rows, keys now
    `id, photoPath, firstName, lastName, middleName, phoneNumber, dateOfBirth`,
    `rows-missing-id: 0`.
  - `GET /profiles/Patients/{id}` with a returned id → `200`, returned `data.id` matches the
    requested id (Mapperly maps the new member correctly).
- Manual browser check of `/appointments` was not run (no browser automation available in this
  environment); the API-level evidence above exercises the exact payload the catalog guard
  validates.

## Deviations from Assessment

- **Scope note**: the primary change is in `Backend/ProfilesAPI`, outside the AdminApp
  workspace. The assessment listed it as the preferred remediation and the user explicitly
  authorized the backend DTO change, so it was applied. The frontend change is test-only.
- No other deviations. The assessment's alternative (relaxing `isPatientRow`) was not used.

## Follow-ups

- Confirm the fix in the browser: sign in as `testreceptionist`, open `/appointments`, verify
  the error toast is gone and the patient combobox lists the 15 patients.
- The `InnoClinic.Contracts` feed requires Docker build args; a local `dotnet build` cannot
  restore `Profiles.Application` without adding the GitHub package source to `nuget.config`.
  Consider documenting or scripting that for local backend work.
- Add a backend contract test once a Profiles API test project exists; there is currently no
  `*.Tests.csproj` in `Backend/`.
- Keep `AdminApp/scripts/augment-profiles-openapi.mjs` in sync with the backend DTO; its
  comment already asserts `id` is present, which is now true.
- The separate `appointment-slots-empty` bug (Appointments API synchronized `Services` table
  empty) is unrelated and still open; it has its own assessment and fix report.
