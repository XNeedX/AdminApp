# Feature Specification: Doctor Profile Backend Integration

**Feature Branch**: `002-doctor-profile-backend-integration`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Обнови существующую реализацию функционала 'Создание профиля врача' (DoctorCreateComponent). UI, форма и локальная валидация уже готовы. Текущая задача — интегрировать форму с нашими микросервисами, работающими в Docker. Требования к интеграции: 1. Запросы должны идти через Gateway API. 2. Данные для выпадающего списка 'Office' (AC-8) должны загружаться с бэкенда (микросервис offices-api). 3. Данные для поля 'Specialization' (F-7) должны загружаться с бэкенда при вводе текста (микросервис services-api). 4. Асинхронная валидация E-mail (F-6) на уникальность должна обращаться к бэкенду. 5. При нажатии на 'Confirm' (AC-4) собранные данные формы должны отправляться на бэкенд (микросервис profiles-api) для создания врача. 6. Загрузка фото (F-1) должна отправляться в blob-storage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live Doctor Profile Submission & Blob Storage Photo Upload (Priority: P1) 🎯 MVP

As a signed-in Receptionist creating a doctor profile, I want my submitted doctor data and attached photo to be sent to the backend microservices through the API Gateway, so that the photo is safely stored in blob storage, the doctor record is persisted in the profiles microservice, and system credentials are automatically generated and emailed to the doctor.

**Why this priority**: Core value of the integration. Connects the user interface directly to the production microservice pipeline, completing the end-to-end operational lifecycle.

**Independent Test**: Can be verified by opening the doctor creation dialog, attaching an image file, entering valid personal and professional details, and clicking "Confirm". The application uploads the binary photo through the documents service, receives the storage identifier, submits the profile payload to the profiles service via the Gateway, and confirms successful creation.

**Acceptance Scenarios**:

1. **Given** a Receptionist selects a doctor photo file, **When** the form is submitted with valid fields, **Then** the image is uploaded to blob storage via the documents microservice through Gateway, returning the stored photo identifier.
2. **Given** all required fields are valid and the photo (if selected) is uploaded, **When** the Receptionist clicks "Confirm", **Then** the profile payload is dispatched to the profiles microservice via Gateway (`POST /profiles/doctors`).
3. **Given** the backend successfully persists the doctor profile, **When** the API response returns success, **Then** the creation modal closes, the Doctors list displays the newly registered doctor, and an automated credentials email is triggered by the backend.
4. **Given** no photo was selected by the Receptionist, **When** "Confirm" is clicked with valid fields, **Then** the profile creation payload is dispatched with `photoPath` as null or omitted, and the profile is created without blob upload.

---

### User Story 2 - Dynamic Catalog Retrieval (Offices & Specializations) (Priority: P2)

As a Receptionist filling in the doctor creation form, I want the "Office" dropdown and "Specialization" combobox to load live operational data from their respective backend microservices via the Gateway, so that I always select valid, up-to-date clinic offices and medical disciplines.

**Why this priority**: Essential for data integrity and accurate doctor assignments. Without live catalogs, doctors cannot be associated with valid physical clinic rooms or active hospital specializations.

**Independent Test**: Can be verified by opening the creation modal and observing the Office dropdown populated with active offices retrieved from `offices-api`, then typing into the Specialization combobox to query and filter active specializations from `services-api`.

**Acceptance Scenarios**:

1. **Given** the doctor creation dialog is initialized, **When** the view loads, **Then** an API request is made via Gateway to `offices-api` (`GET /offices/offices`), and the Office dropdown is populated with available clinic addresses.
2. **Given** the Specialization field is focused, **When** the Receptionist types search keywords, **Then** the combobox retrieves and filters matching medical specializations from `services-api` via Gateway (`GET /services/specialization`).
3. **Given** the user selects an office and a specialization from the dynamically loaded options, **Then** the respective identifiers and display names are bound to the form and ready for submission.

---

### User Story 3 - Asynchronous Backend Email Uniqueness Validation (Priority: P3)

As a Receptionist entering a doctor's email, I want the system to check in real time against the backend whether the email already exists in the system before submission, and gracefully handle server conflict responses, so that duplicate accounts are prevented.

**Why this priority**: Guarantees unique user identities across the hospital authentication and profile domains, alerting staff prior to submission.

**Independent Test**: Can be verified by entering an already registered doctor email and blurring the field. An asynchronous backend check flags the duplicate with "User with this email already exists" and disables "Confirm".

**Acceptance Scenarios**:

1. **Given** the Receptionist types an email address and triggers `blur`, **When** the async validator executes, **Then** it queries the backend via Gateway to verify if the email is already in use.
2. **Given** the backend indicates the email is already registered, **When** validation completes, **Then** the error message "User with this email already exists" is displayed beneath the field and "Confirm" remains disabled.
3. **Given** a race condition where an email is registered between form validation and submission, **When** the backend returns an HTTP 409 Conflict, **Then** the form handles the conflict by displaying the duplicate email error message and re-enabling manual correction.

---

### Edge Cases

- **Gateway / Microservice Unavailability**: If the Gateway API or downstream microservice is down, network requests return appropriate user-facing notifications without breaking the application or losing entered form inputs.
- **Blob Storage Failure**: If the photo upload to the documents microservice fails, the form notifies the user that the image could not be stored and allows retrying or submitting without a photo.
- **Empty Catalog Responses**: If `offices-api` or `services-api` returns an empty list, the dropdown/combobox gracefully displays empty-state guidance (e.g. "No offices available") rather than hanging.
- **Request Timeout / Slow Connections**: Network calls routed through Gateway respect reasonable timeouts; long-running operations display accessible loading indicators on the submit action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All external HTTP requests initiated by the doctor creation workflow MUST route through the central Gateway API upstream endpoints (`/offices/*`, `/services/*`, `/profiles/*`, `/documents/*`).
- **FR-002**: The system MUST fetch active clinic offices from the offices microservice (`GET /offices/offices`) through Gateway and populate the Office dropdown.
- **FR-003**: The system MUST fetch active specializations from the services microservice (`GET /services/specialization`) through Gateway to support dynamic filtering and selection in the Specialization combobox.
- **FR-004**: The system MUST perform asynchronous email uniqueness checks against the backend, verifying that the email is not registered to an existing doctor or patient.
- **FR-005**: If an image is attached, the system MUST upload the image file to the documents microservice (`POST /documents/documents`) as multipart form data before or during profile submission, and retrieve the persistent file identifier.
- **FR-006**: The system MUST serialize and dispatch the completed doctor creation payload to the profiles microservice (`POST /profiles/doctors`) through Gateway, including the assigned specialization, office address, and optional photo reference.
- **FR-007**: The system MUST gracefully process backend validation and conflict responses (such as HTTP 409 Conflict for duplicate emails) and display user-friendly contextual messages without clearing valid inputs.

### Key Entities

- **Doctor Profile Request**: Data payload sent to `profiles-api` containing first name, last name, optional middle name, date of birth, email, specialization name, office address, career start year, status, and optional photo storage path.
- **Office Item**: Representation of a clinic room/location returned by `offices-api` containing unique identifier, office number, full address, and active status.
- **Specialization Item**: Representation of a medical specialty returned by `services-api` containing identifier, name, and operational status.
- **Blob Document Reference**: Storage identifier returned by `documents-api` pointing to the uploaded binary photo in blob storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of network traffic from the doctor creation feature targets the unified Gateway API rather than direct microservice internal ports.
- **SC-002**: Office options and specialization choices reflect real-time backend state, loading within 1.5 seconds on standard local Docker environments.
- **SC-003**: 100% of photo attachments are stored in the documents blob storage, correctly referenced in the created doctor's profile record.
- **SC-004**: Duplicate emails are caught and flagged with zero unhandled runtime exceptions, preventing duplicate account generation in the database.

## Assumptions

- **Gateway Availability**: Gateway API is operational and accessible at its standard configured development port (e.g. `http://localhost:5137` or `http://localhost:5000`).
- **Security & Roles**: The signed-in Receptionist user carries the appropriate role claims (`Receptionist`) in their authentication bearer token for endpoints requiring authorization.
- **Microservice Orchestration**: Backend microservices (`offices-api`, `services-api`, `profiles-api`, `documents-api`) are running inside the Docker network defined in the project infrastructure.
