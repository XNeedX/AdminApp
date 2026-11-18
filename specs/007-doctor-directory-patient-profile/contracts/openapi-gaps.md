# OpenAPI Contract Gaps and Blocking Prerequisites

**Feature**: `007-doctor-directory-patient-profile` | **Date**: 2026-11-17

Constitution Principle II forbids hand-written HTTP services, DTOs or client interfaces, and requires
work to pause when the generated client does not describe an operation. The generated clients in
`src/app/api/generated/*` currently describe the **request** side of several operations but discard the
response body (`Observable<void>`). This document records each gap, what the feature needs, and the
action that unblocks it.

Regeneration entry points (existing npm scripts):

```bash
npm run api:profiles      # node scripts/augment-profiles-openapi.mjs && ng-openapi-gen --config ng-openapi-gen.profiles.json
npm run api:appointments  # node scripts/augment-appointments-openapi.mjs && ng-openapi-gen --config ng-openapi-gen.appointments.json
npm run api:services      # node scripts/augment-services-openapi.mjs && ng-openapi-gen
```

## Gap summary

| ID | Operation | Current generated type | Required by | Status |
|----|-----------|------------------------|-------------|--------|
| P-1 | `GET /Doctors/account/{accountId}` | **absent from OpenAPI and from ProfilesAPI** | US3 (doctor edits own profile), US2 (`/my-schedule` identity) | Blocking |
| P-2 | `GET /Doctors/{id}` | `ApiResponseOfDoctorDetailsDto` (typed, **no `status`**) | US4 (status update body), US3 (edit prefill) | Resolved via overlay |
| P-3 | `POST /Doctors` | `ApiResponseOfGuid` (typed) | US1 (detect `isSuccess: false`) | Resolved via overlay |
| P-4 | `GET /Schedule/doctor/{doctorId}` and `GET /Schedule/patient/{patientId}/history` | `Observable<void>` | US2 | Blocking |
| P-5 | `GET /appointments/{appointmentId}/results` | `Observable<void>` | US2 | Blocking |
| P-6 | `POST /documents/documents` (photo upload) | **absent from the generated Profiles client** | US1, US3 (optional photo) | Open — photo deferred |

Non-blocking but relevant: `GET /Doctors` (list of `DoctorCardDto`) is also `Observable<void>`; this
feature uses `GET /Doctors/doctors` instead, which is fully typed.

## P-1 — Doctor identity by account

**Current state**: `ProfilesAPI/Controllers/DoctorsController.cs` exposes only `POST /Doctors`,
`GET /Doctors`, `GET /Doctors/{id}`, `GET /Doctors/doctors`, `PUT /Doctors/{id}`. The path
`GET /Doctors/account/{accountId}` is called by the legacy `auth.service.ts` and is already documented
as "not implemented" in `specs/003-sign-in-out/contracts/profiles-sign-in.contract.md`.

**Required**: `GET /Doctors/account/{accountId}` returning
`ApiResponse<DoctorSelfProfileDto>` with at least:

```text
id, photoPath, firstName, lastName, middleName, dateOfBirth,
specialization, officeAddress, careerStartYear, status
```

**Why it cannot be worked around**: no other generated operation maps a Keycloak `sub` (account id) to a
doctor profile id. `GET /Doctors` returns `DoctorCardDto` without email or account id, and the table rows
carry no email. Without the endpoint, a doctor cannot resolve their own profile or schedule.

**Unblocks**: US3 (own-profile edit), US2 (`/my-schedule`).

## P-2 — Full doctor read includes status

**Current state (resolved)**: `GET /Doctors/{id}` is declared in the sanctioned overlay
(`scripts/augment-profiles-openapi.mjs` → `openapi/profiles.openapi.json`) as
`ApiResponseOfDoctorDetailsDto`, so `doctorsIdGet` is typed. The backend `DoctorDetailsDto` still has **no
`status`** member, and the overlay deliberately does not invent one.

**Resolution**: the complete `UpdateDoctorDto` body is composed from two typed reads:

1. `GET /Doctors/{id}` (`doctorsIdGet`) for names, date of birth, specialization, office and career start
   year;
2. `GET /Doctors/doctors` (`doctorsDoctorsGet`, `pageSize: 500`) for the current `status` of that id.

Both go through `readApiEnvelope` + the `doctor-contract.guards.ts` predicates. No hand-written service,
no raw `HttpResponse` and no cast of a `void` response is involved.

**Still worth doing in the backend**: add `Status` to `DoctorDetailsDto` (or return `DoctorAdminDto`).
That would remove the extra table read in `DoctorDirectoryStore.setStatus` and `ProfilePageComponent.load`.

## P-3 — Create must report business failures

**Current state (resolved)**: the overlay declares `POST /Doctors` as `ApiResponseOfGuid`, so
`doctorsPost` returns the created profile id together with `isSuccess`, `message` and `errors`.

**Resolution**: `DoctorCreateDialogComponent` narrows the response through `readApiEnvelope` and
`isGuidPayload`; a `200` with `isSuccess: false` now keeps the dialog open and shows the server message.
`PUT /Doctors/{id}` is declared as `ApiResponse` in the same overlay so the save path can use
`readApiAcknowledgment`.

**Remaining backend work**: expose both operations in the checked-in `swagger.json` so the overlay entry
becomes redundant. Until then `npm run api:profiles` keeps the patched JSON in sync with the script.

## P-4 — Schedule and patient history are typed

**Current state**: both `scheduleDoctorDoctorIdGet` and `schedulePatientPatientIdHistoryGet` are
`Observable<void>`.

**Required**:

```text
GET /Schedule/doctor/{doctorId}        -> ApiResponse<IEnumerable<DoctorScheduleDTO>>
  { appointmentId, patientId, patientFullName, serviceName, startTime, endTime, isApproved, hasResult }

GET /Schedule/patient/{patientId}/history -> ApiResponse<IEnumerable<PatientAppointmentHistoryDTO>>
  { appointmentId, date, startTime, endTime, doctorFullName, serviceName, resultId }
```

Both DTOs exist in `Backend/AppointmentsAPI`; only the OpenAPI response schemas are missing.

**Unblocks**: US2 entirely.

## P-5 — Appointment result is typed

**Current state**: `appointmentsAppointmentIdResultsGet` is `Observable<void>`.

**Required**: `ApiResponse<ViewAppointmentResultDTO>`:

```text
{ appointmentId, date, patientFullName, doctorFullName, patientDateOfBirth,
  doctorId, specialization, serviceName, complaints, conclusion, recommendations }
```

**Note**: the results tab needs only `complaints`, `conclusion` and `recommendations`; the rest is
ignored. The history endpoint returns `resultId` only, so this call is unavoidable unless the history
DTO is extended to embed the result text.

## P-6 — Photo upload client

**Current state**: `POST /documents/documents` is not part of any generated client. `DoctorService.uploadPhoto`
performs it by hand.

**Required**: add a Documents service to the generated Profiles client (or a dedicated client) with a
typed multipart request returning the stored path/id.

**Fallback (taken)**: US1/US3 ship without photo support. `DoctorFormComponent` exposes a
`showPhoto` input that defaults to `false`, so no photo control is rendered and the create/save flows send
`photoPath: null`. This is a recorded product decision (see `tasks.md` T020 and Implementation Notes), not
a silent omission: the spec allows the photo to be optional (FR-002, FR-017).

## Blocking protocol

1. Resolve the schema/endpoint items above in the owning microservice and regenerate.
2. Verify the regenerated method signature contains the expected payload type (not `void`).
3. Only then implement the dependent story — in this order: P-3 → US1, P-2 → US4 status + US3 save,
   P-1/P-4/P-5 → US2.
4. Do **not**:
   - add a hand-written HTTP service "temporarily";
   - copy the legacy `DoctorService`/`OfficeService`/`SpecializationService` pattern;
   - cast a `void` response or read the raw `HttpResponse` through a generated `$Response` method to
     recover an untyped body (this reintroduces unvalidated `unknown` at the feature boundary and is not
     a documented contract).

**Current state**: P-2 and P-3 were closed through the sanctioned overlay path (step 1 applied to
`scripts/augment-profiles-openapi.mjs` + the checked-in `openapi/profiles.openapi.json`, then
`ng-openapi-gen`). P-1, P-4, P-5 and P-6 still require the owning microservice.

## Cleanup enabled by this feature

The following files were deleted together with their usages (T059–T061 verified clean):

- `src/app/api/doctor.service.ts`
- `src/app/api/office.service.ts`
- `src/app/api/specialization.service.ts` (and `specialization.service.spec.ts`)
- `features/doctors/components/doctor-create/**`, `features/profile/components/profile-edit/**`

`core/validators/email-unique.validator.ts` no longer depends on `DoctorService`; it takes a lookup
callback instead.
