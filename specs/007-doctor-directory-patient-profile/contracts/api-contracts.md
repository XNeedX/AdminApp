# API Contracts — Generated-Client Usage

**Feature**: `007-doctor-directory-patient-profile` | **Date**: 2026-11-17

Every call in this feature goes through a generated service. No hand-written HTTP service, DTO or
request interface is introduced. Generated interfaces mark every field optional, so every response is
narrowed before use: `readApiEnvelope(payload, guard)` when data is expected,
`readApiAcknowledgment(payload)` for commands whose body carries only the envelope
(both from `src/app/api/api-envelope.ts`).

## 1. Operation map

### US1 — Create doctor

| Step | Generated method | Request | Response handling |
|------|------------------|---------|-------------------|
| Photo upload (if a file is attached) | `DocumentsService` (Profiles client) — see note | multipart file | upload id/path narrowed to `string` |
| Create | `DoctorsService.doctorsPost` (`profiles`) | `{ body: CreateDoctorDto }` | **blocked, P-3** — must become `ApiResponse<Guid>` so `isSuccess: false` is detectable |
| Refresh directory | `DoctorsService.doctorsDoctorsGet` | first page | rows appended to the store |

Note: photo upload currently uses the hand-written `DoctorService.uploadPhoto` against
`/documents/documents`. The generated Profiles client does not expose a Documents service, so the
upload must either be added to the generated client or the photo step is deferred. Tracked as **P-6**
in `openapi-gaps.md`.

`CreateDoctorDto` field order and names are taken verbatim from
`src/app/api/generated/profiles/models/create-doctor-dto.ts`. Email is sent only here; it is never sent
on update.

### US4 — Directory, filters, status

| Step | Generated method | Request | Response handling |
|------|------------------|---------|-------------------|
| Load all doctors | `DoctorsService.doctorsDoctorsGet` | `{ page, pageSize: 100, searchName?, specialization?, officeAddress? }` | `readApiEnvelope(payload, isPagedDoctorRows)` → map `data[]` to `DoctorDirectoryEntry[]`, keep `totalCount` for pagination |
| Change status | `DoctorsService.doctorsIdGet` then `doctorsIdPut` | `{ id }`, then `{ id, body: UpdateDoctorDto }` | get: **blocked, P-2**; put: `readApiAcknowledgment` |
| Specialization catalog | `SpecializationsService.specializationsGet` (`appointments`) | — | `readApiEnvelope(payload, isSpecializationList)` |
| Office catalog | `OfficesService.officesGet` (`appointments`) | — | `readApiEnvelope(payload, isOfficeList)` |

The list endpoint already supports `specialization` and `officeAddress` server-side; this feature
deliberately loads once and filters in memory so the cascade can be derived from the complete dataset
(see research R-3). Page aggregation stops when accumulated rows reach `totalCount`, a page is empty, or
the 50-page cap is hit.

Status update is a full-profile `PUT`: the backend replaces the doctor, so the current profile must be
read first. If P-2 is resolved by adding `status` to a typed `GET /Doctors/{id}`, the store keeps a
single `readProfile(id)` seam and nothing else changes.

### US3 — Edit profile

| Step | Generated method | Request | Response handling |
|------|------------------|---------|-------------------|
| Load (Receptionist) | `DoctorsService.doctorsIdGet` | `{ id }` | **blocked, P-2** |
| Load (Doctor, own) | `DoctorsService.doctorsGet` (`/Doctors`) filtered by account | — | **blocked, P-1** (no account lookup exists) |
| Save | `DoctorsService.doctorsIdPut` | `{ id, body: UpdateDoctorDto }` | `readApiAcknowledgment` |
| Photo upload | as US1 | — | P-6 |

Email is displayed but omitted from `UpdateDoctorDto` (the generated model has no email field, which
matches FR-032).

### US2 — Schedule and patient profile

| Step | Generated method | Request | Response handling |
|------|------------------|---------|-------------------|
| Doctor's day schedule | `ScheduleService.scheduleDoctorDoctorIdGet` (`appointments`) | `{ doctorId, date }` | **blocked, P-4** |
| Patient profile | `PatientsService.patientsIdGet` (`profiles`) | `{ id }` | `readApiEnvelope(payload, isPatientProfileDto)` — typed today |
| Patient history | `ScheduleService.schedulePatientPatientIdHistoryGet` | `{ patientId }` | **blocked, P-4** |
| Result details | `AppointmentsResultService.appointmentsAppointmentIdResultsGet` | `{ appointmentId }` | **blocked, P-5** |

History is loaded once per patient; only rows with `resultId ≠ null` trigger a result call, executed in
parallel and individually fault-tolerant (a failed detail renders "Result unavailable" for that row).

Doctor identity for `/my-schedule` comes from the signed-in account's `accountId` claim and requires
`GET /Doctors/account/{accountId}` (P-1). Until it exists, `MySchedulePageComponent` cannot resolve the
doctor id and US2 cannot be demoed end-to-end.

## 2. Envelope guards to add

| Guard | Accepts | Rejects |
|-------|---------|---------|
| `isPagedDoctorRows` | `{ data: DoctorTableRowDto[], totalCount: number }` | missing `data`, non-numeric `totalCount` |
| `isSpecializationList` | `{ id, name }[]` | missing `name` |
| `isOfficeList` | `{ id, address }[]` | missing `id` |
| `isPatientProfileDto` | required first/last name, phone, date of birth | missing required fields |
| `isScheduleList` | `{ appointmentId, patientId, patientFullName, startTime, endTime, isApproved, hasResult }[]` | missing approval flag |
| `isHistoryList` | `{ appointmentId, date, doctorFullName, serviceName, resultId }[]` | missing appointment id |
| `isResultDto` | complaints/conclusion/recommendations nullable strings | non-string values |

Guards live beside the store that consumes them, take `unknown`, and never throw — the caller converts a
`null` into an `ApiContractError` with a user-facing retry message.

## 3. Error mapping

| Condition | User-visible outcome |
|-----------|----------------------|
| 400 with validation errors | messages beside fields or form-level; data kept |
| 401 | handled globally by `auth-error.interceptor` |
| 403 | "You do not have access to this action." |
| 404 on doctor | "Profile not found." with a back link |
| 404 on patient | "Patient profile not found." with retry |
| 409 on create | email field error `User with this email already exists` |
| 409 on status | row reverts, server message shown |
| 5xx / network | retryable error state (list) or toast + data kept (form) |
| contract/shape mismatch (`ApiContractError`) | "The service returned an unexpected response. Please try again." |

`extractErrorMessage` from `core/interceptors/api-error.interceptor` remains the single extractor for
`HttpErrorResponse`.

## 4. Explicitly out of scope

- Any new endpoint, controller or DTO in `Backend/` (read-only inspection only).
- A dedicated `PATCH /Doctors/{id}/status` (would simplify US4 but is a backend change).
- Patient editing, appointment-result editing, doctor deletion or archiving.
- Server-side pagination UI for the directory.
