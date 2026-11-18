---
description: "Task list for Create Doctor Profile feature implementation"
---

# Tasks: Create Doctor Profile

**Input**: Design documents from `specs/001-create-doctor-profile/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/doctor-api.contract.md`, `quickstart.md`, `.specify/memory/constitution.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path and clear implementation instructions.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define domain models, enums, and API client interfaces.

- [X] T001 [P] Create domain models, status enum (`DoctorStatus`: `"At work"`, `"On vacation"`, `"Sick Day"`, `"Sick Leave"`, `"Self-isolation"`, `"Leave without pay"`, `"Inactive"`), `Specialization`, `Office`, and `CreateDoctorRequestDto` in `AdminApp/src/app/features/doctors/models/doctor-form.model.ts`
- [X] T002 [P] Define API client service contracts (`DoctorService`, `SpecializationService`, `OfficeService`) in `AdminApp/src/app/api/doctor.service.ts`, `AdminApp/src/app/api/specialization.service.ts`, and `AdminApp/src/app/api/office.service.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation infrastructure required across user stories.

**⚠️ CRITICAL**: Must be completed before implementing form validation or submission.

- [X] T003 [P] Implement `maxDateValidator` and `maxYearValidator` enforcing date `<= current date` and year `<= current year` in `AdminApp/src/app/core/validators/max-date.validator.ts`
- [X] T004 [P] Implement debounced async `emailUniqueValidator` using `timer(300)` and `switchMap` calling `DoctorService.checkEmailExists()` in `AdminApp/src/app/core/validators/email-unique.validator.ts`
- [X] T005 [P] Create unit tests for date validators in `AdminApp/src/app/core/validators/max-date.validator.spec.ts`
- [X] T006 [P] Create unit tests for async email validator in `AdminApp/src/app/core/validators/email-unique.validator.spec.ts`

**Checkpoint**: Core models and validators ready — user story implementation can proceed.

---

## Phase 3: User Story 1 - Create Doctor Profile with Valid Data (Priority: P1) 🎯 MVP

**Goal**: Enable Receptionist to open the creation modal, fill in valid doctor data (with default status `"At work"` and optional photo/middle name), submit, and trigger doctor creation and credential dispatch.

**Independent Test**: Navigate to Doctors page, open modal, input valid fields, click "Confirm", verify `DoctorService.createDoctor()` receives `CreateDoctorRequestDto`, modal closes, and Doctors list updates.

### Tests for User Story 1

- [X] T007 [P] [US1] Create unit test suite for `DoctorCreateComponent` creation flow and submission in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.spec.ts`

### Implementation for User Story 1

- [X] T008 [US1] Implement `DoctorCreateComponent` component class (Standalone, `ChangeDetectionStrategy.OnPush`, `ReactiveFormsModule`, typed `FormGroup`, API service injection, default status `"At work"`) in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.ts`
- [X] T009 [US1] Implement `DoctorCreateComponent` HTML template with photo file uploader, inputs for names, date of birth, email, specialization combobox, office dropdown, career start year, status, and footer buttons ("Confirm", "Cancel") using Tailwind CSS in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.html`
- [X] T010 [US1] Implement submission handler in `DoctorCreateComponent` mapping form values to `CreateDoctorRequestDto` and calling `DoctorService.createDoctor()` with `takeUntilDestroyed()` in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.ts`

**Checkpoint**: At this point, User Story 1 is fully functional as an MVP increment.

---

## Phase 4: User Story 2 - Field Validation on Blur & Submission Guarding (Priority: P2)

**Goal**: Display contextual error messages on `blur` (`control.invalid && control.touched`) with Tailwind red borders, and keep "Confirm" disabled while required fields are invalid.

**Independent Test**: Blur each empty or invalid field; verify exact error messages appear (`"Please, enter the first name"`, `"Please, enter the last name"`, `"Please, select the date"`, `"Please, enter the email"`, `"You've entered an invalid email"`, `"User with this email already exists"`, `"Please, choose the specialisation"`, `"Invalid specialization name"`, `"Please, choose the office"`, `"Please, select the year"`); verify "Confirm" button stays disabled.

### Tests for User Story 2

- [X] T011 [P] [US2] Add unit tests for on-blur validation messages, error mappings, and Confirm button disabled state in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.spec.ts`

### Implementation for User Story 2

- [X] T012 [US2] Bind synchronous validators (`Validators.required`, `Validators.email`, `maxDateValidator`, `maxYearValidator`) and async `emailUniqueValidator` to `DoctorCreateComponent` form controls in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.ts`
- [X] T013 [US2] Add blur-driven error display elements and Tailwind conditional error classes (`border-red-500`, `text-red-600`) for all fields in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.html`
- [X] T014 [US2] Bind disabled state of the "Confirm" button to `doctorForm.invalid` in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.html`

**Checkpoint**: User Stories 1 and 2 work together with full validation and error feedback.

---

## Phase 5: User Story 3 - Safe Cancellation Confirmation Flow (Priority: P3)

**Goal**: Prevent accidental loss of entered data when clicking "Cancel" by presenting a confirmation dialog (`ConfirmCancelDialogComponent`) with "Yes" and "No" choices.

**Independent Test**: Enter partial doctor data, click "Cancel", verify dialog asks `"Do you really want to cancel? Entered data will not be saved."`; click "No" to stay on form with data preserved; click "Yes" to close modal and discard data.

### Tests for User Story 3

- [X] T015 [P] [US3] Create unit tests for `ConfirmCancelDialogComponent` verifying prompt message and output events in `AdminApp/src/app/shared/components/confirm-cancel-dialog/confirm-cancel-dialog.component.spec.ts`

### Implementation for User Story 3

- [X] T016 [P] [US3] Implement `ConfirmCancelDialogComponent` (Standalone, `ChangeDetectionStrategy.OnPush`, message `"Do you really want to cancel? Entered data will not be saved."`, `output<boolean>()` for Yes/No) in `AdminApp/src/app/shared/components/confirm-cancel-dialog/confirm-cancel-dialog.component.ts`
- [X] T017 [P] [US3] Implement `ConfirmCancelDialogComponent` HTML template with Tailwind modal backdrop and action buttons in `AdminApp/src/app/shared/components/confirm-cancel-dialog/confirm-cancel-dialog.component.html`
- [X] T018 [US3] Integrate `ConfirmCancelDialogComponent` into `DoctorCreateComponent` cancel workflow, handling discard on "Yes" and retention on "No" in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.ts`

**Checkpoint**: All three user stories are functional and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Routing integration, responsive layout verification, and end-to-end validation.

- [X] T019 [P] Register Doctors route or modal trigger in `AdminApp/src/app/app.routes.ts`
- [X] T020 [P] Audit Mobile-First responsive styles (`sm:`, `md:`, `lg:`) and accessibility labels across the creation modal in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.html`
- [X] T021 Execute full quickstart validation scenarios against `specs/001-create-doctor-profile/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (models and API contracts). Blocks User Stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Serves as MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1 component structure + Foundational validators.
- **User Story 3 (Phase 5)**: Depends on User Story 1 container. Can proceed in parallel with User Story 2.
- **Polish (Phase 6)**: Depends on completion of User Stories 1, 2, and 3.

### Parallel Opportunities

- **Phase 1**: T001 and T002 can execute in parallel.
- **Phase 2**: T003, T004, T005, and T006 can execute in parallel.
- **Phase 3**: T007 (unit tests) can be written in parallel with T008/T009.
- **Phase 4**: T011 can be written in parallel with T012.
- **Phase 5**: T015, T016, and T017 can execute in parallel with Phase 4 tasks.
- **Phase 6**: T019 and T020 can execute in parallel.

---

## Implementation Strategy (MVP First)

1. Complete **Phase 1** (Setup) & **Phase 2** (Foundational).
2. Complete **Phase 3** (User Story 1): Valid form creation and submission → **MVP ready!**
3. Complete **Phase 4** (User Story 2): On-blur validation, Tailwind error borders, and disabled Confirm button.
4. Complete **Phase 5** (User Story 3): Cancellation confirmation dialog.
5. Complete **Phase 6** (Polish): Routing, mobile responsiveness, and Quickstart validation run.
