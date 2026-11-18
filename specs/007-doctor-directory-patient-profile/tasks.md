# Tasks: Doctor Directory and Patient Profile

**Input**: Design documents from `/specs/007-doctor-directory-patient-profile/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: The spec does not mandate TDD, but `plan.md` R-12 defines the required suites and the repository already runs 32 Vitest specs via `ng test`. Test tasks are therefore included and use the project's `*.spec.ts` convention.

**Organization**: Tasks are grouped by user story in priority order (US1 P1 → US4 P2 → US3 P3 → US2 P4). Each story is independently implementable and testable once the Foundational phase is complete.

## Blocking Gates

| Gate | Blocks | Notes |
|---|---|---|
| **P-1** `GET /Doctors/account/{accountId}` missing | T050, T051, T052, T057, all US2 tasks | Backend endpoint absent; cannot be worked around from the SPA |
| **P-2** `GET /Doctors/{id}` typed response without `status` | T030 (`setStatus`), T040 (`load`), US4 status tasks | **Resolved via overlay**; status comes from `doctorsDoctorsGet` |
| **P-3** `POST /Doctors` returns `void` | T019, T023 | **Resolved via overlay**; now `ApiResponseOfGuid` |
| **P-4** schedule + patient history return `void` | T051, T052, T053, T057 | Both DTOs exist in `Backend/AppointmentsAPI`; only schemas missing |
| **P-5** appointment result returns `void` | T053, T055 | History rows expose `resultId` only |
| **P-6** `POST /documents/documents` not in any generated client | T021, T041, photo control in T018 | **Deferred**; photo control hidden (`showPhoto = false`) |

Per the constitution: resolve the gate in the owning microservice and regenerate. Do **not** add a hand-written HTTP service, reuse `api/doctor.service.ts`, or read the raw body through a `$Response` method.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: `US1` create, `US4` directory/filters/status, `US3` edit, `US2` patient profile
- All paths are repository-relative and target `AdminApp/` only

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the generated clients describe the operations this feature needs, then create the feature skeleton. No UI behavior yet.

- [ ] T001 **BLOCKED (P-1, P-2, P-3)** Regenerate the Profiles client so `GET /Doctors/{id}` returns a typed payload that includes `status`, `POST /Doctors` returns `ApiResponse<Guid>`, and `GET /Doctors/account/{accountId}` exists; run `npm run api:profiles` from `AdminApp/` and verify in `AdminApp/src/app/api/generated/profiles/services/doctors.service.ts` that `doctorsIdGet`, `doctorsPost` and the account lookup are no longer `Observable<void>`; do not hand-write a replacement if a signature is still wrong
- [ ] T002 [P] **BLOCKED (P-4, P-5)** Regenerate the Appointments client so `GET /Schedule/doctor/{doctorId}` returns `ApiResponse<IEnumerable<DoctorScheduleDTO>>`, `GET /Schedule/patient/{patientId}/history` returns `ApiResponse<IEnumerable<PatientAppointmentHistoryDTO>>`, and `GET /appointments/{appointmentId}/results` returns `ApiResponse<ViewAppointmentResultDTO>`; run `npm run api:appointments` and verify the three methods in `AdminApp/src/app/api/generated/appointments/services/{schedule,appointments-result}.service.ts`
- [ ] T003 [P] **BLOCKED (P-6)** Add the documents upload operation to the generated Profiles client (`AdminApp/scripts/augment-profiles-openapi.mjs` + `AdminApp/ng-openapi-gen.profiles.json`), regenerate with `npm run api:profiles`, and confirm a generated method accepting a multipart `File`/`Blob` exists; if the product decision is to defer photos, record that decision and mark every photo task skipped
- [x] T004 [P] Create the feature skeleton: `AdminApp/src/app/features/doctors/{components,models,services}`, `AdminApp/src/app/features/doctors/components/{doctor-form,doctor-create-dialog,doctor-filters,doctor-table}`, `AdminApp/src/app/features/patients/{models,services,components,pages}`, `AdminApp/src/app/features/patients/components/{patient-personal-info,patient-results}`, `AdminApp/src/app/features/patients/pages/patient-profile-page`, `AdminApp/src/app/features/schedule/{models,services,pages}`, `AdminApp/src/app/features/schedule/pages/my-schedule-page`, `AdminApp/src/app/shared/components/app-tabs`
- [x] T005 [P] Record the baseline: run `npm run build` and `npm test` in `AdminApp/` and note the current passing spec count so later regressions are attributable

**Checkpoint**: Every generated signature needed by the feature is typed; `npm run build` is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Models, guards, shared tab primitives and catalog access shared by all four stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 [P] Create `AdminApp/src/app/features/doctors/models/doctor-directory.model.ts` with `DoctorDirectoryEntry` (`id: string`, `fullName: string`, `specialization: string`, `officeAddress: string`, `dateOfBirth: string` in `yyyy-MM-dd`, `status: DoctorStatus`, `isSavingStatus: boolean` default `false`), `DoctorFilterState` (`nameQuery`, `selectedDoctorId`, `specialization`, `officeAddress`, all `string` and default `''`, all `readonly`), `CATALOG_ALL_LABEL = 'All'`, and `sortByFullName` using one shared `Intl.Collator(undefined, { sensitivity: 'base' })`
- [x] T007 [P] Extend `AdminApp/src/app/features/doctors/models/doctor-form.model.ts` (keep `DoctorStatus`, `DOCTOR_STATUSES`, `isDoctorStatus` unchanged) with `DoctorFormMode = 'create' | 'edit'`, the `DoctorFormGroup` control map from `data-model.md` §3 (non-nullable `firstName`, `lastName`, `dateOfBirth`, `email`, `specializationText`, `specializationId`, `officeText`, `officeId`, `status` defaulting to `DoctorStatus.AtWork`; `middleName: string | null`; `careerStartYear: number | null`; `photo: File | null`), `DoctorFormValue`, and the copy constants `CANCEL_CREATE_MESSAGE = 'Do you really want to cancel? Entered data will not be saved.'` and `CANCEL_EDIT_MESSAGE = 'Do you really want to cancel? Changes will not be saved.'`
- [x] T008 [P] Create `AdminApp/src/app/features/patients/models/patient-profile.model.ts` (`PatientProfile` with `id`, `photoPath: string | null`, `firstName`, `lastName`, `middleName: string | null`, `phoneNumber`, `dateOfBirth`; `PatientAppointmentResult` with `appointmentId`, `date`, `doctorFullName`, `serviceName`, `complaints: string | null`, `conclusion: string | null`, `recommendations: string | null`) and `AdminApp/src/app/features/schedule/models/doctor-schedule.model.ts` (`DoctorScheduleEntry` with `appointmentId`, `patientId`, `patientFullName`, `serviceName`, `startTime`, `endTime`, `isApproved`, `hasResult`, plus `canOpenPatient = isApproved`)
- [x] T009 [P] Create the guards `AdminApp/src/app/features/doctors/services/doctor-contract.guards.ts` with `isPagedDoctorRows`, `isDoctorDetails`, `isSpecializationList`, `isOfficeList` (signatures per `contracts/api-contracts.md` §2); every guard takes `unknown`, returns a type predicate, never throws, and rejects entries whose `status` fails `isDoctorStatus`
- [x] T010 [P] Create `AdminApp/src/app/shared/components/app-tabs/app-tabs.component.ts` + `.html`: standalone, `OnPush`, inputs `tabs: readonly { id: string; label: string }[]` (required) and `activeId: string` (required), output `activeChange: string`; `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabindex`, and `FocusKeyManager` from `@angular/cdk/a11y` handling `ArrowLeft`/`ArrowRight`/`Home`/`End`; Tailwind utilities only, no stylesheet, no `@apply`
- [x] T011 [P] Create `AdminApp/src/app/features/doctors/services/doctor-catalog.store.ts`: `providedIn: 'root'`, signal store exposing `specializations` and `offices` as `readonly AutocompleteOption[]`, `isLoading`, `error`, and `reload()`; load through the generated appointments `SpecializationsService.specializationsGet()` and `OfficesService.officesGet()` only, narrow with `readApiEnvelope` + the T009 guards, map office label to `address`/`fullAddress`, and surface failures as a retryable error instead of an empty list
- [x] T012 [P] Create `AdminApp/src/app/features/doctors/services/doctor-form.mapper.ts` with the pure functions from `data-model.md` §3: `toCreateDoctorDto(value: DoctorFormValue, photoPath: string | null): CreateDoctorDto` and `toUpdateDoctorDto(value: DoctorFormValue, photoPath: string | null): UpdateDoctorDto`; both trim names, coerce `middleName` to `null` when blank, resolve specialization/office **labels** (not ids) from `DoctorFormValue`, and `toUpdateDoctorDto` MUST NOT carry an email field
- [x] T013 [P] Refactor `AdminApp/src/app/core/validators/email-unique.validator.ts` to accept a lookup callback `(email: string) => Observable<boolean>` instead of injecting `DoctorService`, keep the 300 ms debounce, treat lookup failures as "not taken" (fail-open), and update `AdminApp/src/app/core/validators/email-unique.validator.spec.ts` to the new signature
- [x] T014 Run `npm run build` in `AdminApp/` and confirm the new models, guard file (`AdminApp/src/app/features/doctors/services/doctor-contract.guards.ts`), tabs component (`AdminApp/src/app/shared/components/app-tabs/app-tabs.component.ts`), catalog store and mapper compile under `strictTemplates`; fix type errors by tightening types, never by widening to `any`

**Checkpoint**: Foundation ready — US1, US4, US3 and US2 can proceed in parallel where their files do not overlap.

---

## Phase 3: User Story 1 — Create a doctor profile (Priority: P1) — MVP

**Goal**: A Receptionist opens the create dialog from the directory, fills the doctor's data, attaches an optional photo, and confirms; the system stores the profile, the backend provisions credentials, and the directory refreshes.

**Independent Test**: Sign in as Receptionist, open "Doctors", click "Create doctor", verify the fields and disabled Confirm, verify every required-message and the invalid-email message, complete a valid form and confirm, then repeat and cancel through the dialog with both answers.

### Tests for User Story 1

- [x] T015 [P] [US1] Write `AdminApp/src/app/features/doctors/components/doctor-form/doctor-form.component.spec.ts` covering create mode: all eight required fields plus photo rendered; `Confirm` disabled while empty; on-blur messages `Please, enter the first name`, `Please, enter the last name`, `Please, enter the email`, `Please, select the date`, `Please, choose the specialisation`, `Please, choose the office`, `Please, select the year`, `Please, choose the status`; `You've entered an invalid email`; `Invalid specialization name`; red-border class on invalid touched controls; whitespace-only first name treated as empty; email editable in create mode
- [x] T016 [P] [US1] Write `AdminApp/src/app/features/doctors/services/doctor-form.mapper.spec.ts` covering: trimming, blank `middleName` → `null`, specialization/office resolved to catalog labels, `careerStartYear` numeric, `photoPath` passthrough, and that the update mapper contains no `email` key
- [x] T017 [P] [US1] Write `AdminApp/src/app/features/doctors/components/doctor-create-dialog/doctor-create-dialog.component.spec.ts` covering: valid submit uploads the photo (when attached) then calls create exactly once; the directory refresh callback fires exactly once; double submit is ignored; a 409 sets the email error `User with this email already exists` and keeps the dialog open with data; cancel with untouched form closes without the confirm dialog; cancel with a dirty form opens it and `No` keeps data while `Yes` closes with `created: null`

### Implementation for User Story 1

- [x] T018 [US1] Create `AdminApp/src/app/features/doctors/components/doctor-form/doctor-form.component.ts` + `.html`: standalone dumb component with the inputs/outputs in `contracts/ui-contracts.md` §2.1, `ReactiveFormsModule`, the photo preview, name/date/email inputs, the specialization combobox (`app-combobox` or `app-autocomplete` — one consistent choice), the office dropdown, the career start year input and the status select; render messages only for touched + invalid controls; no `inject()`, no HTTP, no routing; primary action labelled `Confirm` in create mode and `Save changes` in edit mode
- [x] T019 [US1] Create `AdminApp/src/app/features/doctors/components/doctor-create-dialog/doctor-create-dialog.component.ts` + `.html`: standalone smart host opened through `@angular/cdk/dialog`, hosting `DoctorFormComponent`; builds the form with `Validators.required` + `nonBlankValidator` + `maxDateValidator` + `maxYearValidator` + `catalogMatchValidator` and the async email check from T013 wired to `DoctorsService.doctorsDoctorsGet`; submit order is photo upload → `DoctorsService.doctorsPost` → close, with `isSubmitting` guarding re-entry
- [ ] T020 [US1] **BLOCKED (P-6)** Wire the photo control in `AdminApp/src/app/features/doctors/components/doctor-create-dialog/doctor-create-dialog.component.ts` to the generated documents method from T003; on upload failure show the error and do not create the profile. If T003 is deferred, hide the photo control and record the deviation in this task
- [x] T021 [US1] Implement the cancel flow in `AdminApp/src/app/features/doctors/components/doctor-create-dialog/doctor-create-dialog.component.ts` using `CancelConfirmDialogComponent` with `message: CANCEL_CREATE_MESSAGE`, `confirmText: 'Yes'`, `cancelText: 'No'`, `disableClose: true`, `restoreFocus: true`; `Yes` closes with `created: null`, `No` keeps every entered value
- [x] T022 [US1] Replace the inline create panel in `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.ts` + `.html` with a CDK dialog opened from the `Create doctor` button; on `created !== null` trigger the directory reload seam and show a success toast through `NotificationService`
- [x] T023 [US1] Switch the directory read in `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.ts` from `DoctorService.getDoctorsForTable` to the generated `DoctorsService.doctorsDoctorsGet` (`page: 1`, `pageSize: 50`) narrowed by `readApiEnvelope` + `isPagedDoctorRows`; keep the existing loading/error/retry rendering until US4 replaces it
- [x] T024 [US1] Delete `AdminApp/src/app/features/doctors/components/doctor-create/` (component, template, spec) and remove every remaining import of it; confirm no file under `AdminApp/src/app/api/generated/**` was edited
- [x] T025 [US1] Run `npm test` and `npm run build`; validate the US1 rows of `quickstart.md` §4 manually and record any skipped row with its reason

**Checkpoint**: US1 is fully functional and demoable on its own.

---

## Phase 4: User Story 4 — Browse, filter and change doctor status (Priority: P2)

**Goal**: The Receptionist sees every doctor in a table whose status changes inline, and narrows the list with combinable name, specialization and office filters whose options cascade.

**Independent Test**: Open "Doctors", verify the five columns and the status control, change one status and reload, then combine name + specialization + office filters and verify only matching doctors remain; clear filters and verify the full list returns.

### Tests for User Story 4

- [x] T026 [P] [US4] Write `AdminApp/src/app/features/doctors/services/doctor-directory.store.spec.ts` covering the cascade: specialization options limited to the selected office; office options limited to the selected specialization; both empty → full catalogs; `visibleRows` applies name + doctor + specialization + office with AND semantics; clearing one filter re-widens the other; `clearFilters()` restores all rows; changing specialization to a value absent from the current office list resets the office filter instead of producing an empty table; `loadAll()` aggregates pages until `totalCount`, stops on an empty page and respects the 50-page cap
- [x] T027 [P] [US4] Write `AdminApp/src/app/features/doctors/services/doctor-directory.store.status.spec.ts` covering: selection patches the row optimistically and marks it saving; one `PUT` with the full body per change; success keeps the value; failure restores the previous value and exposes the error; selecting the current value sends nothing; a second selection while saving is ignored
- [x] T028 [P] [US4] Write `AdminApp/src/app/features/doctors/components/doctor-filters/doctor-filters.component.spec.ts` covering: name combobox lists every doctor sorted by full name; selecting a doctor emits a state with `selectedDoctorId` and `nameQuery`; clearing it clears both; specialization and office selects emit `''` for `All`; a selected value missing from the narrowed options renders a disabled placeholder option rather than silently clearing; `Clear filters` emits the empty state; the component never mutates the `state` input
- [x] T029 [P] [US4] Write `AdminApp/src/app/features/doctors/components/doctor-table/doctor-table.component.spec.ts` covering: the five columns in order; seven status options per select; disabled select for the saving row; `statusChange` carries `{ id, status }`; name click emits `profileRequested`; loading, retryable error and empty states render instead of a blank table

### Implementation for User Story 4

- [x] T030 [US4] Create `AdminApp/src/app/features/doctors/services/doctor-directory.store.ts`: `providedIn: 'root'` signal store with `rows`, `isLoading`, `loadError`, `nameQuery`, `selectedDoctorId`, `specialization`, `officeAddress`; computed `specializationOptions`, `officeOptions`, `nameOptions`, `visibleRows`, `hasActiveFilters`, `isNarrowed`, `isEmpty`; `loadAll()` uses only `DoctorsService.doctorsDoctorsGet` (no server-side filter params), `pageSize: 100`, aggregation per T026; `setStatus(id, next)` implements `data-model.md` §5.3 using `DoctorsService.doctorsIdGet` (P-2) + `doctorsIdPut` and `readApiEnvelope`/`readApiAcknowledgment`
- [x] T031 [P] [US4] Create `AdminApp/src/app/features/doctors/components/doctor-table/doctor-table.component.ts` + `.html` per `contracts/ui-contracts.md` §2.4: dumb, `OnPush`, Tailwind table with `overflow-x-auto`, full-name button, specialization, status `<select>` (disabled while saving, accessible label `Status for <full name>`), date of birth, office, empty/loading/error blocks, values wrapping instead of truncating
- [x] T032 [P] [US4] Create `AdminApp/src/app/features/doctors/components/doctor-filters/doctor-filters.component.ts` + `.html` per `contracts/ui-contracts.md` §2.3: dumb, `OnPush`, name combobox with type-to-filter, specialization and office `<select>` elements listing `All` first, `Clear filters` button, single replacement-state emission per change, no `FormControl` and no `valueChanges`
- [x] T033 [US4] Rework `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.ts` + `.html` into the smart container: inject `DoctorDirectoryStore` and `DoctorCatalogStore`, compose `DoctorFiltersComponent` + `DoctorTableComponent`, call `loadAll()` in `ngOnInit`, wire `filterChange` to store setters and `profileRequested` to the router
- [x] T034 [US4] Wire the inline status update in `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.ts`: call `store.setStatus`, show `Status changed to "<status>"` on success, show the extracted error and rely on the store's rollback on failure; keep the row select locked while saving
- [x] T035 [US4] Add the cascade reset in `AdminApp/src/app/features/doctors/services/doctor-directory.store.ts`: when the active specialization (or office) is no longer present in the narrowed option list, clear that single filter inside an `effect`/derived update; guarantee no infinite loop and cover it with T026
- [x] T036 [US4] Run `npm test` and `npm run build` in `AdminApp/`; validate `specs/007-doctor-directory-patient-profile/quickstart.md` §5 including the 500-doctor timing check and confirm the network panel shows no request per filter change

**Checkpoint**: US1 and US4 both work independently.

---

## Phase 5: User Story 3 — Edit a doctor profile (Priority: P3)

**Goal**: A Doctor edits their own profile and a Receptionist edits any doctor's profile through the same form used at creation; saving returns to view mode and cancelling asks for confirmation.

**Independent Test**: Open a doctor profile as Receptionist, click "Edit", verify Save stays disabled while a required field is invalid, save a valid change and verify view mode shows it; repeat and cancel with both answers.

### Tests for User Story 3

- [x] T037 [P] [US3] Extend `AdminApp/src/app/features/doctors/components/doctor-form/doctor-form.component.spec.ts` with edit mode: email rendered read-only/disabled; primary action reads `Save changes`; all eight messages identical to create mode; save disabled while invalid or submitting
- [x] T038 [P] [US3] Write `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.spec.ts` covering: view mode by default with an `Edit` action; edit mode prefilled from the profile with specialization/office resolved to catalog labels; save sends one `PUT` with the full body and no email; success returns to view mode showing the new values; failure keeps edit mode with the data and shows an error; cancel shows `Do you really want to cancel? Changes will not be saved.`, `No` keeps edits and `Yes` restores the stored profile

### Implementation for User Story 3

- [x] T039 [US3] Rework `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts` + `.html` to host `DoctorFormComponent` in edit mode: keep the existing route resolution (`/doctors/:id/profile` for Receptionist, `/profile` for Doctor), replace the `ProfileEditComponent` usage, keep `ProfileViewComponent` for view mode, and preserve `ChangeDetectionStrategy.OnPush`
- [x] T040 [US3] Implement the save flow in `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts`: build `UpdateDoctorDto` via `toUpdateDoctorDto`, upload the photo when a new file is selected (P-6), call `DoctorsService.doctorsIdPut`, then apply the saved values to the local profile, return to view mode and show a success toast; on failure stay in edit mode and show the error
- [x] T041 [US3] Implement the edit cancel flow in `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts` with `CancelConfirmDialogComponent` using `message: CANCEL_EDIT_MESSAGE`, `confirmText: 'Yes'`, `cancelText: 'No'`, `disableClose: true`; `Yes` resets the form from the stored profile and returns to view mode, `No` keeps edit mode and the entered data
- [x] T042 [US3] Replace the profile read in `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts` with the typed `DoctorsService.doctorsIdGet` (P-2) for the Receptionist route and the account lookup (P-1) for the Doctor route, narrowing with `readApiEnvelope` + `isDoctorDetails`; delete the `getDoctorStatus` table fallback
- [x] T043 [US3] Delete `AdminApp/src/app/features/profile/components/profile-edit/` and remove every import of it, including the `profile-edit` entry in any path or barrel; confirm the shared form is the only editor
- [x] T044 [US3] Run `npm test` and `npm run build` in `AdminApp/`; validate `specs/007-doctor-directory-patient-profile/quickstart.md` §6 including the role restriction in 3.9

**Checkpoint**: US1, US4 and US3 are independently functional.

---

## Phase 6: User Story 2 — Patient profile from the schedule (Priority: P4)

**Goal**: A Doctor's schedule links approved appointments to a read-only patient profile with a personal-information tab and an appointment-results tab.

**Independent Test**: Seed one approved and one not-approved appointment; verify only the approved patient name is a link, the profile opens on "Personal information", and "Appointment results" shows recorded results or an empty state.

### Tests for User Story 2

- [x] T045 [P] [US2] Write `AdminApp/src/app/shared/components/app-tabs/app-tabs.component.spec.ts` covering: `role="tablist"`/`role="tab"`/`aria-selected`; only the active tab is tabbable; `ArrowLeft`/`ArrowRight`/`Home`/`End` move and activate; `activeChange` emits once per move; panels are addressed through `aria-controls`
- [ ] T046 [P] [US2] Write `AdminApp/src/app/features/schedule/services/doctor-schedule.store.spec.ts` covering: approved rows expose `canOpenPatient === true`; non-approved rows expose `false`; the store calls `scheduleDoctorDoctorIdGet` with the selected date; a failed load produces a retryable error and keeps no stale rows; an empty day shows the empty state
- [ ] T047 [P] [US2] Write `AdminApp/src/app/features/patients/services/patient-profile.store.spec.ts` covering: profile mapped from `patientsIdGet` with `id` attached from the route; history sorted by date descending; only rows with `resultId` trigger a result fetch; results joined into `PatientAppointmentResult`; one failing result fetch degrades only that row; no results → empty state, not an error; profile failure → error state with retry
- [ ] T048 [P] [US2] Write `AdminApp/src/app/features/patients/pages/patient-profile-page/patient-profile-page.component.spec.ts` covering: two tabs with `Personal information` active by default; switching tabs renders the results table; the personal tab shows photo/placeholder, three names (middle only when present), phone and date of birth; the results table shows date, doctor, service, complaints, conclusion and recommendations; retry calls the store again

### Implementation for User Story 2

- [ ] T049 [US2] **BLOCKED (P-1, P-4)** Create `AdminApp/src/app/features/schedule/services/schedule-contract.guards.ts` with `isScheduleList` (`appointmentId`, `patientId`, `patientFullName`, `startTime`, `endTime`, `isApproved`, `hasResult`; rejects missing approval flag) and create `AdminApp/src/app/features/schedule/services/doctor-schedule.store.ts`: `providedIn: 'root'`, resolves the signed-in doctor id from the account (P-1), loads a day via `ScheduleService.scheduleDoctorDoctorIdGet({ doctorId, date })`, narrows with `readApiEnvelope` + `isScheduleList`, and exposes `entries`, `selectedDate`, `isLoading`, `loadError`, `reload()`
- [ ] T050 [US2] Create `AdminApp/src/app/features/schedule/pages/my-schedule-page/my-schedule-page.component.ts` + `.html`: standalone smart page with a Tailwind date field defaulting to today, a loading state, a retryable error state, and a row list where the patient name is a router link **only** when `isApproved`, otherwise plain text with `aria-disabled="true"` and no click handler
- [ ] T051 [US2] Create `AdminApp/src/app/features/patients/services/patient-contract.guards.ts` with `isPatientProfileDto` (required first/last name, phone, date of birth), `isHistoryList` (`appointmentId`, `date`, `doctorFullName`, `serviceName`, `resultId`) and `isResultDto` (nullable string complaints/conclusion/recommendations), then create `AdminApp/src/app/features/patients/services/patient-profile.store.ts`: `providedIn: 'root'`, loads `PatientsService.patientsIdGet({ id })` (typed today) and `ScheduleService.schedulePatientPatientIdHistoryGet({ patientId })` (P-4), then fetches `AppointmentsResultService.appointmentsAppointmentIdResultsGet({ appointmentId })` (P-5) in parallel for rows with `resultId`, joins per T047, and exposes `profile`, `results`, `isLoading`, `loadError`, `reload()`; every response goes through `readApiEnvelope` with the guard above
- [ ] T052 [P] [US2] Create `AdminApp/src/app/features/patients/components/patient-personal-info/patient-personal-info.component.ts` + `.html`: dumb, `OnPush`, `profile: PatientProfile` input; photo or neutral placeholder, first/last/middle name, phone, formatted date of birth; Tailwind only
- [ ] T053 [P] [US2] Create `AdminApp/src/app/features/patients/components/patient-results/patient-results.component.ts` + `.html`: dumb, `OnPush`, `results: readonly PatientAppointmentResult[]` and `isLoading` inputs; most-recent-first table with date, doctor, service, complaints, conclusion, recommendations; explicit empty state and a per-row "Result unavailable" state; Tailwind only
- [ ] T054 [US2] Create `AdminApp/src/app/features/patients/pages/patient-profile-page/patient-profile-page.component.ts` + `.html`: smart page composing `AppTabsComponent`, `PatientPersonalInfoComponent` and `PatientResultsComponent`; tabs `personal` (default) and `results`; loading, error and retry states; `OnPush`
- [ ] T055 [US2] Create `AdminApp/src/app/core/guards/patient-profile.guard.ts` as a functional `CanActivateFn`: allow only when the signed-in role is `Doctor` and the schedule contains an approved appointment whose `patientId` equals the route `id`; otherwise return a `UrlTree` to `/my-schedule`. Reuse the schedule store; do not duplicate transport
- [ ] T056 [US2] Register the routes in `AdminApp/src/app/app.routes.ts`: `path: 'my-schedule'` with `roleGuard('Doctor')` and lazy `MySchedulePageComponent`; `path: 'patients/:id/profile'` with `roleGuard('Doctor')` + `patientProfileGuard` and lazy `PatientProfilePageComponent`; leave the existing doctors/profile routes unchanged
- [ ] T057 [US2] Add the `My schedule` navigation entry for Doctors in the component that renders the header (`AdminApp/src/app/app.ts` or `AdminApp/src/app/shared/layout/app-header/app-header.component.ts`, whichever currently owns the nav) so `roleGuard('Doctor')` has a reachable entry point
- [ ] T058 [US2] Run `npm test` and `npm run build` in `AdminApp/`; validate `specs/007-doctor-directory-patient-profile/quickstart.md` §7, including keyboard-only tab navigation and the direct-URL denial in 2.10

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Remove the pre-existing hand-written transport and verify the constitutional gates.

- [x] T059 Delete `AdminApp/src/app/api/doctor.service.ts`, `AdminApp/src/app/api/office.service.ts`, `AdminApp/src/app/api/specialization.service.ts` and `AdminApp/src/app/api/specialization.service.spec.ts`; fix every import so the build resolves exclusively through `src/app/api/generated/**` plus `api-envelope.ts`
- [x] T060 [P] Sweep for leftovers: no reference to `DoctorService`, `OfficeService`, `SpecializationService`, `DoctorCreateComponent`, `ProfileEditComponent`, or `getDoctorStatus` remains anywhere under `AdminApp/src/app`
- [x] T061 [P] Run the constitutional scans and fix findings: `grep -rn "\bany\b" AdminApp/src/app/features/{doctors,patients,schedule}`; every `.subscribe(` bounded by `takeUntilDestroyed` or replaced with `toSignal`/`firstValueFrom`; no `@apply` and no new component stylesheet; every new component `standalone: true` + `OnPush`; no `I`-prefixed interface
- [x] T062 [P] Accessibility and responsive pass on the touched screens (`AdminApp/src/app/features/doctors/components/doctor-form/`, `AdminApp/src/app/features/doctors/components/doctor-table/`, `AdminApp/src/app/features/doctors/components/doctor-filters/`, `AdminApp/src/app/shared/components/app-tabs/`, `AdminApp/src/app/features/patients/pages/patient-profile-page/`): dialog focus trap + restoration, combobox `aria-*` wiring, table select labels, tab keyboard support, error messages linked via `aria-describedby`, and 375 px layouts for the form, table and patient profile
- [x] T063 [P] Update `AdminApp/src/app/shared/layout/app-header/app-header.component.html` (or `app.ts`) if any label or nav item still points at removed routes; keep role visibility correct for Doctor and Receptionist
- [ ] T064 Run the full `specs/007-doctor-directory-patient-profile/quickstart.md` walkthrough end to end, including §2 contract preflight, §8 cross-cutting checks and §9 troubleshooting; record which rows could not be executed and why
- [x] T065 Final `npm test` + `npm run build` in `AdminApp/`; confirm the suite count did not drop below the T005 baseline and the bundle stays within the 500 kB / 1 MB budgets

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T001/T002/T003 are blocked by backend schema work and gate the stories that consume them
- **Foundational (Phase 2)**: depends on Setup; blocks every user story
- **US1 (Phase 3)**: depends on Foundational + P-3 (and P-6 for photos)
- **US4 (Phase 4)**: depends on Foundational + P-2; reuses the directory page introduced by US1
- **US3 (Phase 5)**: depends on Foundational + P-2 (and P-1 for the Doctor's own profile)
- **US2 (Phase 6)**: depends on Foundational + P-1 + P-4 + P-5
- **Polish (Phase 7)**: depends on every story you intend to ship

### Story Dependencies

- US1 (P1) — independent; MVP slice
- US4 (P2) — independent of US1 logically, but shares `doctors-page`; implement after US1 to avoid conflicting rewrites
- US3 (P3) — depends on the shared form from US1 (T018) but is otherwise independent
- US2 (P4) — fully independent of US1/US3/US4; only the shared tabs component (T010) is shared

### Within Each Story

- Tests first (T015–T017, T026–T029, T037–T038, T045–T048) and failing before implementation
- Models/guards before stores; stores before pages; dumb components before their smart hosts
- Story complete and validated before moving to the next priority

---

## Parallel Opportunities

```bash
# Setup (independent files / independent regenerations)
T002 regenerate appointments client
T003 add documents operation
T004 create feature skeleton

# Foundational (different files)
T006 doctor-directory.model.ts
T007 doctor-form.model.ts
T008 patient/schedule models
T009 contract guards
T010 app-tabs component
T011 doctor-catalog.store.ts
T012 doctor-form.mapper.ts
T013 email-unique validator

# US1 tests
T015 doctor-form spec
T016 mapper spec
T017 create-dialog spec

# US4 tests
T026 cascade spec
T027 status spec
T028 filters spec
T029 table spec

# US2 tests
T045 tabs spec
T046 schedule store spec
T047 patient store spec
T048 patient page spec

# US2 dumb components
T052 patient-personal-info
T053 patient-results
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (T001–T005) and Phase 2 (T006–T014)
2. Complete Phase 3 (T015–T025)
3. **STOP and VALIDATE** against `quickstart.md` §4
4. Demo if ready — a Receptionist can create a doctor end to end

### Incremental Delivery

1. Setup + Foundational → typed clients, shared primitives
2. US1 → validate → demo (MVP)
3. US4 → validate → demo (operational directory)
4. US3 → validate → demo (corrections)
5. US2 → validate → demo (doctor-facing patient context)
6. Polish → remove the legacy transport, run the full walkthrough

### Parallel Team Strategy

After Phase 2:

- Developer A: US1 → US4 (same page, sequential)
- Developer B: US3 once T018 lands
- Developer C: US2 once P-1/P-4/P-5 are delivered

Stories must not be started before their gate is cleared; blocked tasks stay unchecked with the gate ID in the description.

---

## Notes

- `[P]` marks different files with no incomplete dependency
- Every task names its exact file path and, where a rule matters, quotes the constraint from spec/data-model (messages, statuses, dialog copy)
- Do not edit `AdminApp/src/app/api/generated/**` by hand; regenerate
- Do not introduce `any`, hand-written HTTP services, `@apply` or component stylesheets
- Commit after each task or logical group; stop at each checkpoint to validate the story independently
- If a generated signature is still `void`, the task stays blocked — it is not implemented with a workaround

---

## Implementation Notes (2026-11-17)

### Status at a glance

| Area | State |
|---|---|
| Setup (T001–T005) | T004/T005 done; T001–T003 blocked by backend schema work |
| Foundational (T006–T014) | Done |
| US1 create (T015–T025) | Done, photo control hidden (P-6) |
| US4 directory/filters/status (T026–T036) | Done |
| US3 edit (T037–T044) | Receptionist route done; the Doctor's own `/profile` stays blocked by P-1 |
| US2 patient profile (T045–T058) | Only T045 (shared tabs spec) done; the story stays blocked by P-1/P-4/P-5 |
| Polish (T059–T065) | T059–T063, T065 done; T064 pending (needs a browser session and the US2 gates) |

### Gates

- **P-2 — resolved via the sanctioned overlay.** `scripts/augment-profiles-openapi.mjs` now declares
  `GET /Doctors/{id}` as `ApiResponseOfDoctorDetailsDto`; `doctorsIdGet` is typed, but the payload has
  **no `status`**. US4/US3 therefore read the status from the typed table endpoint
  (`doctorsDoctorsGet`, `pageSize: 500`) instead of inventing a field. No backend file was edited and no
  hand-written client was added.
- **P-3 — resolved via the sanctioned overlay.** `POST /Doctors` is declared as `ApiResponseOfGuid`, so
  `doctorsPost` returns the created id and `isSuccess: false` is detectable. `PUT /Doctors/{id}` is
  declared as `ApiResponse` for the same reason.
- **P-1 — still open.** `GET /Doctors/account/{accountId}` does not exist. `/profile` for a Doctor renders
  an explicit "not available" state and every US2 task stays unchecked.
- **P-4/P-5 — still open.** Schedule, patient history and appointment results are still `Observable<void>`
  in the generated Appointments client.
- **P-6 — deferred by product decision.** The photo control is hidden behind
  `DoctorFormComponent.showPhoto = false`; T020 stays unchecked.

### Recorded deviations

1. **T020 (photo)** — deferred, see P-6. The shared form renders no photo input and the create dialog
   posts `photoPath: null`.
2. **T013 (async email uniqueness)** — the callback-based validator and its spec are in place, but no typed
   operation can answer the lookup: `DoctorTableRowDto` has no email field. The dialog relies on the
   server's `409` (`emailTaken`) instead; the validator stays available for when a lookup endpoint lands.
3. **T032 (filter state)** — the task says "no `FormControl` and no `valueChanges`". The store uses pure
   signals and `computed` as required; the *dumb* panel uses one `FormControl` for the name combobox
   because that is the contract of the shared `app-autocomplete` (`ControlValueAccessor`), with
   `takeUntilDestroyed` and an exact-label guard to avoid duplicate emissions. `research.md` R-1 still
   records the rejected store-level `valueChanges` cascade.
4. **T042 (profile read)** — `doctorsIdGet` is typed and used, but the Doctor branch cannot resolve an
   account → doctor mapping without P-1, so it shows the blocked state instead of the account lookup.
   `getDoctorStatus` is gone.
5. **T030 (page size)** — `loadAll()` uses `pageSize: 100` and aggregates until `totalCount`, an empty page
   or the 50-page cap; the store, not the page, owns the read, so T023's `pageSize: 50` never shipped.
6. **T025 / T036 / T044 / T064 (manual walkthroughs)** — the automated gates (`ng test`, `ng build`) were
   run for each story, but `quickstart.md` cannot be executed: the gateway at `http://localhost:5137` is
   down and no seeded data exists. Those rows must be re-run before the feature is called done.
7. **Context7** — unavailable (quota exceeded) during planning; API verification was done against the
   installed Angular 21.2.26 typings, as recorded in `research.md` R-0.

### Verification

- `npx ng test --watch=false` — **38 spec files / 294 tests passing** (baseline T005 was 32/244).
- `npx ng build` — green.
- Constitutional scans (T060/T061): no `any` in `features/{doctors,patients,schedule}`, every `.subscribe`
  is bounded by `takeUntilDestroyed` (the rest are test-only `OutputEmitterRef` subscriptions), no
  `@apply`/component stylesheets, all 8 new components `standalone` + `OnPush`, no `I`-prefixed interface,
  and no reference to `DoctorService`, `OfficeService`, `SpecializationService`, `DoctorCreateComponent`,
  `ProfileEditComponent` or `getDoctorStatus` outside the generated clients.

---

## Implementation Notes (2026-11-18)

### Live contract re-check (quickstart §2 preflight)

The local stack was reachable during this run — gateway `5137`, ProfilesAPI `5154`, AppointmentsAPI
`5203`, Keycloak `8080` — so the blocking gates were re-checked against the running services:

| Gate | Evidence | State |
|---|---|---|
| P-1 | `GET http://localhost:5154/api/Doctors/account/{id}` → **404** (while `/api/Doctors` → 401, i.e. routing works); the endpoint is still absent from the ProfilesAPI Swagger | open |
| P-4 | `/api/Schedule/doctor/{doctorId}` and `/api/Schedule/patient/{patientId}/history` still declare only `200: { description: "OK" }`; the generated methods remain `Observable<void>` | open |
| P-5 | `/api/appointments/{appointmentId}/results` still declares only `200: { description: "OK" }`; generated method remains `Observable<void>` | open |
| P-6 | no documents operation in any generated client | open, deferred |

No generator was re-run in this session: the checked-in clients already match their augment overlays, and
regenerating against a live backend with untyped responses would only reshuffle files without clearing
P-1/P-4/P-5. US2 therefore stays blocked and T046–T058 remain unchecked.

### T045 — shared tabs spec (shipped early)

`app-tabs.component.spec.ts` was added even though it belongs to the US2 test group: it covers the shared
primitive only and needs no backend. Writing it exposed three real defects in `AppTabsComponent`, now fixed:

1. `withHomeAndEnd()` was never called, so `Home`/`End` did nothing (CDK disables them by default).
2. `setActiveItem()` at init focused the first tab on page load, stealing focus. The manager is now seeded
   with `updateActiveItem()` (no focus, no change emission).
3. A mouse click did not move the key manager, so the next arrow key continued from the previously active
   tab. `select()` and an `effect` now keep `updateActiveItem()` aligned with `activeId`.

`aria-orientation="horizontal"` was added to the tablist. The spec asserts roles, `aria-selected`, roving
`tabindex`, arrow/Home/End navigation, one emission per activation, `aria-controls`/`aria-labelledby`
pairing, and navigation continuing after a mouse selection.

### T062 — accessibility and responsive pass

Verified in code and covered where automatable:

- Dialog focus trap/restoration: CDK `Dialog` with `disableClose`, `restoreFocus: true`, `ariaLabel`
  (create dialog) / `ariaLabelledBy` (cancel confirmations). Cancel dialogs keep `disableClose: true`.
- Combobox wiring: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`,
  `aria-describedby`, `aria-invalid`, plus the new `required` input → `aria-required`. Labels are bound to
  the rendered input ids (`specialization-input`, `doctor-filter-name`).
- Table: each status `<select>` has `aria-label="Status for <full name>"` and `aria-busy` while saving;
  the table has a `sr-only` caption and `scope="col"` headers; the scroll container keeps 375 px usable.
- Errors: every field error keeps its `aria-describedby` target; form-level and load errors use
  `role="alert"`, loading uses `role="status"` + `aria-live="polite"`.
- Required fields now expose native `required` (email only in create mode, because the edit-mode email is
  read-only and must not block a save) and the `*` markers are `aria-hidden`.
- 375 px: form grids collapse to one column, the footer stacks actions, the filter panel goes single
  column, and the create dialog is now opened with `width: min(48rem, calc(100vw - 2rem))`,
  `maxHeight: 90vh` and an internal scroll area so `Confirm`/`Cancel` stay reachable.

The patient-profile page could not be reviewed at 375 px because US2 is blocked. A visual browser
spot-check of the four existing screens is still recommended, but the structural requirements are met.

### Verification (2026-11-18)

- `npx ng test --watch=false` — **39 spec files / 302 tests passing**.
- `npx ng build` — green; initial bundle **331.69 kB** (unchanged budgets).
- T064 was not executed: it needs a signed-in browser session plus §7, which depends on the open gates.
