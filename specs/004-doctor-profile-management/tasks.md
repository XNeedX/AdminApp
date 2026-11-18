# Tasks: Doctor Profile Management

**Input**: Design documents from `specs/004-doctor-profile-management/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/profile-api.contract.md](./contracts/profile-api.contract.md), [backend-unblock-plan.md](./backend-unblock-plan.md), [quickstart.md](./quickstart.md)

**Tests**: Not explicitly requested in the specification. No test-authoring tasks are included; the testing strategy in `research.md` D12 can be executed as a follow-up if TDD is requested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description
- Repository root is `E:\Innowise Project\Frontend\AdminApp`; the Angular app lives in `AdminApp/`

## Path Conventions

- Application code: `AdminApp/src/app/`
- Global styles: `AdminApp/src/styles.css`
- Feature specs: `specs/004-doctor-profile-management/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency, shared constants, shared models, and the reusable validator.

- [X] T001 Install `@angular/cdk@^21.2.0` in `AdminApp/package.json` (run `npm install @angular/cdk@^21.2.0` from `AdminApp/`) and add `@import '@angular/cdk/overlay-prebuilt.css';` to `AdminApp/src/styles.css` after the Tailwind import.
- [X] T002 [P] Add `DOCTOR_STATUSES` (exactly `At work`, `On vacation`, `Sick Day`, `Sick Leave`, `Self-isolation`, `Leave without pay`, `Inactive`) and the type guard `isDoctorStatus(value: string): value is DoctorStatus` to `AdminApp/src/app/features/doctors/models/doctor-form.model.ts`; reuse the existing `DoctorStatus` enum.
- [X] T003 [P] Create `AdminApp/src/app/features/profile/models/profile.model.ts` with `DoctorProfile` (`id`, `photoPath`, `firstName`, `lastName`, `middleName`, `dateOfBirth`, `specialization`, `officeAddress`, `careerStartYear`, `status`), `DoctorProfileForm` (controls: `photo`, `firstName`, `lastName`, `middleName`, `dateOfBirth`, `specializationText`, `specializationId`, `officeText`, `officeId`, `careerStartYear`, `status`), `DoctorProfileFormValue`, and `toFormValue` / `toUpdateDoctorDto` / `applyUpdateDto` mappers. Re-export `AutocompleteOption` from `shared/components/autocomplete/autocomplete.model.ts` instead of redeclaring it.
- [X] T004 [P] Create `AdminApp/src/app/core/validators/catalog-match.validator.ts` exporting `catalogMatchValidator(options: () => readonly CatalogOption[]): ValidatorFn`, where `CatalogOption` is the minimal `{ readonly label: string }` structural type (so it accepts the future `AutocompleteOption` without coupling `core/` to a feature); return `{ invalidCatalogValue: true }` only when the trimmed text is non-empty and does not match any option label case-insensitively; return `null` for empty text so `Validators.required` reports the empty case.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Regenerate the API client and build the shared access-control and autocomplete primitives that every story needs.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 **API CLIENT (adapted)**: No OpenAPI generator exists, so replace the `any`-typed wrappers in `AdminApp/src/app/api/doctor.service.ts` with a strictly typed hand-written client: `getMyProfile(accountId)`, `getDoctor(id, fallbackStatus?)`, `getDoctorsForTable(filter)`, `updateDoctor(id, dto)`, `uploadPhoto(file)`, `createDoctor(body)`, `checkEmailExists(email)`. Treat every payload as `unknown`, narrow it with `readEnvelope` / `asRecord` / `isDoctorStatus` guards, and throw a descriptive `Error` on a malformed shape. Rewrite `office.service.ts` and `specialization.service.ts` the same way and remove their offline fallbacks. No `any`, no unchecked casts.
- [X] T006 [P] Create `AdminApp/src/app/core/guards/role.guard.ts` with `roleGuard(...allowed: readonly AuthRole[]): CanActivateFn`; redirect unauthenticated users to `/sign-in` and authenticated users without an allowed role to `/`.
- [X] T007 [P] Create `AdminApp/src/app/shared/components/autocomplete/autocomplete.component.ts` and `.html`: standalone, OnPush, `ControlValueAccessor` for the visible text, `options: readonly AutocompleteOption[]` input, `optionSelected` output, type-to-filter, keyboard `ArrowDown`/`ArrowUp`/`Enter`/`Escape`/`Home`/`End`, ARIA `combobox`/`listbox`/`option` attributes, and `onTouched()` on blur; style only with Tailwind utilities.

**Checkpoint**: API client, role guard, and autocomplete are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - Edit a doctor profile (Priority: P1) MVP

**Goal**: A Doctor (own profile) or Receptionist (any doctor profile) can switch the profile page to Edit mode, correct values with immediate validation, save to the backend, or cancel through a confirmation dialog.

**Independent Test**: Open `/profile` as a Doctor (or `/doctors/{id}/profile` as a Receptionist), click "Edit", clear the first name, and confirm the error and disabled "Save changes". Restore valid values, change the middle name and status, save, and confirm the page returns to View mode with the new values. Re-enter Edit, change values, click "Cancel", then "Yes", and confirm nothing was saved; repeat with "No" and confirm values are preserved.

### Implementation for User Story 1

- [X] T008 [P] [US1] Create the Dumb `AdminApp/src/app/features/profile/components/profile-view/profile-view.component.ts` and `.html`: `profile = input<DoctorProfile | null>(null)`, `edit = output<void>()`; render photo (or initials placeholder), first name, last name, middle name (or placeholder when empty), date of birth (`date` pipe), specialization, office address, career start year, status badge, and an "Edit" button; responsive Tailwind grid (`sm:`/`md:`), no services injected.
- [X] T009 [P] [US1] Create the Dumb `AdminApp/src/app/features/profile/components/profile-edit/profile-edit.component.ts` and `.html`: inputs `form: FormGroup<DoctorProfileForm>`, `specializations: readonly AutocompleteOption[]`, `offices: readonly AutocompleteOption[]`, `isSaving: boolean`, `photoPreview: string | null`, `canSave: boolean`; outputs `save`, `cancel`, `photoSelected: File`; render all F-1…F-9 fields with `ReactiveFormsModule`, use `<app-autocomplete>` for Specialization and Office, and show each message only when the control is `invalid && touched` with the exact texts from `data-model.md` §3 (`Please, enter the first name`, `Please, enter the last name`, `Please, select the date`, `Please, choose the specialisation`, `Invalid specialization name`, `Please, choose the office`, `Please, select the year`, `Date cannot be in the future`, `Year cannot be in the future`); footer buttons "Save changes" (`[disabled]="!canSave() || isSaving()"`) and "Cancel"; red border via `border-red-500` and message via `text-red-600` with `aria-describedby`.
- [X] T010 [P] [US1] Create the Dumb `AdminApp/src/app/features/profile/components/cancel-edit-dialog/cancel-edit-dialog.component.ts` and `.html`: inject `DIALOG_DATA` as `{ message: string }` and `DialogRef<boolean>`; render the exact message `Do you really want to cancel? Changes will not be saved.` with an element id `cancel-edit-dialog-message`; buttons "Yes" → `dialogRef.close(true)` and "No" → `dialogRef.close(false)`; Tailwind card only (CDK supplies the backdrop).
- [X] T011 [US1] Create the Smart `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts` with signals `isEditMode`, `profile`, `specializations`, `offices`, `isSaving`, `loadError`, `photoPreview`, and a `DestroyRef`; implement `ngOnInit` to load the own profile via `DoctorService.getMyProfile(accountId)` (using `AuthService.user().accountId`, no `/me`) when there is no `:id` route param, or `DoctorService.getDoctor(id)` when `:id` is present, and load offices/specializations in parallel; handle loading, 404 ("Profile not found" + retry), and other load errors.
- [X] T012 [US1] Build the typed `profileForm` in `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts`: `photo` (optional), `firstName` (required), `lastName` (required), `middleName` (optional), `dateOfBirth` (required + `maxDateValidator(() => new Date())`), `specializationText` (required + `catalogMatchValidator(() => this.specializationOptions())`), `specializationId` (required), `officeText` (required + `catalogMatchValidator(() => this.officeOptions())`), `officeId` (required), `careerStartYear` (required + `maxYearValidator(() => new Date().getFullYear())`), `status` (required, `DoctorStatus`); derive `canSave = computed(() => this.formStatus() === 'VALID' && !this.isSaving())` using `toSignal(this.profileForm.statusChanges.pipe(startWith(this.profileForm.status)), { initialValue: this.profileForm.status })`.
- [X] T013 [US1] Implement `enterEditMode()`, `cancelEdit()`, and `save()` in `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts`: `enterEditMode` resets the form from `toFormValue(profile())` and sets `isEditMode`; `cancelEdit` opens `CancelEditDialogComponent` via CDK `Dialog.open<boolean, { message: string }>(...)` with `disableClose: true`, `ariaLabelledBy: 'cancel-edit-dialog-message'`, `restoreFocus: true`, and subscribes to `closed` with `takeUntilDestroyed` (Yes → reset to View and form; No → stay in Edit); `save` guards `invalid`/`isSaving`, uploads a newly selected photo via `DoctorService.uploadPhoto`, builds `UpdateDoctorDto` with `photoPath` = new upload id or the existing path, trimmed names, selected specialization label, selected office label, numeric `careerStartYear`, and `status`, calls `DoctorService.updateDoctor(id, dto)`, updates the `profile` signal, shows a success toast, and keeps Edit mode with an error toast on failure.
- [X] T014 [US1] Implement photo and autocomplete handlers in `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts` and its template: `onPhotoSelected(File)` validates JPEG/PNG/WebP up to 5 MB, sets the `photo` control, and creates/revokes a preview object URL; `onSpecializationSelected(option)` sets `specializationId` and `specializationText`; `onOfficeSelected(option)` sets `officeId` and `officeText`; clearing or typing free text resets the corresponding hidden id so the form becomes invalid.
- [X] T015 [US1] Create `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.html` with `@if (isEditMode())` rendering `<app-profile-edit>` and `@else` rendering `<app-profile-view>`; bind all inputs/outputs from T008/T009, show a loading state, an error state with retry, and a "Back to Doctors" link only for the Receptionist route.
- [X] T016 [US1] Add the routes in `AdminApp/src/app/app.routes.ts`: `/profile` with `canActivate: [roleGuard('Doctor')]` and `/doctors/:id/profile` with `canActivate: [roleGuard('Receptionist')]`, both lazy-loading `ProfilePageComponent` via `loadComponent`.
- [X] T017 [US1] Add the Receptionist entry point in `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.html` and `.ts`: a "View profile" action per row and `openDoctorProfile(id)` using `Router.navigate(['/doctors', id, 'profile'])`.
- [ ] T018 [US1] Validate US1 AC-1…AC-9 and F-1…F-9 against `specs/004-doctor-profile-management/quickstart.md` §4; fix any discrepancy in `AdminApp/src/app/features/profile/`.

**Checkpoint**: US1 is fully functional via direct URL (`/profile`, `/doctors/:id/profile`) and is the MVP.

---

## Phase 4: User Story 2 - View my profile (Priority: P2)

**Goal**: A signed-in Doctor reaches the profile page from the header profile icon and sees the read-only profile with an "Edit" button.

**Independent Test**: Sign in as a Doctor, click the profile icon, and confirm the profile page opens in View mode with photo, names, date of birth, specialization, office, career start year, status, and an "Edit" button; confirm no field is editable before "Edit" is clicked.

### Implementation for User Story 2

- [X] T019 [P] [US2] Add `canViewProfile = input<boolean>(false)` and `openProfile = output<void>()` to `AdminApp/src/app/shared/layout/app-header/app-header.component.ts`, and add a profile icon button in `AdminApp/src/app/shared/layout/app-header/app-header.component.html` that is rendered only when `canViewProfile()` is true and calls `onOpenProfile()`.
- [X] T020 [US2] Wire the header in `AdminApp/src/app/app.ts` and `AdminApp/src/app/app.html`: compute `isDoctor = computed(() => this.auth.user()?.roles.includes('Doctor') ?? false)`, pass `[canViewProfile]="isDoctor()"`, and handle `(openProfile)="onOpenProfile()"` with `this.router.navigate(['/profile'])`.
- [ ] T021 [US2] Verify US2 AC-1…AC-5 against `specs/004-doctor-profile-management/quickstart.md` §4.1: icon opens the page, all fields render, "Edit" is present, fields are read-only, and missing photo/middle name show placeholders instead of errors; fix any issue in `AdminApp/src/app/features/profile/components/profile-view/`.

**Checkpoint**: US1 and US2 both work; the Doctor can reach the profile page from the header.

---

## Phase 5: User Story 3 - Change a doctor's status from the Doctors page (Priority: P3)

**Goal**: A Receptionist changes a doctor's status from the "Doctors" page with a simple select that persists immediately and rolls back on failure.

**Independent Test**: Sign in as a Receptionist, open the "Doctors" page, change a doctor's status to each of the seven values, and confirm the row updates, the change persists after reload, and the doctor's profile shows the same status. Simulate a failed request and confirm the previous status is restored with an error notification.

### Implementation for User Story 3

- [X] T022 [P] [US3] Replace the mocked `doctors` signal in `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.ts` with the typed `DoctorService.getDoctorsForTable({ page: 1, pageSize: 50 })` result; type rows as `DoctorTableRow` (`id`, `fullName`, `specialization`, `status`, `dateOfBirth`, `officeAddress`); load on `ngOnInit` with `takeUntilDestroyed`; refresh the list after `onDoctorCreated` instead of prepending the creation response.
- [X] T023 [US3] Add `canChangeStatus = computed(() => this.auth.user()?.roles.includes('Receptionist') ?? false)`, the `statusSavingIds` signal, and the `isStatusSaving(id)` helper to `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.ts`; inject `AuthService` and `NotificationService`.
- [X] T024 [US3] Update `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.html` to render `fullName`, `specialization`, `officeAddress`, and a status column with `<select [value]="doc.status" (change)="onStatusChange(doc, $event)" [disabled]="isStatusSaving(doc.id)">` and options from `DOCTOR_STATUSES`; render the status select only when `canChangeStatus()` is true; keep the existing "Create doctor" flow.
- [X] T025 [US3] Implement `onStatusChange(doc, event)` in `AdminApp/src/app/features/doctors/pages/doctors-page/doctors-page.component.ts`: read the new value, validate with `isDoctorStatus`, ignore the current value, update the row optimistically, add the id to the `statusSavingIds` signal set, then compose the update: `DoctorService.getDoctor(doc.id, previousStatus)` → build the full `UpdateDoctorDto` from the returned profile with only `status` replaced → `DoctorService.updateDoctor(profile.id, dto)`. Show a success toast; on error restore the previous status and show an error toast; remove the id in `finalize`.
- [ ] T026 [US3] Verify US3 AC-1…AC-6 and F-9 against `specs/004-doctor-profile-management/quickstart.md` §5.2, including all seven statuses, persistence after reload, profile-page consistency, and rollback on failure; fix any issue in `AdminApp/src/app/features/doctors/pages/doctors-page/`.

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and validation across all stories.

- [X] T027 [P] Remove offline fallback data from `AdminApp/src/app/api/specialization.service.ts` and `AdminApp/src/app/api/office.service.ts`; ensure catalog failures surface an error and keep "Save changes" disabled on the profile page.
- [X] T028 [P] Add a shared status presentation mapping (Tailwind badge classes per `DoctorStatus`) in `AdminApp/src/app/features/doctors/models/doctor-status.presentation.ts` and use it in `profile-view.component.html` and the Doctors table.
- [ ] T029 [P] Accessibility and responsive pass across `AdminApp/src/app/features/profile/` and `AdminApp/src/app/shared/components/autocomplete/`: verify ARIA `combobox`/`listbox`/`option`, dialog focus trap and restoration, keyboard-only operation, and layouts at 375 px, 768 px, and 1280 px.
- [X] T030 Run `npm run build` and `npm test` from `AdminApp/`; fix strict template/type errors, any remaining `any`, missing `OnPush`, non-standalone declarations, and subscription leaks in the new code.
- [ ] T031 Run the full `specs/004-doctor-profile-management/quickstart.md` validation (sections 4–8) and record pass/fail per acceptance criterion; file follow-up issues for any failure.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T002–T004 can run in parallel after T001.
- **Foundational (Phase 2)**: Depends on Setup. T005 is the hard gate; T006/T007 can run in parallel once their Setup inputs exist.
- **User Stories (Phase 3+)**: All depend on Foundational completion.
  - US1 can start immediately after Phase 2.
  - US2 depends on US1 T008/T015/T016 (the view component and `/profile` route) for its independent test.
  - US3 can start after Phase 2 and is independent of US1/US2 except for the shared `DoctorStatus` constants.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3. Delivers the page, both modes, save/cancel, and both routes.
- **US2 (P2)**: Depends on US1 for the page and view component; adds only the header entry point and view-mode verification.
- **US3 (P3)**: Independent of US1/US2; uses the typed API client, `DoctorStatus`, and the existing Doctors page.

### Within Each User Story

- Dumb components (T008–T010) before the Smart page (T011–T015).
- Form construction (T012) before mode switching and save (T013–T014).
- Page template (T015) after the components exist.
- Routes (T016) after the page exists.
- Entry point (T017) after the route exists.
- Verification (T018/T021/T026) last.

### Parallel Opportunities

- Setup: T002, T003, T004.
- Foundational: T006, T007.
- US1: T008, T009, T010 (three different components).
- US2: T019 can be prepared while US1 T011–T015 are in progress; T020 waits for T016.
- US3: T022 can run in parallel with US1 because it only touches the Doctors page.
- Polish: T027, T028, T029.

---

## Parallel Example: User Story 1

```text
Task T008: Create ProfileViewComponent in AdminApp/src/app/features/profile/components/profile-view/
Task T009: Create ProfileEditComponent in AdminApp/src/app/features/profile/components/profile-edit/
Task T010: Create CancelEditDialogComponent in AdminApp/src/app/features/profile/components/cancel-edit-dialog/
```

After those complete, run T011–T015 sequentially in `profile-page.component.ts` / `.html`.

## Parallel Example: Cross-Story

```text
Task T022: Load the real doctors table in doctors-page.component.ts (US3, independent files)
Task T019: Add the header profile icon in app-header.component.ts/html (US2, independent files)
Task T027: Remove catalog fallbacks in api/specialization.service.ts and api/office.service.ts (Polish)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational — especially the T005 API contract gate.
3. Complete Phase 3: US1.
4. **STOP and VALIDATE**: Run `quickstart.md` §4 (Doctor edit flow) and §5.1 (Receptionist edit flow).
5. Demo the MVP via direct URLs `/profile` and `/doctors/{id}/profile`.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → test independently → MVP.
3. US2 → header profile icon → test independently.
4. US3 → status select on the Doctors page → test independently.
5. Polish → full quickstart validation.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. After Phase 2:
   - Developer A: US1 (profile page and both modes).
   - Developer B: US3 (Doctors page status) — independent files.
   - Developer C: US2 header work can start, but final wiring waits for US1 T016.
3. Integrate and run the quickstart matrix.

---

## Notes

- **API client**: there is no OpenAPI generator. `src/app/api/` contains hand-written, strictly typed clients (`unknown` + runtime guards, zero `any`); do not add unchecked casts or fabricated fallback data.
- **Backend gate**: `GET /api/Doctors/account/{accountId}` and the widened `GET /api/Doctors/{id}` (Receptionist, with `id`/`status`) are still required for end-to-end runtime; see `backend-unblock-plan.md`.
- **[P] tasks**: different files, no dependencies.
- **[Story] labels** map every story task to `spec.md` for traceability.
- **Exact messages** are specified in `data-model.md` §3 and must not be reworded.
- **Date rules**: `dateOfBirth <= today`, `careerStartYear <= current year`; today and the current year are valid.
- **Status vocabulary**: exactly seven values; the same list is used in the profile form and the Doctors page.
- **Out of scope**: e-mail/credential changes, photo removal, unsaved-change prompts on navigation, audit history, concurrency conflict resolution.

---

## Implementation Status (2026-11-11)

| Task | Status | Evidence |
|---|---|---|
| T001 | ✅ Done | `@angular/cdk` resolved to `^21.2.14` in `AdminApp/package.json`; `@import '@angular/cdk/overlay-prebuilt.css';` added to `AdminApp/src/styles.css`. |
| T002 | ✅ Done | `DOCTOR_STATUSES` and `isDoctorStatus` added to `AdminApp/src/app/features/doctors/models/doctor-form.model.ts`. |
| T003 | ✅ Done | `features/profile/models/profile.model.ts` — `DoctorProfile`, `DoctorProfileForm`, `DoctorProfileFormValue`, `UpdateDoctorDto`, `toFormValue`, `toUpdateDoctorDto`, `applyUpdateDto`; re-exports `AutocompleteOption`. |
| T004 | ✅ Done | `AdminApp/src/app/core/validators/catalog-match.validator.ts` created with a structural `CatalogOption` type. |
| T005 | ✅ Done (adapted) | No OpenAPI generator; `api/doctor.service.ts` rewritten as a strictly typed hand-written client (`getMyProfile`, `getDoctor`, `getDoctorsForTable`, `updateDoctor`, `uploadPhoto`, `createDoctor`, `checkEmailExists`) with envelope/type guards and zero `any`. `office.service.ts` and `specialization.service.ts` rewritten typed with no fallbacks. |
| T006 | ✅ Done | `core/guards/role.guard.ts` — `roleGuard(...allowed)` returns `CanActivateFn`; unauthenticated → `/sign-in`, authenticated without an allowed role → `/`. |
| T007 | ✅ Done | `shared/components/autocomplete/` — standalone OnPush `ControlValueAccessor`, ARIA `combobox`/`listbox`/`option`, full keyboard support, `onTouched()` on blur, Tailwind-only. |
| T008 | ✅ Done | `features/profile/components/profile-view/` — photo/initials, names, DOB, specialization, office, career year, status badge, "Edit" button, responsive grid. |
| T009 | ✅ Done | `features/profile/components/profile-edit/` — typed form renderer, two autocompletes, exact validation messages, photo picker with inline error, "Save changes"/"Cancel" footer. |
| T010 | ✅ Done | `features/profile/components/cancel-edit-dialog/` — CDK `DialogRef<boolean>` + `DIALOG_DATA`, exact message text, Yes/No. |
| T011–T015 | ✅ Done | `features/profile/pages/profile-page/` — loads own profile via `getMyProfile(sub)` or `getDoctor(id)`, typed form, `canSave` via `toSignal`, edit/cancel/save, photo validation (JPEG/PNG/WebP ≤ 5 MB), loading/error/catalog-warning states. |
| T016 | ✅ Done | `app.routes.ts` — `/profile` (`roleGuard('Doctor')`), `/doctors/:id/profile` (`roleGuard('Receptionist')`), `/doctors` restricted to Receptionist, role-aware home redirect. |
| T017 | ✅ Done | Doctors table has a "View profile" row action navigating to `/doctors/:id/profile`. |
| T019–T020 | ✅ Done | `AppHeaderComponent` gained `canViewProfile`/`openProfile`; `App` passes the Doctor role and navigates to `/profile`. |
| T022–T025 | ✅ Done | Doctors page loads real `getDoctorsForTable` data, renders `fullName`/`specialization`/`office`/`dateOfBirth`, status `<select>` with optimistic update and rollback; status save composes `GET /{id}` + `PUT /{id}`. |
| T027 | ✅ Done | Offline catalog fallbacks removed; failures surface a warning and keep saving disabled. |
| T018, T021, T026, T029, T031 | ⏳ Pending | Runtime validation against `quickstart.md` requires the backend changes below. |
| T030 | ✅ Done | `npm run build` succeeds; `npm test -- --watch=false` passes 15 files / 94 tests. |

**Verification**: `npm run build` and `npm test -- --watch=false` both pass after the implementation.

**Remaining backend dependency**: add `GET /api/Doctors/account/{accountId}` with `AccountId = sub` linking, and widen `GET /api/Doctors/{id}` to `Receptionist` returning `id` + `status`; see [backend-unblock-plan.md](./backend-unblock-plan.md) S1/S2. No further frontend code generation is required.
