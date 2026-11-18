# Phase 1 Data Model — Doctor Directory and Patient Profile

**Feature**: `007-doctor-directory-patient-profile` | **Date**: 2026-11-17

All models live in `Frontend/AdminApp/AdminApp/src/app/features/**/models`. Transport types stay in
`src/app/api/generated` and never reach templates; each transport payload is narrowed by a type guard
and mapped to the domain models below.

## 1. Entity overview

```text
DoctorDirectoryEntry ──1:1── DoctorFormValue ──n:1── SpecializationOption
        │                 │                        └─ OfficeOption
        │                 └─ DoctorStatus
        │
        └─(status change)─> UpdateDoctorDto ─> PUT /Doctors/{id}

DoctorScheduleEntry ──1:1── PatientRef ──1:1── PatientProfile
        │                                   └──1:n── PatientAppointmentResult
        └── isApproved gates the link to the patient profile
```

## 2. Doctor directory

### `DoctorDirectoryEntry` (`features/doctors/models/doctor-directory.model.ts`)

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| `id` | `string` | yes | `DoctorTableRowDto.id` | row key |
| `fullName` | `string` | yes | `DoctorTableRowDto.fullName` | displayed and searched |
| `specialization` | `string` | yes | `DoctorTableRowDto.specialization` | filter value |
| `officeAddress` | `string` | yes | `DoctorTableRowDto.officeAddress` | filter value |
| `dateOfBirth` | `string` (`yyyy-MM-dd`) | yes | `DoctorTableRowDto.dateOfBirth` | sliced to 10 chars |
| `status` | `DoctorStatus` | yes | `DoctorTableRowDto.status` | guarded by `isDoctorStatus` |
| `isSavingStatus` | `boolean` | yes (default `false`) | derived UI state | disables that row's select |

Rows whose `status` is not in the vocabulary are dropped by the guard rather than coerced.

### `DoctorFilterState`

| Field | Type | Default | Semantics |
|-------|------|---------|-----------|
| `nameQuery` | `string` | `''` | free text typed in the name combobox |
| `selectedDoctorId` | `string` | `''` | exact row chosen from the name combobox; `''` = no restriction |
| `specialization` | `string` | `''` | exact specialization label; `''` = all |
| `officeAddress` | `string` | `''` | exact office label; `''` = all |

`hasActiveFilters = nameQuery ≠ '' ∨ selectedDoctorId ≠ '' ∨ specialization ≠ '' ∨ officeAddress ≠ ''`.

### Derived (never writable)

| Signal | Definition |
|--------|-----------|
| `specializationOptions` | distinct sorted specializations of rows whose `officeAddress` matches the current office filter (or all rows when empty) |
| `officeOptions` | distinct sorted offices of rows whose `specialization` matches the current specialization filter (or all rows when empty) |
| `nameOptions` | `{ id, label: fullName }` for every row, sorted by full name |
| `visibleRows` | rows matching **all** active filters (AND), sorted by `fullName` |
| `isEmpty` | `visibleRows.length === 0 ∧ !isLoading ∧ loadError === null` |
| `isNarrowed` | at least one filter active and `visibleRows` differs from `rows` |

Ordering uses `Intl.Collator(undefined, { sensitivity: 'base' })` so accented and case variants sort
predictably (edge case: accented names).

## 3. Doctor form

### `DoctorFormGroup` (`features/doctors/models/doctor-form.model.ts`, extended)

| Control | Type | Mode create | Mode edit | Validators |
|---------|------|-------------|-----------|------------|
| `photo` | `File \| null` | shown | shown | type/size checked by host |
| `firstName` | `string` | required | required | `required`, `nonBlank` |
| `lastName` | `string` | required | required | `required`, `nonBlank` |
| `middleName` | `string \| null` | optional | optional | — |
| `dateOfBirth` | `string` | required | required | `required`, `maxDate(today)` |
| `email` | `string` | required, editable | shown read-only | `required`, `email`, async unique (create only) |
| `specializationText` | `string` | required | required | `required`, `catalogMatch(specializations)` |
| `specializationId` | `string` | required | required | `required` |
| `officeText` | `string` | required | required | `required`, `catalogMatch(offices)` |
| `officeId` | `string` | required | required | `required` |
| `careerStartYear` | `number \| null` | required | required | `required`, `maxYear(currentYear)` |
| `status` | `DoctorStatus` | `At work` | loaded | `required` |

`canSubmit = form.valid ∧ !isSubmitting` (FR-004, FR-033). `form.valid` already accounts for the async
email validator, which is why `statusChanges` is bridged with `toSignal` in the edit host.

### `DoctorStatus` vocabulary (unchanged, single source of truth)

`At work` · `On vacation` · `Sick Day` · `Sick Leave` · `Self-isolation` · `Leave without pay` ·
`Inactive` — exactly the strings from `doctor-form.model.ts`; used by the create form, the edit form and
the table's inline select (FR-019).

### Payload mapping

| Domain form value | `CreateDoctorDto` (POST) | `UpdateDoctorDto` (PUT) |
|-------------------|--------------------------|--------------------------|
| `firstName.trim()` | `firstName` | `firstName` |
| `lastName.trim()` | `lastName` | `lastName` |
| `middleName?.trim() ?? null` | `middleName` | `middleName` |
| `dateOfBirth` | `dateOfBirth` | `dateOfBirth` |
| `email.trim()` | `email` | **omitted** — email is immutable (FR-032) |
| selected specialization label | `specialization` | `specialization` |
| selected office label | `officeAddress` | `officeAddress` |
| `careerStartYear` | `careerStartYear` | `careerStartYear` |
| `status` | `status` | `status` |
| uploaded photo path | `photoPath` | `photoPath` |

Mapping is isolated in `features/doctors/services/doctor-form.mapper.ts` (pure functions, unit tested).
Neither payload builder writes `any`; both accept the narrowed form value type.

## 4. Validation rules (spec FR-010…FR-017, FR-036)

| # | Rule | Trigger | Message (exact) | Error key |
|---|------|---------|-----------------|-----------|
| V1 | first name required, not blank | blur / submit | `Please, enter the first name` | `required` |
| V2 | last name required, not blank | blur / submit | `Please, enter the last name` | `required` |
| V3 | email required | blur / submit | `Please, enter the email` | `required` |
| V4 | email format | blur / submit | `You've entered an invalid email` | `email` |
| V5 | email uniqueness | async, debounced 300 ms | `User with this email already exists` | `emailTaken` |
| V6 | date of birth required | blur / submit | `Please, select the date` | `required` |
| V7 | date of birth ≤ today | value change | `Date cannot be in the future` | `futureDate` |
| V8 | specialization required | blur / submit | `Please, choose the specialisation` | `required` |
| V9 | specialization must exist in catalog | blur / submit | `Invalid specialization name` | `invalidCatalogValue` |
| V10 | office required | blur / submit | `Please, choose the office` | `required` |
| V11 | career start year required | blur / submit | `Please, select the year` | `required` |
| V12 | career start year ≤ current year | value change | `Year cannot be in the future` | `futureYear` |
| V13 | status required | submit | `Please, choose the status` | `required` |
| V14 | whitespace-only text counts as empty | any | same as V1/V2 | `required` |
| V15 | invalid fields get a red border | blur / submit | visual only | — |
| V16 | server validation errors | response | message beside the field or form-level | server-defined |

Date comparison is date-only (ignores time of day), per the spec assumption.

## 5. State transitions

### 5.1 Create dialog

```text
closed ──open()──> editing ──submit[valid]──> submitting ──2xx──> closed (+ list refresh + toast)
                      │                           │
                      │                           └──error──> editing (data kept, error shown)
                      └──cancel──> confirm ──Yes──> closed (data discarded)
                                      └──No───> editing (data kept)
```

### 5.2 Profile page

```text
loading ──ok──> view ──Edit──> edit ──Save[valid]──> saving ──ok──> view (updated values, toast)
   │                    │                             └──error──> edit (data kept, error shown)
   └──error──> error(retry)   └──Cancel──> confirm ──Yes──> view (form reset from profile)
                                                └──No───> edit
```

`edit` is only reachable from `view`; `saving` blocks both actions.

### 5.3 Row status

```text
idle ──select(next ≠ current)──> saving (row locked, value already shown)
                                     ├──success──> idle (value kept)
                                     └──failure──> idle (value reverted + error toast)
```

Re-selecting the current value or a second selection while `saving` is ignored (FR "no duplicate
update").

### 5.4 Patient profile tabs

```text
personal (default) ⇄ results
```

Tab state is local to the page; switching tabs does not refetch. Results load once per patient and are
cached in the store until the page is left.

## 6. Patient profile

### `PatientProfile` (`features/patients/models/patient-profile.model.ts`)

| Field | Type | Required | Source (`PatientProfileDto`) |
|-------|------|----------|------------------------------|
| `photoPath` | `string \| null` | no | `photoPath` |
| `firstName` | `string` | yes | `firstName` |
| `lastName` | `string` | yes | `lastName` |
| `middleName` | `string \| null` | no | `middleName` |
| `phoneNumber` | `string` | yes | `phoneNumber` |
| `dateOfBirth` | `string` (`yyyy-MM-dd`) | yes | `dateOfBirth` |

`PatientProfileDto` has no id field; the route id is the profile id and is attached by the store.

### `DoctorScheduleEntry` (`features/schedule/models/doctor-schedule.model.ts`)

| Field | Type | Required | Source (`DoctorScheduleDTO`) |
|-------|------|----------|------------------------------|
| `appointmentId` | `string` | yes | `AppointmentId` |
| `patientId` | `string` | yes | `PatientId` |
| `patientFullName` | `string` | yes | `PatientFullName` |
| `serviceName` | `string` | yes | `ServiceName` |
| `startTime` / `endTime` | `string` (ISO) | yes | `StartTime` / `EndTime` |
| `isApproved` | `boolean` | yes | `IsApproved` |
| `hasResult` | `boolean` | yes | `HasResult` |

`canOpenPatient = isApproved` — the only rule that enables the link (FR-040).

### `PatientAppointmentResult`

| Field | Type | Required | Source |
|-------|------|----------|--------|
| `appointmentId` | `string` | yes | history `AppointmentId` |
| `date` | `string` | yes | history `Date` |
| `doctorFullName` | `string` | yes | history `DoctorFullName` |
| `serviceName` | `string` | yes | history `ServiceName` |
| `complaints` | `string \| null` | no | result `Complaints` |
| `conclusion` | `string \| null` | no | result `Conclusion` |
| `recommendations` | `string \| null` | no | result `Recommendations` |

Joined by the store: history rows with `resultId ≠ null` are fetched in parallel via the results
endpoint; a failed individual fetch degrades that row to "result unavailable" instead of failing the
tab. Rows are sorted by `date` descending (FR-043).

## 7. Access rules

| Route | Roles | Extra guard |
|-------|-------|-------------|
| `/doctors` | Receptionist | — |
| `/doctors/:id/profile` | Receptionist | — |
| `/profile` | Doctor | — |
| `/my-schedule` | Doctor | — |
| `/patients/:id/profile` | Doctor | approved appointment for that patient |

`roleGuard` already implements the role part; the patient guard is new (R-10).
