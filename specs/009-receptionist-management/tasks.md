---

description: "Task list for Receptionist Management implementation"
---

# Tasks: Receptionist Management

**Feature**: `009-receptionist-management`
**Input**: Design documents from `/specs/009-receptionist-management/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included because [plan.md](./plan.md) R-012 defines Vitest coverage for guards, mappers, stores, the dumb form, the table, and both pages. The spec itself does not mandate a TDD order; test tasks are grouped per story and may be deferred without blocking the implementation tasks.

**Organization**: Tasks are grouped by user story so each story is independently implementable and testable. All paths are relative to the repository root `Frontend/AdminApp/`.

**Blocking prerequisites (from plan.md)**: CG-1 (backend `ReceptionistProfileDto` must expose `id`), CG-2 (receptionist response schemas must be added to the Profiles OpenAPI overlay), CG-3 (a generated Documents client must exist for photos). Backend files MUST NOT be modified.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: `US1`…`US5`, mapping to the priorities in spec.md
- Every task names the exact file path it creates or edits

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the generated transports and feature scaffolding that every story depends on.

- [X] T001 [P] Extend `AdminApp/scripts/augment-profiles-openapi.mjs` with `ReceptionistProfileDTO` (`id` uuid required; `photoPath` string|null; `firstName`; `lastName`; `middleName` string|null; `officeAddress`), `PagedResultOfReceptionistProfileDTO` (`data`, `totalCount`), `ApiResponseOfReceptionistProfileDTO`, and `ApiResponseOfPagedResultOfReceptionistProfileDTO`; rewrite the 200 responses of `GET /api/Receptionists`, `POST /api/Receptionists`, `GET/PUT/DELETE /api/Receptionists/{id}` exactly as specified in `AdminApp/specs/009-receptionist-management/contracts/receptionists-api.contract.md`
- [X] T002 Regenerate the Profiles client with `npm run api:profiles` (run from `AdminApp/`) and verify `AdminApp/src/app/api/generated/profiles/services/receptionists.service.ts` exposes `receptionistsGet`, `receptionistsPost`, `receptionistsIdGet`, `receptionistsIdPut`, `receptionistsIdDelete` returning typed envelopes instead of `void`; this task is blocked until CG-1 (backend `id`) is resolved
- [X] T003 [P] Create `AdminApp/scripts/augment-documents-openapi.mjs` and `AdminApp/ng-openapi-gen.documents.json` (output `src/app/api/generated/documents`, `services: true`, `promises: false`, `module: false`), add `"api:documents": "node scripts/augment-documents-openapi.mjs && ng-openapi-gen --config ng-openapi-gen.documents.json"` to `AdminApp/package.json`, and map upload to `ApiResponseOfGuid` and delete to `ApiResponse`
- [X] T004 Run `npm run api:documents` (from `AdminApp/`) and verify `AdminApp/src/app/api/generated/documents/` contains an upload call taking the multipart `file`, a get call for `{id}`, and a delete call for `{id}`
- [X] T005 [P] Create `AdminApp/src/app/api/documents-api.provider.ts` exporting `provideDocumentsApiConfiguration()` with root URL `${environment.apiUrl}/documents`, following `AdminApp/src/app/api/profiles-api.provider.ts`, and register it in `AdminApp/src/app/app.config.ts` providers

**Checkpoint**: Generated clients are typed and the Documents provider is wired. CG-1 remains the only external blocker.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, guards, catalog, and utilities required by every user story. No story UI work may begin until this phase is complete.

**CRITICAL**: T006–T012 must be complete before starting any user story.

- [X] T006 [P] Create `AdminApp/src/app/features/receptionists/models/receptionist.model.ts` with `ReceptionistProfile` (`id: string` required; `photoPath: string | null`; `firstName: string`; `lastName: string`; `middleName: string | null`; `officeAddress: string`), `ReceptionistRow` (`id`, `fullName`, `officeAddress`, `photoPath`), `ReceptionistView`, `ReceptionistCreatedSummary` (`id`, `fullName`, `officeAddress`), and `OfficeOption` (`id`, `label`); no `I` prefix and no `any`
- [X] T007 [P] Create `AdminApp/src/app/features/receptionists/models/receptionist-form.model.ts` with `ReceptionistFormGroup` using non-nullable controls: `photo: File | null`, `firstName: string` (required, non-blank, `maxLength(100)`), `lastName: string` (required, non-blank, `maxLength(100)`), `middleName: string | null` (`maxLength(100)`), `email: string` (required, email, `maxLength(256)` in create mode; no validators in edit mode), `officeText: string` (required), `officeId: string` (required); export the exact message constants "Please, enter the first name", "Please, enter the last name", "Please, enter the email", "You've entered an invalid email", "User with this email already exists", "Please, choose the office", "Choose a JPEG, PNG or WebP image up to 5 MB"
- [X] T008 [P] Create `AdminApp/src/app/features/receptionists/models/receptionist-dialog.model.ts` exporting `CANCEL_CREATE_DIALOG_MESSAGE = 'Do you really want to cancel? Entered data will not be saved.'`, `CANCEL_EDIT_DIALOG_MESSAGE = 'Do you really want to cancel? Changes will not be saved.'`, `DELETE_DIALOG_MESSAGE = 'Do you really want to delete? Data will be lost.'`, `YES_LABEL = 'Yes'`, `NO_LABEL = 'No'`, and the `ReceptionistCreateDialogResult` type (`{ created: ReceptionistCreatedSummary | null }`)
- [X] T009 [P] Create `AdminApp/src/app/features/receptionists/services/receptionist-contract.guards.ts` with `isReceptionistProfile`, `isPagedReceptionistRows`, `isProfileId`, `isOfficeList`, and `isFileId`; accept `middleName`/`photoPath` as `string | null` or absent, require a non-empty `id`, `firstName`, and `lastName`, require `officeAddress` to be a string (blank is allowed for legacy rows), never use `any`, and follow `AdminApp/src/app/features/doctors/services/doctor-contract.guards.ts`
- [X] T010 [P] Create `AdminApp/src/app/features/receptionists/services/receptionist-catalog.store.ts` as `@Injectable({ providedIn: 'root' })` using the generated `OfficesService` from `AdminApp/src/app/api/generated/appointments/services/offices.service.ts`; expose `offices = signal<readonly OfficeOption[]>([])`, `isLoading`, `loadError`, and `loadOnce()`; parse with `readApiEnvelope` + `isOfficeList`, sort by label with `Intl.Collator`, and cache after the first successful load
- [X] T011 [P] Create `AdminApp/src/app/features/receptionists/utils/receptionist-presentation.ts` with pure helpers `fullName(profile)` (first, last, middle joined by single spaces with the middle name omitted when null), `initials(profile)`, `displayValue(value)` (returns "Not provided" for a missing middle name), `officeLabel(value)` (returns "Not assigned" for a blank office), and `photoUrl(photoPath)` resolving `${environment.apiUrl}/documents/Documents/{photoPath}` or `null`
- [X] T012 [P] Create `AdminApp/src/app/features/receptionists/utils/photo-file.validator.ts` exporting `ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']`, `MAX_PHOTO_BYTES = 5 * 1024 * 1024`, and `validatePhotoFile(file: File): string | null` returning the exact photo message for a wrong type or oversize file and `null` otherwise

**Checkpoint**: Foundation ready. User stories may now proceed; US2–US5 integrate with US1 but their own code can be written against the shared types.

---

## Phase 3: User Story 1 - View the receptionists list (Priority: P1) — MVP

**Goal**: A guarded `/receptionists` page that lists every receptionist with exactly the columns "Full name" and "Office address", a Delete action per row, and a "Create receptionist" action, including loading, empty, and error states.

**Independent Test**: Sign in as a Receptionist, open "Receptionists", and verify the two data columns, a Delete action on every row, the Create action, full-name composition without a middle name gap, the empty state, and reload accuracy.

### Implementation for User Story 1

- [X] T013 [P] [US1] Create `AdminApp/src/app/features/receptionists/services/receptionist-directory.store.ts` with `rows`, `isLoading`, and `loadError` signals and `loadAll()`; call the generated `receptionistsGet({ page, pageSize: 100 })` sequentially up to 50 pages, parse each body with `readApiEnvelope(payload, isPagedReceptionistRows)`, map DTOs to `ReceptionistRow` using `fullName`, guard against overlapping in-flight loads, and use `firstValueFrom` plus `takeUntilDestroyed(DestroyRef)`
- [X] T014 [P] [US1] Create the dumb table `AdminApp/src/app/features/receptionists/components/receptionist-table/receptionist-table.component.ts` and `.html` with signal inputs `rows`, `isLoading`, `loadError`, `deletingId`, outputs `profileRequested` (id), `deleteRequested` (row), `retryRequested`, `OnPush`, and `track row.id`; render exactly the columns "Full name" and "Office address" plus an actions column; every row MUST contain a "Delete" button that calls `stopPropagation`; include the loading state, error state with "Try again", empty state, `aria-label`s, and an `sr-only` `<caption>`
- [X] T015 [US1] Create the smart page `AdminApp/src/app/features/receptionists/pages/receptionists-page/receptionists-page.component.ts` and `.html` with `OnPush`; inject `ReceptionistDirectoryStore`, call `loadAll()` in `ngOnInit`, render the page title (proposed "Receptionists"), the "Create receptionist" button, and `app-receptionist-table`; keep the Create button visible in the empty and error states (its handler is added in T024)
- [X] T016 [P] [US1] Add the lazy route `receptionists` with `loadComponent` for `ReceptionistsPageComponent`, `canActivate: [authGuard, roleGuard('Receptionist')]`, in `AdminApp/src/app/app.routes.ts`, following the existing feature route pattern
- [X] T017 [P] [US1] Add `{ label: 'Receptionists', path: '/receptionists' }` to the role-based nav items computed in `AdminApp/src/app/app.ts` so it appears for users with the `Receptionist` role
- [X] T018 [P] [US1] Write `AdminApp/src/app/features/receptionists/components/receptionist-table/receptionist-table.component.spec.ts` covering the two column headers, a Delete action per row, the profile output, the loading/empty/error states, and the retry output
- [X] T019 [P] [US1] Write `AdminApp/src/app/features/receptionists/services/receptionist-directory.store.spec.ts` covering multi-page accumulation, `totalCount` handling, envelope failure → `loadError`, and no duplicate in-flight requests

**Checkpoint**: US1 is fully functional and independently testable. Rows render and delete buttons exist; navigation and deletion are completed in US3/US5.

---

## Phase 4: User Story 2 - Create a receptionist profile (Priority: P2)

**Goal**: A CDK-hosted creation dialog using the shared dumb form, with the photo pipeline, exact validation, server-side duplicate-email mapping, credentials-email side effects surfaced correctly, and a guarded Cancel confirmation.

**Independent Test**: Open the dialog from the list, verify Confirm is disabled on an empty form, verify every exact inline message on blur, verify invalid/duplicate email blocks submission, create a profile with and without a photo, verify the list refresh and the credentials email, then verify Cancel → No preserves values and Cancel → Yes discards without creating.

### Implementation for User Story 2

- [X] T020 [P] [US2] Create the dumb form `AdminApp/src/app/features/receptionists/components/receptionist-form/receptionist-form.component.ts` and `.html` with `OnPush`, `ReactiveFormsModule`, and signal inputs `form` (required `FormGroup<ReceptionistFormGroup>`), `isEditMode` (default `false`), `offices`, `photoPreview`, `photoError`, `formError`, `isSubmitting`, `canSubmit`; outputs `submitted`, `cancelled`, `photoSelected`, `photoCleared`, `officeSelected`; render photo, first name, last name, middle name, `@if (!isEditMode())` email, and the office `<select>`; primary label is "Confirm" when `isEditMode=false` and "Save changes" when `true`, secondary is "Cancel"; show the exact messages from T007 with red borders, `aria-invalid`, and `aria-describedby`; use Tailwind utilities only, a mobile-first footer, and no services
- [X] T021 [P] [US2] Create `AdminApp/src/app/features/receptionists/services/receptionist-form.mapper.ts` with `toCreateReceptionistRequest(value: ReceptionistFormValue): CreateReceptionistRequest`; trim every text value, map a blank middle name to `null`, copy `photoPath`, and fail loudly on a missing required field; use the generated type from `AdminApp/src/app/api/generated/profiles/models/create-receptionist-request.ts`
- [X] T022 [US2] Create the smart dialog `AdminApp/src/app/features/receptionists/components/receptionist-create-dialog/receptionist-create-dialog.component.ts` and `.html` with `OnPush`; inject `NonNullableFormBuilder`, `DialogRef<ReceptionistCreateDialogResult>`, the generated `ReceptionistsService`, `ReceptionistCatalogStore`, `ReceptionistPhotoService`, `NotificationService`, and `DestroyRef`; build the form with `required`, `nonBlank`, `Validators.email`, `maxLength(100)` for names, `maxLength(256)` for email, and the office controls; bridge status with `toSignal(form.statusChanges.pipe(startWith(form.status)))`; load offices in `ngOnInit`; on submit upload the photo then POST, parse with `readApiEnvelope(payload, isProfileId)`, and close with `{ created: { id, fullName, officeAddress } }`; map HTTP 409 to an `emailTaken` control error; keep values on any failure; ignore repeated submits while `isSubmitting()`; keep email visible because `isEditMode=false`
- [X] T023 [P] [US2] Create `AdminApp/src/app/features/receptionists/services/receptionist-photo.service.ts` wrapping the generated Documents upload/delete calls (no `HttpClient`, no URLs): `upload(file: File): Promise<string>` returning the parsed file id via `readApiEnvelope` + `isFileId`, `delete(id: string): Promise<void>` via `readApiAcknowledgment`, and reuse `photoUrl` from T011
- [X] T024 [US2] Wire the list page `AdminApp/src/app/features/receptionists/pages/receptionists-page/receptionists-page.component.ts` to open `ReceptionistCreateDialogComponent` via CDK `Dialog.open<ReceptionistCreateDialogResult>` with `disableClose: true`, `restoreFocus: true`, `autoFocus: 'first-tabbable'`, `width: 'min(48rem, calc(100vw - 2rem))'`; on `created !== null` show "Receptionist created" via `NotificationService.showSuccess`, then `directory.loadAll()`; add the `(click)` handler to the "Create receptionist" button in the template
- [X] T025 [US2] Implement the no-office state in `AdminApp/src/app/features/receptionists/components/receptionist-form/receptionist-form.component.html` and `AdminApp/src/app/features/receptionists/components/receptionist-create-dialog/receptionist-create-dialog.component.ts`: show the message "Create an office before adding a receptionist." (FR-054, proposed copy) when `offices().length === 0`, keep Confirm disabled, and add the max-length inline messages from `data-model.md` ("{Field} must be 100 characters or fewer", "Email must be 256 characters or fewer")
- [X] T026 [P] [US2] Write `AdminApp/src/app/features/receptionists/components/receptionist-form/receptionist-form.component.spec.ts` asserting email is rendered only when `isEditMode=false`, the exact validation messages, the Confirm/Save changes labels, disabled submit while `canSubmit=false`, and the photo/office output emissions
- [X] T027 [P] [US2] Write `AdminApp/src/app/features/receptionists/services/receptionist-form.mapper.spec.ts` and `AdminApp/src/app/features/receptionists/utils/photo-file.validator.spec.ts` covering trimming, blank middle name → `null`, required-field failures, accepted MIME types, and the 5 MB boundary
- [X] T028 [P] [US2] Write `AdminApp/src/app/features/receptionists/components/receptionist-create-dialog/receptionist-create-dialog.component.spec.ts` covering the empty-form disabled state, successful POST result, 409 → `emailTaken`, failure keeps values, duplicate-submit suppression, and Cancel → Yes/No using `CANCEL_CREATE_DIALOG_MESSAGE`

**Checkpoint**: US2 works independently from the list: create, validation, photo, cancel, and list refresh all pass.

---

## Phase 5: User Story 3 - View a receptionist profile (Priority: P3)

**Goal**: A guarded `/receptionists/:id/profile` page in read-only View mode with photo/placeholder, names, office, and an Edit action, reachable from both the row and the row's profile icon.

**Independent Test**: Open a profile from the row and from the profile icon, verify the photo/placeholder, first/last/middle name ("Not provided" when absent), office ("Not assigned" when blank), the Edit action, that nothing is editable, reload accuracy, the back action, and the not-found state.

### Implementation for User Story 3

- [X] T029 [P] [US3] Create the dumb component `AdminApp/src/app/features/receptionists/components/receptionist-profile-view/receptionist-profile-view.component.ts` and `.html` with `OnPush`, input `profile: ReceptionistProfile | null`, output `edit`; render the photo or initials placeholder, first name, last name, middle name via `displayValue`, office via `officeLabel`, and an "Edit" button; no services and no editable controls
- [X] T030 [US3] Create the smart page `AdminApp/src/app/features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component.ts` and `.html` with `OnPush`; read `id` from `ActivatedRoute.snapshot.paramMap`, call the generated `receptionistsIdGet({ id })`, parse with `readApiEnvelope(payload, isReceptionistProfile)`, and expose `profile`, `isLoading`, and `loadError`; on HTTP 404 show "Receptionist not found." with a back action to `/receptionists`; otherwise show an error message with retry; render `app-receptionist-profile-view` in View mode
- [X] T031 [P] [US3] Add the lazy route `receptionists/:id/profile` with `loadComponent` for `ReceptionistProfilePageComponent`, `canActivate: [authGuard, roleGuard('Receptionist')]`, in `AdminApp/src/app/app.routes.ts`
- [X] T032 [US3] Wire navigation: handle `profileRequested(id)` in `AdminApp/src/app/features/receptionists/pages/receptionists-page/receptionists-page.component.ts` with `router.navigate(['/receptionists', id, 'profile'])`, and ensure `receptionist-table.component.html` emits the same intent for the row click and the profile icon
- [X] T033 [P] [US3] Write `AdminApp/src/app/features/receptionists/components/receptionist-profile-view/receptionist-profile-view.component.spec.ts` covering all displayed fields, the placeholder, "Not provided", "Not assigned", and the `edit` output
- [X] T034 [P] [US3] Write `AdminApp/src/app/features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component.spec.ts` covering load success, 404 message + back action, envelope failure, and that Edit is rendered but no field is editable

**Checkpoint**: US3 is fully functional on top of US1; View mode is read-only and both entry points reach the same route.

---

## Phase 6: User Story 4 - Edit a receptionist profile (Priority: P4)

**Goal**: In-place View ↔ Edit switching driven by `isEditMode = signal(false)`, reusing `ReceptionistFormComponent` with `isEditMode=true` (email hidden), saving through PUT, and confirming Cancel with the exact dialog copy.

**Independent Test**: Enter Edit, verify pre-filled editable fields, no email, "Save changes"/"Cancel", disabled save on an empty required field, save success returns to View with updated values, and Cancel → No preserves edits while Cancel → Yes discards and preserves stored data.

### Implementation for User Story 4

- [X] T035 [US4] Add `readonly isEditMode = signal(false)`, the edit `FormGroup<ReceptionistFormGroup>`, and `enterEdit()` to `AdminApp/src/app/features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component.ts`; `enterEdit()` resets the form from the loaded profile (photo preview URL, names, middle name, office) and sets `isEditMode(true)`; build the email control with no validators and never render it; add `canSubmit` computed from `VALID && !isSaving() && !photoError()`; update the template to render `app-receptionist-form` with `isEditMode=true` and "Save changes"/"Cancel" while in Edit mode
- [X] T036 [US4] Implement `save()` in `AdminApp/src/app/features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component.ts`: upload a newly selected photo first, map values with `toUpdateReceptionistDto`, call `receptionistsIdPut({ id, body })`, validate with `readApiAcknowledgment`, update the `profile` signal with trimmed values, set `isEditMode(false)`, and show "Receptionist updated"; on failure stay in Edit with all values intact, show `formError` and an error toast, and ignore repeated saves while `isSaving()`
- [X] T037 [US4] Implement `cancelEdit()` in `AdminApp/src/app/features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component.ts` using `@angular/cdk/dialog` (reuse `AppDialogService.confirm` + `AppConfirmDialogComponent` or `CancelConfirmDialogComponent`) with exactly `CANCEL_EDIT_DIALOG_MESSAGE` and buttons "Yes"/"No"; Yes resets the form to the stored profile, clears errors, and sets `isEditMode(false)`; No leaves Edit mode and all values untouched
- [X] T038 [P] [US4] Add `toUpdateReceptionistDto(value: ReceptionistFormValue): UpdateReceptionistDto` to `AdminApp/src/app/features/receptionists/services/receptionist-form.mapper.ts`; trim names, map blank middle name to `null`, include `photoPath`, and omit `email` entirely; use the generated type from `AdminApp/src/app/api/generated/profiles/models/update-receptionist-dto.ts`
- [X] T039 [US4] Implement photo replace/remove in Edit mode in `AdminApp/src/app/features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component.ts` and `AdminApp/src/app/features/receptionists/services/receptionist-photo.service.ts`: store the previous `photoPath`, upload a new file before PUT, set `photoPath` to the new id, set it to `null` when the photo is cleared, and after a successful save delete the previous stored photo through `ReceptionistPhotoService.delete` as a best-effort call that never fails the save
- [X] T040 [P] [US4] Write `AdminApp/src/app/features/receptionists/pages/receptionist-profile-page/receptionist-profile-page.component.spec.ts` additions covering View→Edit prefill, absence of the email field, disabled save on an empty first name, PUT success returning to View, Cancel → No, and Cancel → Yes; also extend `receptionist-form.mapper.spec.ts` with the update mapping (no email property)

**Checkpoint**: US4 delivers the full profile workflow; US2's form is reused without duplication and email remains create-only.

---

## Phase 7: User Story 5 - Delete a receptionist (Priority: P5)

**Goal**: Confirmed row deletion through the generated DELETE call, with the exact dialog copy, immediate row removal, failure recovery, and best-effort photo cleanup.

**Independent Test**: Click Delete, verify "Do you really want to delete? Data will be lost." with Yes/No, verify No changes nothing, verify Yes removes the row, the reload keeps it absent, the profile URL shows not found, and the deleted account can no longer sign in.

### Implementation for User Story 5

- [X] T041 [US5] Extend `AdminApp/src/app/features/receptionists/services/receptionist-directory.store.ts` with `deletingId = signal<string | null>(null)` and `delete(id: string): Promise<boolean>`; call `receptionistsIdDelete({ id })`, validate with `readApiAcknowledgment`, remove the row on success, keep it on failure, set `loadError`/return `false` on failure, and ignore a second delete while one is in flight
- [X] T042 [US5] Implement `requestDelete(row)` in `AdminApp/src/app/features/receptionists/pages/receptionists-page/receptionists-page.component.ts` via CDK dialog with exactly `DELETE_DIALOG_MESSAGE` and "Yes"/"No"; on Yes call `directory.delete(row.id)` and show "Receptionist deleted" on success or the extracted error on failure; on No do nothing; bind the table's `deleteRequested` output and `deletingId` input in the page template
- [X] T043 [US5] After a successful profile deletion, call `ReceptionistPhotoService.delete(row.photoPath)` as best-effort cleanup in `AdminApp/src/app/features/receptionists/pages/receptionists-page/receptionists-page.component.ts`; a photo failure MUST NOT restore the row or change the success state, and no photo call is made when `photoPath` is null
- [X] T044 [P] [US5] Write `AdminApp/src/app/features/receptionists/services/receptionist-directory.store.spec.ts` deletion cases (success removes the row, failure keeps it, duplicate delete suppressed) and `AdminApp/src/app/features/receptionists/pages/receptionists-page/receptionists-page.component.spec.ts` dialog cases (exact copy, Yes/No, disabled row while deleting)

**Checkpoint**: All five stories are independently functional; the module is feature-complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates that span multiple stories.

- [X] T045 [P] Accessibility audit across `AdminApp/src/app/features/receptionists/`: dialog focus entry/restore, non-dismissible backdrop, keyboard operable Yes/No, `aria-label` on row actions, `aria-describedby` on field errors, `aria-busy` while submitting, and the table `<caption>`
- [X] T046 [P] Performance audit across `AdminApp/src/app/features/receptionists/`: verify every new component uses `ChangeDetectionStrategy.OnPush`, `track row.id` is used, the directory issues one in-flight load, and a 500-row list renders within the 2-second budget
- [X] T047 [P] Copy audit: confirm every message and button label in the templates matches `AdminApp/specs/009-receptionist-management/contracts/receptionists-ui.contract.md` verbatim, with one exported constant per message
- [X] T048 Run `npm test` and `npm run build` from `AdminApp/`; fix all failures, strict-template errors, and any `any` or manual HTTP violations
- [ ] T049 Run the manual scenarios V-01 through V-07 from `AdminApp/specs/009-receptionist-management/quickstart.md` and record the results
- [X] T050 [P] Add a short note to `AdminApp/README.md` documenting `npm run api:profiles`, `npm run api:documents`, and the CG-1/CG-2/CG-3 prerequisites
- [ ] T051 Verify CG-1/CG-2/CG-3 are closed by inspecting `AdminApp/src/app/api/generated/profiles/` (profile includes `id`, receptionist service returns typed envelopes) and `AdminApp/src/app/api/generated/documents/` (upload/delete exist); if any remains open, stop and request the backend DTO update plus client regeneration instead of adding a workaround
- [X] T052 Traceability audit: confirm every FR-001…FR-057 maps to at least one implemented behavior or task above, and update the checklist in `AdminApp/specs/009-receptionist-management/checklists/requirements.md` with the result

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately. T001/T003 add the OpenAPI overlays; T002/T004 regenerate clients (T002 blocked by CG-1).
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; delivers the MVP.
- **US2 (Phase 4)**: Depends on Foundational for types and on US1 T015/T024 for the dialog entry point; the form, mapper, and photo service can be built in parallel with US1.
- **US3 (Phase 5)**: Depends on US1 (table + page navigation) and on the Foundation guards; independent of US2.
- **US4 (Phase 6)**: Depends on US2 (shared form + mapper) and US3 (profile page + View mode).
- **US5 (Phase 7)**: Depends on US1 (table + page + store) and T023 (photo service) for cleanup.
- **Polish (Phase 8)**: Depends on all stories selected for delivery.

### Story Completion Order

```text
Setup → Foundational → US1 (MVP) → US2 → US3 → US4 → US5 → Polish
```

US2 and US3 may proceed in parallel after US1 if staffed. US4 cannot start before both US2 and US3. US5 can be built after US1.

### Within Each User Story

- Models and guards before stores/services
- Dumb components before the smart host that wires them
- Implementation before the colocated spec
- Story checkpoint validated before moving to the next priority

### Parallel Opportunities

- Setup: T001 and T003 (different scripts); T005 independent of both
- Foundational: T006, T007, T008, T009, T011, T012 are all different files; T010 depends on T006/T009
- US1: T013, T014, T016, T017 in parallel; T015 depends on T013/T014; T018/T019 after their subjects
- US2: T020, T021, T023 in parallel; T022 depends on T020/T021/T023; T024 after T022; T026/T027/T028 after their subjects
- US3: T029 and T031 in parallel; T030 depends on T029; T032 depends on T030; T033/T034 after their subjects
- US4: T038 in parallel with T035; T036/T037/T039 depend on T035
- US5: T041 before T042; T044 after T041/T042
- Polish: T045, T046, T047, T050 can run in parallel

---

## Parallel Example: User Story 1

```text
Task: "T013 Implement ReceptionistDirectoryStore in AdminApp/src/app/features/receptionists/services/receptionist-directory.store.ts"
Task: "T014 Create the dumb ReceptionistTableComponent in AdminApp/src/app/features/receptionists/components/receptionist-table/"
Task: "T016 Add the guarded /receptionists route in AdminApp/src/app/app.routes.ts"
Task: "T017 Add the Receptionists nav item in AdminApp/src/app/app.ts"
```

## Parallel Example: User Story 2

```text
Task: "T020 Create ReceptionistFormComponent in AdminApp/src/app/features/receptionists/components/receptionist-form/"
Task: "T021 Create toCreateReceptionistRequest in AdminApp/src/app/features/receptionists/services/receptionist-form.mapper.ts"
Task: "T023 Create ReceptionistPhotoService in AdminApp/src/app/features/receptionists/services/receptionist-photo.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (resolve CG-1 and generate the typed clients).
2. Complete Phase 2: Foundational.
3. Complete Phase 3: US1.
4. **STOP and VALIDATE**: run V-01 and the US1 specs; demo the directory.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → transports, types, guards, catalog ready.
2. US1 → directory (MVP).
3. US2 → creation with credentials provisioning.
4. US3 → read-only profile.
5. US4 → in-place editing.
6. US5 → confirmed deletion.
7. Polish → accessibility, performance, copy, full validation.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. After US1: Developer A takes US2, Developer B takes US3, Developer C takes US5.
3. US4 starts when US2 and US3 are complete.
4. Polish runs as a final shared pass.

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies.
- [Story] labels map every story task to spec.md priorities for traceability.
- No task modifies `Backend/`; CG-1 is resolved by the backend owner, not by this feature.
- No task may introduce a hand-written HTTP service, DTO, or `any`; all transport goes through generated clients.
- Commit after each task or logical group; validate each story at its checkpoint.
- Suggested MVP scope: **US1 only** (P1), delivering the directory with its states and actions.
- Execution status (2026-11-19): T001–T048, T050, and T052 are complete. `npm run build` passes and the feature suite (`ng test --watch=false --include="src/app/features/receptionists/**/*.spec.ts"`) passes 70/70.
- T002 note: the Profiles client was regenerated and the receptionist operations now return typed envelopes (`ApiResponseOfGuid`, `ApiResponseOfPagedResultOfReceptionistProfileDto`, `ApiResponseOfReceptionistProfileDto`, `ApiResponse`).
- T049 remains open: the V-01–V-07 manual scenarios need a signed-in Receptionist session, seeded data, and a live backend, so they were not executed in this environment.
- T051 remains open: **CG-1** is unresolved. The live Profiles Swagger still exposes no `ReceptionistProfileDto` and no response schema for `GET /api/Receptionists` or `GET /api/Receptionists/{id}`, so the runtime `id` required by list navigation cannot be confirmed. CG-2 and CG-3 are closed (typed receptionist envelopes and a generated Documents upload/delete client exist).
- T051 action: the backend owner must add `id` to the receptionist list/profile DTO and publish typed responses; then re-run `npm run api:profiles`. Do not add a frontend workaround.
