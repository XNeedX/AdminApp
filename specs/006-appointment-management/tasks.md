# Tasks: Appointment Management

**Input**: Design documents from `/specs/006-appointment-management/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: The feature spec does not mandate TDD, but `plan.md` (D9), `contracts/` and `quickstart.md` define the required test suites. Test tasks are therefore included and follow the project's `*.spec.ts` + Vitest convention.

**Organization**: Tasks are grouped by user story. Every story is independently implementable and testable after the Foundational phase.

## Blocking Gates

| Gate | Blocks | Notes |
|---|---|---|
| **P-1** generated appointments client | T002–T004, all US tasks | No hand-written HTTP; regenerate only |
| **P-2** patient search endpoint | T018, US1 patient combobox | Backend gap; cannot be worked around |
| **P-3** doctor status/office source | T015, US1 cascade | ProfilesAPI doctor table is authoritative |
| **P-4** slot duration from service category | T023, US1 slots | Render server slots/end times; do not compute 20 minutes |
| **P-5** specialization↔service mapping | T015 | Assembled from ServicesAPI specialization details |
| **P-6** reschedule | T035, T040 | Render disabled with tooltip |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `US1` create, `US2` list, `US3` approve, `US4` cancel
- All paths are relative to the repository root and target `AdminApp/` only

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Generate the typed API clients and create the feature skeleton. No UI behavior yet.

- [X] T001 Create the feature directory skeleton: `AdminApp/src/app/features/appointments/{models,services,components,pages}` and `AdminApp/src/app/features/appointments/components/{appointment-create-modal,appointment-filters,appointment-table,appointment-status-badge}`, with `pages/appointments-page`
- [X] T002 Create `AdminApp/scripts/augment-appointments-openapi.mjs`: download `http://localhost:<gateway>/appointments/swagger/v1/swagger.json` (accept a local file path argument), add `ApiResponse` / `ApiResponseOf…` envelope schemas for `ViewAppointmentListDTO`, `CreateAppointmentDTO`, `GetAppointmentsFilterDTO`, `ApiResponseOfIEnumerableOfViewAppointmentListDTO`, `ApiResponseOfIEnumerableOfString`, `Doctor`, `Office`, `Service`, `Specialization`, name the `Status` enum (`Active`, `Inactive`) and `ServiceCategory` enum (`Analyses`, `Consultations`, `Diagnostics`), strip the `/api` prefix from every path, and write `AdminApp/openapi/appointments.openapi.json`
- [X] T003 [P] Add `AdminApp/ng-openapi-gen.appointments.json` (`input: "openapi/appointments.openapi.json"`, `output: "src/app/api/generated/appointments"`, `enumStyle: "pascal"`, `services: true`, `promises: false`, `module: false`, `indexFile: true`, `removeStaleFiles: true`) and an `api:appointments` script in `AdminApp/package.json`; run it and verify `src/app/api/generated/appointments/services/appointments.service.ts` and `schedule.service.ts` exist
- [X] T004 [P] Create `AdminApp/src/app/api/appointments-api.provider.ts` exporting `provideAppointmentsApiConfiguration()` using `provideApiConfiguration(\`${environment.apiUrl}/appointments\`)`, and register it in `AdminApp/src/app/app.config.ts`
- [X] T005 [P] Create `AdminApp/scripts/augment-profiles-openapi.mjs` + `AdminApp/openapi/profiles.openapi.json` + `AdminApp/ng-openapi-gen.profiles.json` to generate `src/app/api/generated/profiles` from the Gateway `/profiles/swagger/v1/swagger.json`; verify generated `doctors.service.ts` exposes `GET /Doctors/doctors` and `patients.service.ts` exposes the by-id/account operations (search is added by T018)
- [X] T006 [P] Create `AdminApp/src/app/api/profiles-api.provider.ts` exporting `provideProfilesApiConfiguration()` with `rootUrl = \`${environment.apiUrl}/profiles\``, and register it in `AdminApp/src/app/app.config.ts`
- [X] T007 Verify `npm run build` passes with both generated clients and confirm that no file under `AdminApp/src/app/api/generated/**` was edited manually

**Checkpoint**: Typed clients compile; the feature can start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared primitives, models, catalog loading, and routing that every story relies on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 [P] Create the envelope helper `AdminApp/src/app/api/api-envelope.ts` with `interface ApiEnvelope<T> { isSuccess: boolean; message: string | null; errors: readonly string[]; data: T | null }`, `readApiEnvelope<T>(payload: unknown, guard: (value: unknown) => value is T): T`, and `class ApiContractError extends Error`; it MUST accept `unknown`, never use `any`, and throw `ApiContractError` when the envelope or `data` fails the guard
- [X] T009 [P] Create `AdminApp/src/app/features/appointments/models/appointment-catalog.model.ts` with `PatientOption` (`id`, `fullName`, `phoneNumber`), `SpecializationOption` (`id`, `name`), `ServiceOption` (`id`, `name`, `specializationId`), `DoctorOption` (`id`, `firstName`, `lastName`, `middleName: string | null`, `fullName`, `specializationId`, `specializationName`, `officeId: string | null`, `officeAddress: string | null`, `status`), `OfficeOption` (`id`, `address`, `displayName`), and `AppointmentCatalogs`
- [X] T010 [P] Create `AdminApp/src/app/features/appointments/models/appointment.model.ts` with `AppointmentRow` (`id`, `startTime`, `endTime`, `timeRangeLabel`, `doctorFullName`, `patientFullName`, `patientPhoneNumber`, `serviceName`, `isApproved`, `officeId`, `isApproving`, `isDeleting`) and `AdminApp/src/app/features/appointments/models/appointment-filter.model.ts` with `AppointmentStatusFilter = 'all' | 'approved' | 'notApproved'` and `AppointmentFilterState` (`date` default today, `doctorId`, `serviceId`, `status` default `'all'`, `officeId`, `hasGenerated`), all fields `readonly`
- [X] T011 [P] Create `AdminApp/src/app/features/appointments/models/appointment-form.model.ts` with `AppointmentFormGroup` (`patientId`, `patientText`, `specializationId`, `specializationText`, `doctorId`, `doctorText`, `serviceId`, `serviceText`, `officeId`, `date`, `timeSlot` as non-nullable `FormControl<string>`), `AppointmentFormField`, `AppointmentFormValue`, `CascadeInput`, `CascadePlan`, and `CascadeWrite` exactly as defined in `data-model.md` §2–§3
- [X] T012 [P] Create `AdminApp/src/app/shared/components/app-dialog/app-dialog.component.ts` + `.html`: standalone, `OnPush`, Tailwind panel with `title`, `subtitle`, `showClose`, `closeLabel` signal inputs, `close` output, header/content/footer slots (`[dialogFooter]`), `role="dialog"`, `aria-modal="true"`, `max-h-[90vh]` scrolling, no component stylesheet and no `@apply`
- [X] T013 [P] Create `AdminApp/src/app/shared/components/app-dialog/app-dialog.service.ts` wrapping `@angular/cdk/dialog`: `openCreateAppointment()`, `confirmExit()`, `confirmCancelAppointment()`, `openPatientCreation()`; use `autoFocus: 'first-tabbable'`, `restoreFocus: true`, `ariaLabelledBy`, `disableClose: true` for confirmations; exit/cancel dialogs resolve `false` on Escape/backdrop and MUST render the exact messages `Do you really want to exit? Appointment will not be saved.` and `Do you really want to cancel the appointment? It will be permanently deleted.` with `Yes`/`No` — deviation: only `confirm()`, `confirmExit()` and `confirmCancelAppointment()` exist; the create modal is rendered inline and patient creation is blocked by **P-2**, so `openCreateAppointment()`/`openPatientCreation()` were deliberately not added.
- [X] T014 [P] Create `AdminApp/src/app/shared/components/app-combobox/app-combobox.component.ts` + `.html`: standalone, `OnPush`, `ControlValueAccessor` for the visible text, signal inputs `inputId`, `options` (required), `placeholder`, `invalid`, `describedBy`, `disabled`, `emptyText` (default `No matches`), outputs `optionSelected`, `textChange`, `blurred`; render the suggestion panel in a CDK overlay connected to the input with `matchWidth`, `reposition`, `closeOnScroll`, `hasBackdrop: false`; implement ArrowUp/Down, Home/End, Enter, Escape and `aria-expanded` / `aria-controls` / `aria-activedescendant` / `role="option"` / `aria-selected`
- [X] T015 [P] Create `AdminApp/src/app/shared/components/app-date-field/app-date-field.component.ts` + `.html`: standalone, `OnPush`, native `input[type=date]`, inputs `id`, `label`, `value`, `disabled`, `invalid`, `min`, `max`, `describedBy`, output `valueChange`; Tailwind utilities only
- [X] T016 Create `AdminApp/src/app/features/appointments/services/appointment-catalog.service.ts`: load in parallel via generated clients — active offices from the appointments `OfficesService`; doctors from generated profiles `DoctorsService.GetDoctorsForReceptionist` keeping only `status === 'At work'`; specializations from generated services `SpecializationService`; services by loading each specialization's `GET /Specialization/{id}` details and flattening `services[]` where `status === Active` with the parent `specializationId`; resolve `DoctorOption.officeId` by normalized `officeAddress` → office `address` (case-insensitive, trimmed), leaving `null` on no match; cache the assembled catalogs for the session and expose reload-on-failure
- [X] T017 [P] Create `AdminApp/src/app/features/appointments/services/appointment-sort.ts` with `sortAppointments(rows: readonly AppointmentRow[]): readonly AppointmentRow[]` using one shared `Intl.Collator(undefined, { sensitivity: 'base' })` and ascending order: `startTime` → doctor surname (first token of `doctorFullName`) → doctor first name (second token) → `serviceName`; the sort MUST be stable for full ties
- [ ] T018 [P] **BLOCKED (P-2)** Extend `AdminApp/src/app/features/appointments/services/appointment-catalog.service.ts` with `searchPatients(query: string): Observable<readonly PatientOption[]>` calling the generated profiles `PatientsService` search operation (`GET /Patients?search=&page=1&pageSize=20`), debounced 250 ms by the caller; do not implement until the backend endpoint exists and the client is regenerated — still blocked: the backend exposes no patient search/list operation. `AppointmentCatalogService.load()` returns `patients: []` and the combobox renders an explicit "not available yet" state; no fake patient source was introduced.
- [X] T019 Register the feature route in `AdminApp/src/app/app.routes.ts` (`path: 'appointments'`, `canActivate: [authGuard, roleGuard('Receptionist')]`, lazy `loadComponent` of the page) and add the `Appointments` nav item for Receptionists in `AdminApp/src/app/shared/layout/app-header/app-header.component.ts` — deviation: the app renders navigation from `AdminApp/src/app/app.ts`, so the guarded item lives there. `authGuard` is applied by the parent route.


**Checkpoint**: Foundation ready — US1–US4 can proceed in parallel where files do not overlap.

---

## Phase 3: User Story 1 - Create an appointment (Priority: P1) — MVP

**Goal**: A Receptionist opens the creation modal, builds a consistent patient/doctor/service/office/date/slot combination through the cascade, and stores a `Not Approved` appointment.

**Independent Test**: Sign in as a Receptionist, click "Create an appointment", verify all fields and buttons, verify date/slots are disabled, verify "Confirm" is disabled, complete a valid combination, confirm, and verify the appointment is stored; then verify the "x" dialog with both answers.

### Tests for User Story 1

- [X] T020 [P] [US1] Write `AdminApp/src/app/features/appointments/services/appointment-cascade.spec.ts` covering the full matrix in `contracts/appointment-cascade.md` §8: doctor→specialization/office auto-fill, service→specialization, office conflict clears doctor, service conflict clears doctor, clearing specialization clears date+slot, one remaining doctor auto-fills, zero remaining doctors clears doctor, idempotence (zero writes), deactivated catalog record clears selection, and every option list contains only active/at-work entries; tests MUST fail before T022
- [X] T021 [P] [US1] Write `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.spec.ts` covering: all fields/buttons rendered (AC-2), empty initial state with disabled date/slots and Confirm (AC-3), `Please, choose the patient` and `Invalid patient name` messages (FR-011), date+slots enabled only when specialization **and** service are set (AC-9/12), exit dialog exact text and `No` preserving values (AC-5/7/8), and failed creation keeping the modal open with values

### Implementation for User Story 1

- [X] T022 [US1] Implement `reduceAppointmentCascade` and the option selectors in `AdminApp/src/app/features/appointments/services/appointment-cascade.ts` exactly per `contracts/appointment-cascade.md`: fixed filter order doctor → service → specialization → office, auto-fill A1–A4, clears C1–C10 applied before auto-fills, never emit a write for `lastEditedField`, `dateEnabled = specializationId && serviceId`, `slotsEnabled = dateEnabled && date !== ''`, `isComplete` per §7
- [X] T023 [US1] Create `AdminApp/src/app/features/appointments/services/appointment-form.store.ts`: build the typed `FormGroup`; bridge `form.valueChanges` with `toSignal(form.valueChanges, { initialValue: form.getRawValue() })`; hold `catalogs`, `selected`, `lastEditedField`, `availableDoctors`, `isSubmitting`; expose `cascade = computed(...)`; apply `autoFill`/`clear` in a single `effect()` with `{ emitEvent: false }`, value-equality guards, and `markAsDirty()`; no `.subscribe()`; expose `confirmEnabled = computed(() => form.valid && cascade().isComplete && !isSubmitting())` and per-field error messages — deviation: no `markAsDirty()` call; internal writes use `emitEvent: false` and touch state is tracked separately, so dirty state is not needed.

- [X] T024 [P] [US1] Create `AdminApp/src/app/features/appointments/services/appointment-availability.service.ts`: `getSlots(doctorId, serviceId, date)` calling generated `ScheduleService` `available-time-slots`, `getDoctorAvailability(doctorIds, serviceId, date, slot)` probing candidates with `forkJoin`, a `Map` cache keyed `doctorId|serviceId|date` (30 s TTL) and `doctorId|serviceId|date|slot`, debounce 250 ms at the caller, and cancellation of stale requests; slot labels are the server `HH:mm` strings — no client-side duration arithmetic (P-4)
- [X] T025 [US1] Implement `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts`: smart container with `created`/`closed` outputs, `AppointmentFormStore`, catalog loading, patient/specialization/doctor/service comboboxes, office dropdown, date field, slot buttons, "Create patient", "Confirm", "x"; typing asserts the selected id (`catalogMatchValidator` semantics) and blur marks touched; "x" always opens the exit dialog (FR-022)
- [X] T026 [US1] Create `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.html`: Tailwind layout with `app-dialog`, two-column `md:grid-cols-2`, inline error text linked via `aria-describedby`, `aria-invalid`, disabled states from `cascade()`, slots rendered as an ascending button grid with `aria-pressed`, and the footer actions "Create patient" / "Confirm"
- [X] T027 [US1] Wire "Create patient" and the exit dialog in `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts` using `AppDialogService.openPatientCreation()` and `confirmExit()`: on patient creation success push the patient into the catalog and select it while preserving all other values (FR-017); on dismiss preserve values with no patient (FR-018); on exit `true` emit `closed` without saving — deviation: **P-2** blocks patient creation, so "Create patient" is rendered disabled with an explanatory tooltip; the exit dialog and value preservation are implemented.

- [X] T028 [US1] Create `AdminApp/src/app/features/appointments/services/appointments-facade.service.ts` with `createAppointment(payload)` calling the generated `AppointmentsService` `POST /Appointments/{patientId}` with `{ doctorId, serviceId, officeId, date, timeSlot }`; guard against duplicate submission; map `400 "The selected time slot is invalid."` to a slot-conflict result (reload slots, message above slots), `403` inactive patient to clearing the patient field, and other failures to `NotificationService.showError`; never inspect transport details outside this file
- [X] T029 [US1] Create the minimal `AdminApp/src/app/features/appointments/pages/appointments-page/appointments-page.component.ts` + `.html`: page shell with the "Create an appointment" button, `isCreateOpen` signal, modal host, and `onAppointmentCreated()` hook (list refresh arrives in US2); standalone, `OnPush`, Tailwind
- [ ] T030 [US1] Run `npm test -- appointment-cascade appointment-create-modal` in `AdminApp/` and fix `AdminApp/src/app/features/appointments/services/appointment-cascade.spec.ts` + `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.spec.ts` until T020/T021 pass; verify AC-1–AC-13 and FR-001–FR-037 manually using `specs/006-appointment-management/quickstart.md` S1–S4 — automated part done: both specs are green and the full suite reports 230/230 passing; the manual AC/quickstart walk-through remains pending a running backend.


**Checkpoint**: US1 is a demoable MVP — appointments can be created and appear in the store.

---

## Phase 4: User Story 2 - View the appointment list (Priority: P2)

**Goal**: A Receptionist generates a filtered, correctly ordered table for a date and sees time, doctor, patient, phone, service, and row actions.

**Independent Test**: Open `/appointments`, verify filters + "Generate" + "Create an appointment" without a table, generate, verify columns/actions/order, then exercise each filter and a combined set and confirm date changes reload automatically.

### Tests for User Story 2

- [X] T031 [P] [US2] Write `AdminApp/src/app/features/appointments/services/appointment-filters.spec.ts`: `status: 'all'` omits `isApproved`; `approved` → `true`; `notApproved` → `false`; `DoctorName` receives the selected doctor's surname; `ServiceName` receives the exact service name; `OfficeId` only when set; `Date` serialized as `yyyy-MM-dd`; exact full-name refinement keeps only the selected doctor's rows
- [X] T032 [P] [US2] Write `AdminApp/src/app/features/appointments/services/appointment-sort.spec.ts`: ordering by time, then surname, then first name, then service; equal-time rows; same doctor/different service; accent/case-insensitive comparison; stability on full ties
- [X] T033 [P] [US2] Write `AdminApp/src/app/features/appointments/components/appointment-table/appointment-table.component.spec.ts`: column headers, `11:00 - 11:20` label, action buttons per row, `Reschedule` disabled with tooltip, empty states (not generated vs. no matches), approved highlight and disabled `Approve`

### Implementation for User Story 2

- [X] T034 [P] [US2] Create `AdminApp/src/app/features/appointments/services/appointment-filters.service.ts`: `toParams(state: AppointmentFilterState): GetAppointmentsFilterDto` per T031 and `refineByExactDoctor(rows, doctor: DoctorOption | null)` comparing `doctorFullName` to `${lastName} ${firstName} ${middleName ?? ''}`.trim() with a base-sensitivity collator
- [X] T035 [P] [US2] Create `AdminApp/src/app/features/appointments/components/appointment-table/appointment-table.component.ts` + `.html` and `AdminApp/src/app/features/appointments/components/appointment-status-badge/appointment-status-badge.component.ts` + `.html`: native `<table>` inside `overflow-x-auto`, sticky header, `@for (row of rows(); track row.id)`, columns Time/Doctor/Patient/Phone/Service/Actions, `aria-sort` reflecting the fixed ordering, `Approve`/`Cancel`/`Reschedule` buttons with descriptive `aria-label`, approved row `bg-emerald-50`, empty/loading/error states, no business logic
- [X] T036 [P] [US2] Create `AdminApp/src/app/features/appointments/components/appointment-filters/appointment-filters.component.ts` + `.html`: date (default today), doctor combobox (`app-combobox`), service combobox, status select with exactly `Approved` / `Not Approved` / `All` (default `All`), office select, `Generate`, `Create an appointment`; emits `generate`, `filterChange`, `dateChange`, `createRequested` and never mutates its input state
- [X] T037 [US2] Extend `AdminApp/src/app/features/appointments/services/appointments-facade.service.ts` with `loadAppointments(filter)`: call generated `AppointmentsService` list operation, `readApiEnvelope`, map `ViewAppointmentListDto` → `AppointmentRow` (time range label in clinic local time), refine by exact doctor, `sortAppointments`, expose `rows`/`isLoading`/`loadError` signals, keep previous rows on failure and report via `NotificationService`; ignore stale responses using a request sequence number
- [X] T038 [US2] Extend `AppointmentsPageComponent` (`AdminApp/src/app/features/appointments/pages/appointments-page/`) with filter state, `onGenerate()` (sets `hasGenerated`), date-change auto-reload only when generated, other-filter refresh, create-modal refresh on new appointment, and wiring of filters/table inputs and outputs
- [X] T039 [US2] Write `AdminApp/src/app/features/appointments/pages/appointments-page/appointments-page.component.spec.ts`: table hidden before Generate, shown after, date reload without Generate, combined filters forwarded, stale response ignored, load failure keeps rows and notifies; then run `npm test` and the quickstart S5–S6 scenarios

**Checkpoint**: US1 and US2 work independently — creation plus a correct, filterable list.

---

## Phase 5: User Story 3 - Approve an appointment (Priority: P3)

**Goal**: One click approves a pending appointment, highlights the row, disables further approval, and persists.

**Independent Test**: Generate a list with a pending row, approve it, verify status/highlight/disabled button, reload, and verify persistence; simulate a failure and verify rollback.

### Tests for User Story 3

- [X] T040 [P] [US3] Write `AdminApp/src/app/features/appointments/services/appointments-facade.approve.spec.ts`: optimistic flag set, row highlight state, `isApproving` guard against double submission, success notification, revert + error notification on failure, no reordering after approval, `409 AlreadyApproved` surfaced as a refresh-and-notify path

### Implementation for User Story 3

- [X] T041 [US3] Add `approveAppointment(row)` to `AdminApp/src/app/features/appointments/services/appointments-facade.service.ts`: call generated `AppointmentsService` `PATCH /Appointments/{id}/approve`; optimistically set `isApproved = true`; on error revert and notify; keep a per-row in-flight set; do not re-sort unless values changed
- [X] T042 [US3] Wire approval in `AdminApp/src/app/features/appointments/pages/appointments-page/appointments-page.component.ts` (`onApprove(row)`) and `AdminApp/src/app/features/appointments/components/appointment-table/appointment-table.component.ts` so `Approve` is disabled for approved/in-flight rows with the approved highlight applied; approved rows MUST keep their sorted position
- [ ] T043 [US3] Run `npm test` in `AdminApp/` for `AdminApp/src/app/features/appointments/services/appointments-facade.approve.spec.ts` and validate `specs/006-appointment-management/quickstart.md` S7, including reload persistence and forced-failure rollback — spec is green (including the 409 refresh-and-notify path); the quickstart S7 walk-through remains pending a running backend.


**Checkpoint**: Approval works while US1/US2 remain unchanged.

---

## Phase 6: User Story 4 - Cancel an appointment (Priority: P4)

**Goal**: A confirmed cancellation permanently deletes the appointment and removes its row; declining leaves the table untouched.

**Independent Test**: Click Cancel, verify the exact dialog, choose No (row stays), then Yes (row disappears and does not return after reload); cancel the last row and verify the empty state.

### Tests for User Story 4

- [X] T044 [P] [US4] Write `AdminApp/src/app/features/appointments/services/appointments-facade.cancel.spec.ts`: delete calls generated `DELETE /Appointments/{id}`, row removed only on success, unchanged on `No`, `isDeleting` prevents double submission, failure keeps the row with its prior data and notifies, empty state after the last row, approved rows cancellable

### Implementation for User Story 4

- [X] T045 [US4] Add `cancelAppointment(row)` to `AppointmentsFacadeService` (`AdminApp/src/app/features/appointments/services/appointments-facade.service.ts`) with the generated delete operation, per-row `isDeleting`, success notification, failure handling, and empty-state derivation
- [X] T046 [US4] Wire cancellation in `AdminApp/src/app/features/appointments/pages/appointments-page/appointments-page.component.ts`: open `AppDialogService.confirmCancelAppointment()` on `onCancel(row)`, delete only on `true`, leave the table untouched on `false`, and show the empty state when the last row is removed
- [ ] T047 [US4] Run `npm test` in `AdminApp/` for `AdminApp/src/app/features/appointments/services/appointments-facade.cancel.spec.ts` and validate `specs/006-appointment-management/quickstart.md` S8, including the approved-appointment case and the last-row empty state — spec is green; the quickstart S8 walk-through remains pending a running backend.


**Checkpoint**: All four stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, responsiveness, resilience, and end-to-end validation across stories.

- [X] T048 [P] Accessibility pass across `AdminApp/src/app/features/appointments/**` and the new shared primitives: labeled controls, `aria-invalid`/`aria-describedby` on every error, dialog focus trap/restore, keyboard-only operation of comboboxes and dialogs, descriptive row-action labels, no focus loss after approve/delete
- [X] T049 [P] Responsive pass across `AdminApp/src/app/features/appointments/pages/appointments-page/appointments-page.component.html`, `AdminApp/src/app/features/appointments/components/**/*.html`, and `AdminApp/src/app/shared/components/app-dialog/app-dialog.component.html`: filters stack on mobile (`sm:`/`md:`/`lg:`), table scrolls horizontally, modal and dialogs use `max-h-[90vh]` with internal scrolling, slot grid wraps at `sm:`; no fixed widths that clip at 360 px
- [X] T050 [P] Resilience review in `AdminApp/src/app/features/appointments/services/**`: stale-response guards, debounce/cancellation for slots and patient search, cache TTLs, duplicate-submission guards, and `ApiContractError` handling with generic user messaging and no PII logging
- [X] T051 [P] Performance review in `AdminApp/src/app/features/appointments/services/appointment-sort.ts`, `AdminApp/src/app/features/appointments/services/appointment-form.store.ts`, and `AdminApp/src/app/features/appointments/components/appointment-table/appointment-table.component.html`: shared `Intl.Collator`, `track row.id`, `computed` reuse instead of recomputing option sets per render, and no redundant catalog reloads when reopening the modal; confirm a 300-row day generates within 2 seconds
- [X] T052 Run `npm run build` and the full `npm test` suite in `AdminApp/`; fix any regression introduced across `AdminApp/src/app/features/appointments/**`, `AdminApp/src/app/shared/components/**`, and `AdminApp/src/app/api/**`
- [ ] T053 Execute quickstart S1–S10 end to end (`specs/006-appointment-management/quickstart.md`) and record any deviation caused by gates P-1–P-6 in the same file — cannot be executed without a running backend; the known gate deviations are recorded in `quickstart.md` under "Deviations caused by gates".

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately; T002–T004 are strictly ordered (overlay → generator → provider); T005–T006 are parallel to them
- **Foundational (Phase 2)**: depends on T003/T005 generation and T001 skeleton; **blocks all stories**
- **US1 (Phase 3)**: depends on Foundational; no dependency on US2–US4
- **US2 (Phase 4)**: depends on Foundational; the page/modal created in US1 is reused, so T035/T037/T038 are best done after US1
- **US3 (Phase 5)**: depends on US2 (table + facade list)
- **US4 (Phase 6)**: depends on US2 (table + facade list); independent of US3
- **Polish (Phase 7)**: depends on all delivered stories

### Story Dependencies

| Story | Depends on | Independent test |
|---|---|---|
| US1 (P1) | Foundational, P-1, P-2, P-3, P-4 | Modal + store + cascade only; no list required |
| US2 (P2) | Foundational, P-1, US1 page shell | Filters + table + sorting with seeded appointments |
| US3 (P3) | US2 (rows exist) | Approve one generated row, reload |
| US4 (P4) | US2 (rows exist) | Cancel one generated row, reload |

### Within Each Story

- Tests before implementation (T020/T021 → T022+, T031–T033 → T034+, T040 → T041, T044 → T045)
- Models → pure functions → store/service → component → page wiring → tests green

### Blocking Gates Inside the Backlog

- T018 cannot start until the patient search endpoint exists (**P-2**)
- T016 relies on ProfilesAPI status/office (**P-3**) and ServicesAPI specialization details (**P-5**)
- T024/T025 must use server-provided slots and end times (**P-4**)
- T035/T042 must keep `Reschedule` disabled (**P-6**)

---

## Parallel Examples

### User Story 1

```text
# Tests (different files):
T020 appointment-cascade.spec.ts
T021 appointment-create-modal.component.spec.ts

# After T022/T023:
T024 appointment-availability.service.ts   (independent service)
T026 appointment-create-modal.component.html (independent template)
```

### User Story 2

```text
T031 appointment-filters.spec.ts
T032 appointment-sort.spec.ts
T033 appointment-table.component.spec.ts
# then, in parallel:
T034 appointment-filters.service.ts
T035 appointment-table + status badge components
T036 appointment-filters component
```

### User Story 3 / User Story 4

```text
US3: T040 (spec) → T041 (facade) → T042 (page/table wiring) → T043
US4: T044 (spec) → T045 (facade) → T046 (page wiring) → T047
Different developers can run US3 and US4 in parallel after T037.
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (client generation is unavoidable — P-1).
2. Complete Phase 2 (shared primitives, catalogs, models, route).
3. Complete Phase 3 (US1 create modal + cascade + create call).
4. **STOP and VALIDATE** with quickstart S1–S4.
5. Demo without the list, if needed.

### Incremental Delivery

1. Setup + Foundational → typed clients and primitives.
2. US1 → creation works (MVP).
3. US2 → daily list with filters and correct ordering.
4. US3 → approval.
5. US4 → cancellation.
6. Polish → accessibility, responsiveness, performance, full quickstart.

### Parallel Team Strategy

- One developer completes Phase 1 (generated clients) — it is the hard gate.
- After Phase 2, US1 and US2 can split (different files) if the page shell is merged first.
- After US2, one developer takes US3 and another US4 (different facade methods, different page handlers) — coordinate the shared `appointments-facade.service.ts` and page file to avoid merge conflicts.

---

## Notes

- `[P]` means different files with no incomplete-task dependency.
- Every task is scoped to `AdminApp/`; backend files are read-only.
- No task permits hand-written HTTP clients, DTOs, or `any`.
- Commit after each task or logical group; stop at checkpoints to validate a story independently.
- If P-2 is still open at US1 time, deliver the create modal without the patient combobox and keep T018 blocked — do not fake a patient source.
