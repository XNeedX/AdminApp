# Tasks: Specialization Management

**Input**: Design documents from `/specs/008-specialization-management/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included. The feature specification does not mandate TDD, but `plan.md` ("Testing
strategy"), `contracts/ui-contracts.md` and `quickstart.md` (Definition of Done) commit to the
suites listed below, and every existing feature in this repo ships `.spec.ts` files next to its
components. Tests are therefore delivery tasks, not optional extras.

**Organization**: Tasks are grouped by user story (US1-US5) so each story can be implemented,
tested and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (`US1`-`US5`); omitted for Setup/Foundational/Polish
- All paths are relative to the repository root (`Frontend/AdminApp/`); the Angular source root is `AdminApp/src/`

## Path Conventions

Angular SPA. All feature code lives under `AdminApp/src/app/features/specializations/`; only two
files outside that tree change (`AdminApp/src/app/app.routes.ts`, `AdminApp/src/app/app.ts`).

---

## Contract Gates (read before starting)

`plan.md` records four backend-contract gaps. They are not worked around with hand-written HTTP code.

- **G-1** - specialization create/edit payload still requires `price` + `category`; the spec defines
  only `name` + `status`. Blocks US2/US4.
- **G-2** - `specializationPost` is generated as `void`; the created id is needed to append services.
  Blocks US2 attach step.
- **G-3** - PUT/PATCH specialization declare no success response (cosmetic).
- **G-4** - backend cascade from specialization status to services/doctors is absent. Blocks the
  end-to-end check of US5 AC-2; the frontend behaviour is still complete.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the feature's file skeleton and verify the generated contract before writing code.

- [X] T001 Create the feature folder tree `AdminApp/src/app/features/specializations/` with subfolders `models`, `components/specialization-table`, `components/specialization-form`, `dialogs/specialization-create-dialog`, `pages/specializations-page`, `pages/specialization-info`, `services`, `utils`, per `plan.md` Project Structure
- [X] T002 [P] Read-only verification of the generated client in `AdminApp/src/app/api/generated/services/`: confirm `SpecializationService.specializationGet`, `specializationIdGet`, `specializationPost`, `specializationIdPut`, `specializationIdStatusPatch` and `ServiceService.servicePost`, `serviceIdPut` exist with the signatures listed in `contracts/services-api.contract.md`; confirm generated `CreateSpecializationCommand` still carries `price`/`category` (gate G-1) and `specializationPost` returns `void` (gate G-2). Do not edit generated files

**Checkpoint**: Skeleton exists and the contract gaps are confirmed against the installed client.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared models, routes and navigation required by every user story.

**CRITICAL**: No user story work can begin until T003-T007 complete.

- [X] T003 [P] Extend `AdminApp/scripts/augment-services-openapi.mjs` to declare the missing specialization command responses - `POST /api/Specialization` -> `201` with `ApiResponseOfGuid`, `PUT /api/Specialization/{id}` -> `204`, `PATCH /api/Specialization/{id}/status` -> `204` - then run `npm run api:services` from `AdminApp/` (closes G-2/G-3). Do not hand-edit `src/app/api/generated/`
- [X] T004 [P] Create `AdminApp/src/app/features/specializations/models/specialization.model.ts`: `SpecializationStatus = 'Active' | 'Inactive'`, `ServiceCategory = 'Analyses' | 'Consultations' | 'Diagnostics'`, `SpecializationListRow`, `SpecializationServiceRow` (`id`, `name`, `price`, `status`, `category`), `SpecializationView`; exhaustive `toSpecializationStatus`/`toServiceCategory`/`fromSpecializationStatus`/`fromServiceCategory` that throw on unknown numeric values; `toSpecializationListRows` and `toSpecializationView` that reject a missing `id`/`name` and trim stored names
- [X] T005 [P] Create `AdminApp/src/app/features/specializations/models/specialization.model.spec.ts` covering enum mapping both directions, rejection of unknown enum values, rejection of missing `id`/`name`, `services === undefined` mapping to `[]`, and payload mapping of a new service row (`specializationId` included) versus an existing row (no `specializationId`)
- [X] T006 [P] Add the two lazy routes to `AdminApp/src/app/app.routes.ts` inside the authenticated children: `specializations` -> `SpecializationsPageComponent` and `specializations/:id` -> `SpecializationInfoComponent`, each guarded by `roleGuard('Receptionist')`
- [X] T007 [P] Add `{ label: 'Specializations', path: '/specializations' }` to the Receptionist `navItems` in `AdminApp/src/app/app.ts`, after `Services`
- [X] T008 Resolve gate G-1: obtain an explicit decision (backend payload change vs deferred US2/US4) and record it in the Contract Gates table of `specs/008-specialization-management/plan.md`; do not start T015-T026 or T030-T036 while G-1 is unresolved

**Checkpoint**: Foundation ready - list and detail shells can be built; create/edit stay gated on T008.

---

## Phase 3: User Story 1 - View the specializations list (Priority: P1) - MVP

**Goal**: A Receptionist opens "Specializations" and sees every specialization with its name and
Active/Inactive status radios, can open a row, and finds the "Create specialization" entry point.

**Independent Test**: Sign in as a Receptionist, click "Specializations": a table with exactly
"Specialization Name" and "Status" is shown, sorted by name, including Inactive rows; each row's
radios reflect the stored status; "Create specialization" is present; clicking a row navigates to
`/specializations/:id`; an empty catalog and a failed load each show a distinct state.

### Implementation for User Story 1

- [X] T009 [P] [US1] Create the dumb table `AdminApp/src/app/features/specializations/components/specialization-table/specialization-table.component.ts` with `rows: input<readonly SpecializationListRow[]>([])` and `open = output<string>()`, `changeDetection: ChangeDetectionStrategy.OnPush`, `standalone: true`, no injected services; render status as a native Active/Inactive radio pair per row (`[checked]="row.status === option"`, `[disabled]="true"` placeholder until US5) with a unique per-row `name`
- [X] T010 [P] [US1] Create `AdminApp/src/app/features/specializations/components/specialization-table/specialization-table.component.html`: semantic `<table>` with `scope="col"` headers "Specialization Name" and "Status", a horizontally scrollable wrapper for mobile, and a keyboard-reachable name button that emits `open(row.id)`
- [X] T011 [US1] Implement `AdminApp/src/app/features/specializations/pages/specializations-page/specializations-page.component.ts`: inject `SpecializationService`, `Router`, `Dialog`, `NotificationService`, `DestroyRef`; `rows`, `isLoading`, `loadError`, `isEmpty` signals; `load()`/`retry()` calling `specializationGet({ Page: 1, PageSize: 200 })`; validate the envelope, map with `toSpecializationListRows`, sort case-insensitively by name (FR-009), and guard against stale responses with a request id
- [X] T012 [US1] Create `AdminApp/src/app/features/specializations/pages/specializations-page/specializations-page.component.html`: heading, "Create specialization" button (no handler yet), `<app-specialization-table [rows]="rows()" (open)="onOpen($event)" />`, and distinct loading, empty ("No specializations yet."), and retryable error states
- [X] T013 [P] [US1] Create `AdminApp/src/app/features/specializations/components/specialization-table/specialization-table.component.spec.ts`: renders exactly the two columns in order, renders one radio group per row with the stored value checked and labels "Active"/"Inactive", emits `open` with the row id, and keeps row clicks independent from the status cell
- [X] T014 [US1] Create `AdminApp/src/app/features/specializations/pages/specializations-page/specializations-page.component.spec.ts`: loads with `{ Page: 1, PageSize: 200 }`, sorts by name, shows the empty state when `items` is `[]`, shows retryable error on failure and reloads on Retry, ignores an older response arriving after a newer one, and navigates on row activation
- [X] T015 [US1] Run `npx vitest run src/app/features/specializations` and verify US1 scenarios V1 from `quickstart.md`

**Checkpoint**: US1 is independently functional and demoable (MVP).

---

## Phase 4: User Story 2 - Create a specialization (Priority: P2)

**Goal**: The Receptionist creates a specialization with a name, a status, and one or more service
rows in a modal; "Confirm" stays disabled while the name is empty, the table is empty, or a row is
invalid; "Cancel" always confirms.

**Independent Test**: Open the create dialog, verify defaults (status "Active", empty table with the
four columns), add rows, trigger every validation message, confirm a valid form and see the new
specialization in the list, then verify the cancel dialog "No" keeps data and "Yes" saves nothing.

**Depends on**: T008 (gate G-1) and T003 (gate G-2).

### Implementation for User Story 2

- [X] T016 [US2] Create `AdminApp/src/app/features/specializations/models/specialization-form.model.ts` with `ServiceRowControls`, `SpecializationFormControls`, `ServiceRowFormValue`, `SpecializationFormValue`, `SPECIALIZATION_NAME_MAX_LENGTH = 100`, `SERVICE_NAME_MAX_LENGTH = 100`, `SPECIALIZATION_STATUS_OPTIONS`, `SERVICE_CATEGORY_OPTIONS`, `SERVICE_STATUS_OPTIONS`, and factories `createSpecializationForm()` / `createServiceRow(row?)`. Constraints verbatim: specialization name required, trimmed non-empty, at most 100 characters; service name required non-blank; price required, greater than zero, at most two fractional digits; category one of `Analyses`, `Consultations`, `Diagnostics`; status required and defaulting to `Active`
- [X] T017 [US2] Implement the dumb form `AdminApp/src/app/features/specializations/components/specialization-form/specialization-form.component.ts`: `FormGroup<SpecializationFormControls>` with `services: FormArray<FormGroup<ServiceRowControls>>` starting empty; `mode`, `initialValue`, `submitting` inputs; `submitted`/`cancelled` outputs; `addService()` uses `push(createServiceRow())`; `discardRow(index)` uses `removeAt(index)`; `canSubmit` computed returns `form.valid && form.controls.services.length > 0 && !submitting()` fed by a `formRevision` signal updated from `form.valueChanges` (bounded with `takeUntilDestroyed`); validation message accessors expose the exact strings `Please, enter the name`, `Please, enter the price`, `You've entered an invalid price`, `Please, choose the service category`
- [X] T018 [US2] Create `AdminApp/src/app/features/specializations/components/specialization-form/specialization-form.component.html`: name field, Active/Inactive radios, services `<table>` with columns "Service Name", "Price", "Status", "Service Category", per-row discard for rows with `id === null`, "Add service", and footer buttons "Confirm" (`[disabled]="!canSubmit()"`) and "Cancel"; messages appear only after a control is touched, with `aria-invalid` and `aria-describedby`
- [X] T019 [P] [US2] Create `AdminApp/src/app/features/specializations/components/specialization-form/specialization-form.component.spec.ts`: array starts empty and `canSubmit` is false when `length === 0`; `addService` appends a row defaulting to status "Active" with empty name/price and no category; `discardRow` removes it; name `'   '` blocks submit and shows `Please, enter the name` after blur; price `0`, `-1`, `'abc'` produce `You've entered an invalid price`, empty price produces `Please, enter the price`; missing category produces `Please, choose the service category`; a valid form emits a trimmed name and narrowed `price`/`category`
- [X] T020 [US2] Implement the create path of `AdminApp/src/app/features/specializations/services/specialization-writer.service.ts`: inject `SpecializationService` and `ServiceService` only; `WriteSessionState { specializationId: string | null; createdServiceIds: readonly string[] }`; `create(value, state)` calls `specializationPost` when `specializationId === null`, then `servicePost` sequentially per new row passing `specializationId`, skipping rows already recorded in `createdServiceIds`, and returns the updated state; stop on first failure and propagate the error
- [X] T021 [P] [US2] Create `AdminApp/src/app/features/specializations/services/specialization-writer.service.spec.ts` covering the create path: call order (`specializationPost` first, then one `servicePost` per row), `specializationId` forwarded, duplicate-submit produces one post, retry after a mid-sequence failure skips already-created rows and does not re-create the specialization, and the returned session state is accurate
- [X] T022 [US2] Implement the smart dialog `AdminApp/src/app/features/specializations/dialogs/specialization-create-dialog/specialization-create-dialog.component.ts`: inject `DIALOG_DATA`, `DialogRef`, `Dialog`, `SpecializationWriterService`, `NotificationService`, `DestroyRef`; hold `submitting` and `partialNotice` signals and a `WriteSessionState`; on `onSubmit` guard re-entry, call `writer.create`, close with `{ id }` on success, and on failure keep the dialog open with values preserved and the partial state retained; `onCancel` opens `CancelConfirmDialogComponent` with `Do you really want to cancel? Entered data will not be saved.` and closes with `null` only on `true`
- [X] T023 [US2] Create `AdminApp/src/app/features/specializations/dialogs/specialization-create-dialog/specialization-create-dialog.component.html` hosting `<app-specialization-form mode="create" [submitting]="submitting()" (submitted)="onSubmit($event)" (cancelled)="onCancel()" />`, the partial-failure notice, and an accessible dialog title
- [X] T024 [P] [US2] Create `AdminApp/src/app/features/specializations/dialogs/specialization-create-dialog/specialization-create-dialog.component.spec.ts`: Confirm is disabled until valid, double activation performs one create, success closes with `{ id }` and shows `Specialization created successfully`, failure keeps values and allows retry, cancel dialog shows the exact message, "No" keeps the dialog, "Yes" closes with `null`
- [X] T025 [US2] Create `AdminApp/src/app/features/specializations/utils/open-specialization-create-dialog.ts` opening `SpecializationCreateDialogComponent` through CDK `Dialog` with `disableClose: true`, `restoreFocus: true`, `ariaLabelledBy`, returning `Observable<SpecializationCreateDialogResult | null>` (result `null` when cancelled)
- [X] T026 [US2] Wire creation into `AdminApp/src/app/features/specializations/pages/specializations-page/specializations-page.component.ts` and `.html`: "Create specialization" opens the dialog, and a non-null result reloads the list and keeps focus on the trigger
- [X] T027 [US2] Run `npx vitest run src/app/features/specializations` and verify US2 scenarios V2 (including double-submit and API-failure retry) from `quickstart.md`

**Checkpoint**: US1 and US2 both work independently; creation writes specialization + services without duplicates.

---

## Phase 5: User Story 3 - View a specialization's information (Priority: P3)

**Goal**: Clicking a row opens a read-only detail page with the name, status, the full services
table and an "Edit" entry point.

**Independent Test**: Open any specialization: name, status and all services (including Inactive)
are displayed read-only, "Add service" is absent, "Edit" is present, an empty-services message
appears for a service-free specialization, and an unknown id shows "Specialization not found." with
a way back.

### Implementation for User Story 3

- [X] T028 [US3] Implement `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.ts`: inject `SpecializationService`, `ActivatedRoute`, `Router`, `Dialog`, `NotificationService`, `DestroyRef`; `specialization`, `isLoading`, `loadError`, `isEditMode = signal(false)`; `load()`/`retry()` using `specializationIdGet({ id })`, 404 -> `Specialization not found.`, incomplete payload -> `The specialization data returned by the API is incomplete.`; `enterEdit()` flips `isEditMode`
- [X] T029 [US3] Create `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.html` View mode: name, status radios (display only until US5) synced from the loaded signal via an `effect`, services table with "Service Name", "Price", "Status", "Service Category" (numeric price pipe `1.2-2`), empty-services message "This specialization has no services yet.", "Edit" button, and a back link to `/specializations`; loading, not-found and retryable error states
- [X] T030 [P] [US3] Create `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.spec.ts`: loads by route id, renders name/status/services, includes Inactive services, shows the empty-services message, shows `Specialization not found.` on 404 and a Retry action on other errors, and enters View mode with no editable controls
- [X] T031 [US3] Verify US3 scenarios V3 from `quickstart.md`

**Checkpoint**: US3 is independently functional; detail is the landing surface for editing.

---

## Phase 6: User Story 4 - Edit a specialization (Priority: P4)

**Goal**: From the detail page, "Edit" turns the name and all service rows editable, adds
"Add service", and replaces the action with "Save changes"/"Cancel"; saving returns to View mode and
cancelling asks for confirmation.

**Independent Test**: Enter Edit, verify pre-filled values and "Add service", clear the name and see
"Save changes" disabled plus the inline message, save and see updated values in View mode, then
cancel with "No" (edits kept) and "Yes" (stored values restored).

**Depends on**: T016/T017/T018 (form), T020 (writer), T028/T029 (detail page), T008 (gate G-1).

### Implementation for User Story 4

- [X] T032 [US4] Extend `AdminApp/src/app/features/specializations/components/specialization-form/specialization-form.component.ts` for edit mode: pre-fill the group and rebuild the `FormArray` from `initialValue.services` in an `effect` (rows with an id keep it and are not discardable; rows without an id remain discardable), and emit `ServiceRowFormValue.id` so the writer can distinguish stored from new rows
- [X] T033 [US4] Extend `AdminApp/src/app/features/specializations/components/specialization-form/specialization-form.component.html`: in `mode="edit"` show "Save changes" (`[disabled]="!canSubmit()"`) instead of "Confirm", show the discard action only for rows with `id === null`, and keep the same validation messages and `aria-*` wiring
- [X] T034 [P] [US4] Add edit-mode cases to `AdminApp/src/app/features/specializations/components/specialization-form/specialization-form.component.spec.ts`: pre-fill from `initialValue`, persisted rows have no discard action, adding a row in edit mode marks it discardable, and `canSubmit` is false when the last row is removed
- [X] T035 [US4] Extend `AdminApp/src/app/features/specializations/services/specialization-writer.service.ts` with `update(id, value, state)`: call `specializationIdPut` first, then `serviceIdPut` for every row with an `id`, then `servicePost` for rows without one (passing `specializationId`), skipping rows present in `createdServiceIds`; never delete stored services; stop on first failure and return the updated session state
- [X] T036 [P] [US4] Add update-path cases to `AdminApp/src/app/features/specializations/services/specialization-writer.service.spec.ts`: call order, no delete calls, retry skips already-created services, and a failure propagates without additional writes
- [X] T037 [US4] Add edit handlers to `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.ts`: `enterEdit()` (no-op when nothing is loaded), `onSubmitted(value)` guarded by `isSaving`, calling `writer.update`, showing `Specialization updated successfully` and returning to View mode on success, and `onCancelled()` opening `CancelConfirmDialogComponent` with `Do you really want to cancel? Changes will not be saved.`, leaving Edit mode only when the dialog resolves `true`
- [X] T038 [US4] Update `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.html`: render `<app-specialization-form mode="edit" [initialValue]="specialization()" [submitting]="isSaving()" (submitted)="onSubmitted($event)" (cancelled)="onCancelled()" />` when `isEditMode()`, keeping the View layout otherwise
- [X] T039 [US4] Add edit-mode cases to `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.spec.ts`: pre-fill, disabled Save with an empty name, save applies the update and returns to View mode, save failure keeps Edit mode with values, cancel "No" keeps edits, cancel "Yes" discards them, and repeated Save applies one update
- [X] T040 [US4] Verify US4 scenarios V4 from `quickstart.md`, including the staged-status case (change status in Edit, cancel with "Yes", stored status unchanged)

**Checkpoint**: US1-US4 complete; a specialization can be created, inspected and corrected.

---

## Phase 7: User Story 5 - Change a specialization's status (Priority: P5)

**Goal**: Changing the Active/Inactive radios from the list or from detail View mode persists
immediately; setting Inactive deactivates related doctors and services through the backend; no
automatic reactivation.

**Independent Test**: Change a status from the list, reload and see it persisted; set Inactive and
verify related doctors/services become Inactive (once backend gate G-4 is closed); set Active and
verify they stay Inactive; force a failure and verify the radio reverts with an error; select the
current value and verify no request is sent.

**Depends on**: T009/T010 (table), T011 (list page), T028/T029 (detail page).

### Implementation for User Story 5

- [X] T041 [US5] Add status-change output to `AdminApp/src/app/features/specializations/components/specialization-table/specialization-table.component.ts` and `.html`: `statusChange = output<{ id: string; status: SpecializationStatus }>()`, make the radios interactive (remove the temporary `[disabled]`), bind `[disabled]="statusSavingId() === row.id"`, add `statusSavingId = input<string | null>(null)`, and stop propagation on the status cell so changing a radio never emits `open`
- [X] T042 [US5] Implement `onStatusChange({ id, status })` in `AdminApp/src/app/features/specializations/pages/specializations-page/specializations-page.component.ts`: no-op when the value is unchanged or that row is in flight; optimistically update `rows`; call `specializationIdStatusPatch({ id, body: { status: fromSpecializationStatus(status) } })`; on success show `Specialization status updated successfully`; on failure restore the previous value and show `extractErrorMessage` (fallback `Could not update the specialization status. Please try again.`); clear `statusSavingId` in both paths; contain no cascade logic
- [X] T043 [P] [US5] Add status cases to `AdminApp/src/app/features/specializations/pages/specializations-page/specializations-page.component.spec.ts`: immediate optimistic update, PATCH payload uses the numeric enum, rollback + error on failure, no call and no toast when selecting the current value, and a second change for the same row is ignored while the first is pending
- [X] T044 [US5] Implement immediate status in `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.ts` View mode: `statusControl = new FormControl<SpecializationStatus>('Active', { nonNullable: true })`, subscribe to `valueChanges` with `takeUntilDestroyed` and call `specializationIdStatusPatch`; keep the control synced from `specialization()` in an `effect` so rollbacks repaint; disable it while `statusSaving()`; no cascade calls
- [X] T045 [US5] Update `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.html` to bind the View-mode status group to `statusControl` and show a saving indicator, leaving Edit mode's staged status on the form
- [X] T046 [P] [US5] Add status cases to `AdminApp/src/app/features/specializations/pages/specialization-info/specialization-info.component.spec.ts`: immediate PATCH in View mode, rollback on failure, control disabled while saving, no PATCH while in Edit mode, and the staged Edit value written only by "Save changes"
- [X] T047 [US5] Verify US5 scenario V5 from `quickstart.md`: immediate persistence and rollback pass now; the cascade assertion (related doctors and services Inactive) must be recorded as blocked by gate G-4 if they stay Active

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature verification and hygiene.

- [X] T048 [P] Run `npm run build` from `AdminApp/` and fix any strict-template or type errors in the new feature
- [X] T049 [P] Run `npx vitest run src/app/features/specializations` (and the full `npm test`) from `AdminApp/` and make all suites under `AdminApp/src/app/features/specializations/` pass
- [X] T050 Architecture sweep over `AdminApp/src/app/features/specializations/`: every component `standalone` with `ChangeDetectionStrategy.OnPush`, no `NgModule`, no `any`, no `I`-prefixed interfaces, no `@apply`, no raw `HttpClient` usage, no manual DTO definitions, and every explicit subscription bounded by `takeUntilDestroyed`
- [ ] T051 Execute `quickstart.md` sections 4-6 (V1-V6) end to end and record the result of the keyboard-only and mobile-width checks. **Blocked in this environment:** needs a running AdminApp + Services API with authentication and a browser; G-1 blocks create/edit submits and G-4 blocks the cascade assertion. Automated coverage for V1-V5 is provided by T013/T014/T019/T021/T024/T030/T034/T036/T039/T043/T046; the full suite (384 tests) and the production build pass. The Create dialog open + cancel flow (V2)
  was additionally confirmed in a browser; submits still need G-1 and the cascade needs G-4.
- [X] T052 Update the Contract Gates table in `specs/008-specialization-management/plan.md` with the final status of G-1..G-5 (closed / still blocked) and note any follow-up backend requests

### Verification notes (2026-11-18)

- `npx ng test --watch=false`: **47 files / 384 tests passed** (all `specializations` suites included).
- `npx ng build`: **production build succeeded**.
- Runtime bug found in a real browser: `panelClass: 'w-full max-w-3xl'` made CDK call
  `DOMTokenList.add()` with a space-separated token, throwing `InvalidCharacterError` inside
  `dialog.open`; the Create action looked frozen. Fixed to array form in
  `open-specialization-create-dialog.ts` and `app-dialog.service.ts`, with a regression test
  (`open-specialization-create-dialog.spec.ts`) asserting array `panelClass` values.
  Verified via headless Chrome/CDP: the dialog opens with title, 3 fields, focus on Name and the
  exact `Do you really want to cancel? Entered data will not be saved.` confirmation.
- T008: the decision is recorded in `plan.md` - the specialization payload must become `{ name, status }`
  in the backend. No placeholder `price`/`category` is fabricated; real create/edit submits remain
  blocked by G-1.
- T015/T027/T031/T040: the automated equivalents (table, form, writer, dialog, list page, detail page)
  pass, covering the V1-V4 behaviours including double-submit, failure retry and the staged Edit status.
  Browser-level execution needs a running backend.
- T047: immediate persistence and rollback are covered by T043/T046. The cascade assertion
  (related doctors/services becoming Inactive) is **blocked by G-4** and is not compensated in the
  browser, per the specification.
- T051: still open; see its note above.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; T003-T007 block every story; T008 blocks US2/US4 only
- **US1 (Phase 3)**: depends on Foundational - no story dependencies (MVP)
- **US2 (Phase 4)**: depends on Foundational + T008 + T003
- **US3 (Phase 5)**: depends on Foundational only (may run in parallel with US2)
- **US4 (Phase 6)**: depends on US2's form (T016-T018) and US3's detail page (T028-T029) + T008
- **US5 (Phase 7)**: depends on US1's table/page (T009-T012) and US3's detail page (T028-T029)
- **Polish (Phase 8)**: depends on all completed stories

### User Story Dependencies

- **US1 (P1)**: independent - MVP
- **US2 (P2)**: reuses US1's page for the entry point and refresh; independently testable
- **US3 (P3)**: independent of US2; reachable from US1's table
- **US4 (P4)**: extends US2's form and US3's page; valuable only after those two
- **US5 (P5)**: extends US1's table/page and US3's page; the cascade assertion depends on backend G-4

### Within Each User Story

- Models/mappers before components; dumb components before smart pages; implementation before its
  spec task; spec tasks written against the contracts in `contracts/ui-contracts.md`
- Story complete and validated before moving to the next priority

### Parallel Opportunities

- Setup: T002 alongside T001
- Foundational: T003, T004, T005, T006, T007 are mutually independent files
- After Foundational: US1 and US3 can proceed in parallel; US2 can start once T008/T003 clear
- Within US2: T019 (form spec), T021 (writer spec), T024 (dialog spec) have no file overlap
- Within US4: T034 (form spec) and T036 (writer spec) can run together with implementation tasks
- Within US5: T043 and T046 are separate spec files and can run together

---

## Parallel Example: Foundational Phase

```text
Task: "T003 Extend AdminApp/scripts/augment-services-openapi.mjs and run npm run api:services"
Task: "T004 Create AdminApp/src/app/features/specializations/models/specialization.model.ts"
Task: "T005 Create AdminApp/src/app/features/specializations/models/specialization.model.spec.ts"
Task: "T006 Add routes in AdminApp/src/app/app.routes.ts"
Task: "T007 Add nav item in AdminApp/src/app/app.ts"
```

## Parallel Example: User Story 2 Specs

```text
Task: "T019 specialization-form.component.spec.ts"
Task: "T021 specialization-writer.service.spec.ts"
Task: "T024 specialization-create-dialog.component.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T003-T007; T008 only needed before US2)
3. Complete Phase 3: US1
4. **STOP and VALIDATE**: run US1 V1 scenarios and T013/T014
5. Demo the read-only catalog - this alone is shippable

### Incremental Delivery

1. Foundation -> US1 (list) -> validate -> demo
2. Clear gates G-1/G-2 (T008/T003) -> US2 (create) -> validate -> demo
3. US3 (detail) can ship in parallel with US2
4. US4 (edit) on top of US2 + US3
5. US5 (status) on top of US1 + US3; cascade verification only after backend G-4 closes
6. Polish and record gate outcomes

### Parallel Team Strategy

- Developer A: US1 -> US5 (list surface)
- Developer B: US2 (dialog + writer) after gates clear
- Developer C: US3 -> US4 (detail surface), coordinating on T032/T033 with Developer B

---

## Notes

- Every API call goes through the generated client; if a required operation or field is missing,
  stop and request client regeneration instead of writing HTTP code
- `FormArray` emptiness is enforced twice: the `minLength(1)` array validator and the explicit
  `services.length > 0` guard in `canSubmit`
- Status cascade stays backend-side; the frontend only calls `specializationIdStatusPatch`
- Stored services are never removed; discard is offered only for rows added in the session
- Commit after each task or logical group; stop at every checkpoint to validate the story
