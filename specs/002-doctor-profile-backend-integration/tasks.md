---
description: "Task list for Doctor Profile Backend Integration"
---

# Tasks: Doctor Profile Backend Integration

**Input**: Design documents from `specs/002-doctor-profile-backend-integration/`
**Prerequisites**: `spec.md`, `plan.md`, `.specify/memory/constitution.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path and clear implementation instructions.

---

## Phase 1: Setup (Shared Infrastructure & OpenAPI Client)

**Purpose**: Establish OpenAPI client integration, environment base URL, and HTTP infrastructure.

- [X] T001 Verify and update auto-generated OpenAPI client and contracts in `AdminApp/src/app/api/` based on backend microservices (`profiles-api`, `offices-api`, `services-api`, `documents-api`)
- [X] T002 [P] Configure API client base URL token with `environment.apiUrl` (`http://localhost:5137`) in `AdminApp/src/app/app.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core HTTP interceptor and notification mechanism for loading and error states.

**⚠️ CRITICAL**: Must be completed before wiring microservice calls into the component.

- [X] T003 [P] Implement functional HTTP error interceptor (`apiErrorInterceptor`) capturing 401, 403, 409, 500 errors in `AdminApp/src/app/core/interceptors/api-error.interceptor.ts`
- [X] T004 [P] Register `provideHttpClient(withInterceptors([apiErrorInterceptor]))` in `AdminApp/src/app/app.config.ts`
- [X] T005 [P] Create unit tests for `apiErrorInterceptor` in `AdminApp/src/app/core/interceptors/api-error.interceptor.spec.ts`

**Checkpoint**: Foundation ready — API client services and interceptor configured.

---

## Phase 3: User Story 1 - Live Doctor Creation & Photo Blob Upload (Priority: P1) 🎯 MVP

**Goal**: Upload doctor photo to `documents-api` via Gateway, map form values to `CreateDoctorDto`, submit to `profiles-api` via Gateway, handle loading indicator and server errors.

**Independent Test**: Attach a photo, fill required doctor data, click "Confirm", verify photo is posted to `/documents/documents`, `photoPath` is passed to `POST /profiles/doctors`, loading spinner is displayed during request, and modal closes upon successful creation.

### Tests for User Story 1

- [X] T006 [P] [US1] Create unit tests for photo blob upload and doctor creation payload mapping in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.spec.ts`

### Implementation for User Story 1

- [X] T007 [US1] Implement photo upload service call sending multipart `file` to `documents-api` via Gateway (`POST /documents/documents`) returning blob file ID in `AdminApp/src/app/api/doctor.service.ts`
- [X] T008 [US1] Update `DoctorCreateComponent` to upload photo before profile creation and inject `photoPath` into `CreateDoctorRequestDto` in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.ts`
- [X] T009 [US1] Connect `DoctorService.createDoctor()` to Gateway endpoint `POST /profiles/doctors` with `CreateDoctorDto` payload in `AdminApp/src/app/api/doctor.service.ts`
- [X] T010 [US1] Add reactive loading spinner state and server error alert banner with Tailwind CSS in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.html`

**Checkpoint**: At this point, User Story 1 is functional as an MVP increment.

---

## Phase 4: User Story 2 - Dynamic Catalog Retrieval (Offices & Specializations) (Priority: P2)

**Goal**: Fetch active offices from `offices-api` via Gateway and dynamic specialization options from `services-api` via Gateway upon user input.

**Independent Test**: Open modal, verify Office dropdown displays items from `GET /offices/offices`, type into Specialization combobox, verify filtered results query `GET /services/specialization`.

### Tests for User Story 2

- [X] T011 [P] [US2] Add unit tests for dynamic offices and specializations retrieval and error handling in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.spec.ts`

### Implementation for User Story 2

- [X] T012 [US2] Update `OfficeService` to fetch paginated offices from Gateway (`GET /offices/offices?Page=1&PageSize=50`) and map to component model in `AdminApp/src/app/api/office.service.ts`
- [X] T013 [US2] Update `SpecializationService` to query specializations from Gateway (`GET /services/specialization?Page=1&PageSize=50`) in `AdminApp/src/app/api/specialization.service.ts`
- [X] T014 [US2] Integrate dynamic search debounce into `DoctorCreateComponent` specialization input in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.ts`

**Checkpoint**: Offices and Specializations load dynamically from live microservices.

---

## Phase 5: User Story 3 - Asynchronous Backend Email Validation & Conflict Handling (Priority: P3)

**Goal**: Validate email uniqueness asynchronously against backend and catch HTTP 409 Conflict gracefully on submission.

**Independent Test**: Enter an existing doctor email and blur; verify backend check flags "User with this email already exists". If 409 Conflict is returned by `profiles-api` on submit, verify error message appears and inputs are preserved.

### Tests for User Story 3

- [X] T015 [P] [US3] Add unit tests for backend email uniqueness check and 409 Conflict handling in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.spec.ts`

### Implementation for User Story 3

- [X] T016 [US3] Connect `DoctorService.checkEmailExists()` to backend Gateway endpoint or doctor filter query in `AdminApp/src/app/api/doctor.service.ts`
- [X] T017 [US3] Handle HTTP 409 Conflict response in `DoctorCreateComponent.onSubmit()` by setting `emailTaken` validation error on email control in `AdminApp/src/app/features/doctors/components/doctor-create/doctor-create.component.ts`

**Checkpoint**: Full end-to-end integration with validation and conflict handling is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification with Docker Gateway and test execution.

- [X] T018 Run full unit test suite with `npm test` verifying all mocked API interactions
- [X] T019 Verify production build with `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Must have generated OpenAPI client or updated contract stubs.
- **Foundational (Phase 2)**: Depends on Phase 1. Blocks user stories.
- **User Story 1 (Phase 3)**: Core MVP creation workflow with Gateway.
- **User Story 2 (Phase 4)**: Catalog loading (can run in parallel with US1).
- **User Story 3 (Phase 5)**: Email validation & 409 Conflict handling.
- **Polish (Phase 6)**: Depends on all user stories.
