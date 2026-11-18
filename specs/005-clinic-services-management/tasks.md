# Tasks: Clinic Services Management

**Feature**: `005-clinic-services-management` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Input**: Design documents from `/specs/005-clinic-services-management/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. They are not requested by spec.md directly, but [plan.md](./plan.md) §Testing strategy and §Definition of done require green `npm test -- --watch=false` and name these test files, so each story carries its test tasks.

**Organization**: Tasks are grouped by user story so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `US1` Create, `US2` View, `US3` Edit, `US4` Change status
- Every task names an exact file path relative to the repository root `E:\Innowise Project\Frontend\AdminApp\`

## Path Conventions

- Angular app root: `AdminApp/`
- Application source: `AdminApp/src/app/`
- Generated API client: `AdminApp/src/app/api/generated/services/` (never edited by hand)
- Feature folder: `AdminApp/src/app/features/services/`
- Specs: `specs/005-clinic-services-management/`

## Blocking contract note (read before starting)

The live Services API Swagger (`http://localhost:5095/swagger/v1/swagger.json`) has **no response schemas** for the Service endpoints (gap G1), documents `200` for a `201` create (G3), and serializes enums as bare integers (G2). See [contracts/services-api.contract.md](./contracts/services-api.contract.md) §5.

T001 records the state, T002–T004 generate a typed client anyway through a **temporary in-repo OpenAPI augmentation bridge** (a spec overlay, not a hand-written HTTP client). T037 removes the bridge once the backend publishes `[ProducesResponseType]` and enum names. Hand-writing a `service.service.ts` HTTP client is forbidden by the constitution and by the user's plan input.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Produce the generated Services client and confirm the project still builds. No feature UI yet.

- [X] T001 Verify Services API contract readiness for gaps G1–G3: fetch `http://localhost:5095/swagger/v1/swagger.json`, inspect `paths["/api/Service/{id}"].get.responses` and `paths["/api/Service"].post.responses`, and record the outcome (response schemas present or absent, documented create status, enum representation) in `specs/005-clinic-services-management/contracts/services-api.contract.md` §5.
- [X] T002 Create `AdminApp/scripts/augment-services-openapi.mjs` that downloads `http://localhost:5095/swagger/v1/swagger.json`, writes `AdminApp/openapi/services.openapi.json`, and adds the missing response schemas so the client can be typed: `ApiResponseOfViewServiceDTO` (`id: uuid`, `name: string`, `price: number`, `category: $ref Category`, `status: $ref Status`, `specializationId: uuid`) wrapped in the `{ isSuccess, message, errors, data }` envelope for `GET /api/Service/{id}`; `ApiResponseOfGuid` for `POST /api/Service` documented as `201`; `400`/`404` envelope responses for all four operations; and `x-enumNames` (`0=Active,1=Inactive`; `0=Analyses,1=Consultations,2=Diagnostics`). Add a header comment stating the file is a temporary bridge removed by T037.
- [X] T003 Add `ng-openapi-gen` to `devDependencies` in `AdminApp/package.json`, create `AdminApp/ng-openapi-gen.json` (`input: "openapi/services.openapi.json"`, `output: "src/app/api/generated/services"`, `enumStyle: "enum"`, `removeStaleFiles: true`), and add the script `"api:services": "node scripts/augment-services-openapi.mjs && ng-openapi-gen"`.
- [X] T004 Run `npm install` and `npm run api:services` in `AdminApp/`, confirm the generated files exist under `AdminApp/src/app/api/generated/services/`, and record the exact generated service class name plus its create/read/update/status method signatures in `specs/005-clinic-services-management/contracts/services-api.contract.md` §6.
- [X] T005 [P] Create `AdminApp/src/app/api/services-api.provider.ts` exporting `provideServicesApi()` that supplies the generated `ApiConfiguration` with `rootUrl = `${environment.apiUrl}/services`` (Gateway route `/services/{everything}`), and register it in the `providers` array of `AdminApp/src/app/app.config.ts`.
- [X] T006 Baseline verification: `npm run build` and `npm test -- --watch=false` pass in `AdminApp/` with the generated client and the new provider in place.

**Checkpoint**: The generated client is injectable, points at the Gateway, and the project is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared models, validator, and the shared CDK cancel dialog that every story consumes.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 [P] Create `AdminApp/src/app/features/services/models/service.model.ts` with the union types `ServiceStatus = 'Active' | 'Inactive'` and `ServiceCategory = 'Analyses' | 'Consultations' | 'Diagnostics'`; the interfaces `ServiceView` (`id`, `name`, `price`, `category`, `status`, `specializationId`) and `ServiceFormValue` (`name`, `price`, `category`, `status`); and the boundary mappers `toServiceStatus(value: number)` (`0 → Active`, `1 → Inactive`, anything else throws), `toServiceCategory(value: number)` (`0 → Analyses`, `1 → Consultations`, `2 → Diagnostics`, anything else throws), `fromServiceStatus`, `fromServiceCategory`, `toServiceView`, `toCreateServiceRequest(value, specializationId)` and `toUpdateServiceRequest(value)`. No `any`; use the generated DTO/enum types directly.
- [X] T008 [P] Create `AdminApp/src/app/features/services/models/service.model.spec.ts` covering both enum directions for every value, the throwing behaviour on unknown numbers, and DTO conversion including `name.trim()` on create and update.
- [X] T009 [P] Create `AdminApp/src/app/core/validators/positive-price.validator.ts` exporting `positivePriceValidator: ValidatorFn` that returns `{ invalidPrice: true }` for `null`, `NaN`, `Infinity`, values `<= 0`, and values with more than 2 fractional digits, and returns `null` for a valid positive price. Empty input stays with `Validators.required`.
- [X] T010 [P] Create `AdminApp/src/app/core/validators/positive-price.validator.spec.ts` covering `null`, `0`, `-5`, `NaN`, `Infinity`, `0.001`, `12.345`, `12.34`, and `1`.
- [X] T011 [P] Create `AdminApp/src/app/features/services/models/service-form.model.ts` with `ServiceFormControls` (`name: FormControl<string>`, `price: FormControl<number | null>`, `category: FormControl<ServiceCategory | ''>`, `status: FormControl<ServiceStatus>`), `SERVICE_CATEGORY_OPTIONS` (exactly `Analyses`, `Consultations`, `Diagnostics`, no default) and `SERVICE_STATUS_OPTIONS` (exactly `Active`, `Inactive`).
- [X] T012 [P] Create the shared dumb dialog `AdminApp/src/app/shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component.ts` and `.html`: standalone, `OnPush`, injects `DIALOG_DATA` (`{ message: string; confirmText?: string; cancelText?: string }`) and `DialogRef<boolean>`, closes `true` on "Yes" and `false` on "No", defaults to `Yes`/`No`, message paragraph id `cancel-confirm-dialog-message`, Tailwind-only markup, focus-visible rings, no business logic.
- [X] T013 [P] Create `AdminApp/src/app/shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component.spec.ts` asserting the custom message renders, the default button labels are "Yes"/"No", and each button closes the `DialogRef` with the correct boolean.
- [X] T014 Migrate the profile feature to the shared dialog: update `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.ts` to open `CancelConfirmDialogComponent` with `CANCEL_EDIT_DIALOG_MESSAGE` and delete `AdminApp/src/app/features/profile/components/cancel-edit-dialog/`; update `AdminApp/src/app/features/profile/pages/profile-page/profile-page.component.spec.ts` if it references the removed component.
- [X] T015 Checkpoint: run `npm run build` and `npm test -- --watch=false` in `AdminApp/` after the model, validator, and shared-dialog work; both must pass before any user story starts.

**Checkpoint**: Shared models, the price validator, and the CDK cancel dialog are ready; user stories can start.

---

## Phase 3: User Story 1 - Create a service (Priority: P1) — MVP

**Goal**: A Receptionist opens the "Add service" modal from the Specialization info page, fills name/price/category/status (default "Active"), creates the service, and gets the exact cancel-confirmation behaviour.

**Independent Test**: Open the create form; blur every required field and confirm the three exact messages with red borders and a disabled "Confirm"; enter `0`, `-5`, `abc`, `12.345` and confirm "You've entered an invalid price"; enter valid values and confirm the service is created; click "Cancel" → "No" and confirm the data survives; click "Cancel" → "Yes" and confirm the previous page is shown and nothing was created.

### Implementation for User Story 1

- [X] T016 [P] [US1] Create the dumb reusable form `AdminApp/src/app/features/services/components/service-form/service-form.component.ts`: standalone, `OnPush`, imports only `ReactiveFormsModule`; signal inputs `mode` (`'create' | 'edit'`, default `'create'`), `initialValue` (`ServiceFormValue | null`, default `null`), `submitting` (default `false`); signal outputs `submitted` (`ServiceFormValue`) and `cancelled` (`void`); typed `FormGroup<ServiceFormControls>` with `name` (`nonNullable`, `Validators.required`, `Validators.maxLength(100)`), `price` (`Validators.required` + `positivePriceValidator`), `category` (`nonNullable`, `Validators.required`, default `''`), `status` (`nonNullable`, default `'Active'`); pre-fill from `initialValue` in `ngOnInit` and re-sync through an `effect()`; emit `getRawValue()` with `name` trimmed; no API/router/dialog/notification injection.
- [X] T017 [P] [US1] Create `AdminApp/src/app/features/services/components/service-form/service-form.component.html` with Tailwind classes: labelled name (text), price (number, `step="0.01"`), category `<select>` bound to `SERVICE_CATEGORY_OPTIONS`, status radio group from `SERVICE_STATUS_OPTIONS`; red border and message only when `control.touched && control.invalid`; messages exactly "Please, enter the name", "Please, enter the price", "You've entered an invalid price", "Please, choose the service category" (the price branch chooses `required` before `invalidPrice`); error text in `role="alert"` nodes wired with `aria-describedby`; footer renders "Confirm" + "Cancel" when `mode === 'create'` and "Save changes" + "Cancel" when `mode === 'edit'`; submit disabled when `form.invalid || submitting`; responsive `sm:`/`md:` layout.
- [X] T018 [US1] Create `AdminApp/src/app/features/services/components/service-form/service-form.component.spec.ts` covering: status defaults to `Active`; errors hidden before blur and shown after blur; all four exact messages; `0`, `-5`, `NaN` and `12.345` produce `invalidPrice`; `12.34` is valid; "Confirm"/"Save changes" disabled while invalid and enabled when valid; `submitting` disables both footer buttons; emitted `name` is trimmed.
- [X] T019 [US1] Create the smart dialog host `AdminApp/src/app/features/services/dialogs/service-create-dialog/service-create-dialog.component.ts`: standalone, `OnPush`; injects the generated Services client, `DialogRef<ServiceCreateDialogResult | null>`, `DIALOG_DATA` (`{ specializationId: string }`), `Dialog`, `NotificationService`, `DestroyRef`; `submitting` signal; on `submitted` guard against re-entry, call the generated create operation with `toCreateServiceRequest(value, specializationId)`, close with `{ id }` on success, and on failure keep the dialog open with data preserved and show `extractErrorMessage` from `AdminApp/src/app/core/interceptors/api-error.interceptor.ts` via a toast; on `cancelled` open `CancelConfirmDialogComponent` with "Do you really want to cancel? Entered data will not be saved." and close the create dialog with `null` only on `true`; all subscriptions use `takeUntilDestroyed`.
- [X] T020 [US1] Create `AdminApp/src/app/features/services/dialogs/service-create-dialog/service-create-dialog.component.html` hosting `<app-service-form mode="create" [submitting]="submitting()" (submitted)="onSubmitted($event)" (cancelled)="onCancelled()" />` inside a Tailwind modal card with a title and an `aria-labelledby` target id.
- [X] T021 [US1] Create `AdminApp/src/app/features/services/dialogs/service-create-dialog/service-create-dialog.component.spec.ts` with a typed stub of the generated client: successful create closes with `{ id }`; failed create keeps the dialog open, preserves the form value, and calls `NotificationService.showError`; "Cancel" → "Yes" closes with `null`; "Cancel" → "No" keeps the dialog; a second submit while in flight is ignored.
- [X] T022 [US1] Create `AdminApp/src/app/features/services/utils/open-service-create-dialog.ts` exporting `openServiceCreateDialog(dialog: Dialog, specializationId: string): Observable<ServiceCreateDialogResult | null>` that calls `dialog.open<ServiceCreateDialogResult | null, ServiceCreateDialogData>(ServiceCreateDialogComponent, { data: { specializationId }, disableClose: true, ariaLabelledBy: 'service-create-dialog-title', restoreFocus: true })` and returns `closed`.
- [X] T023 [US1] Wire the "Add service" action into the prerequisite Specialization info page: call `openServiceCreateDialog(dialog, specializationId)` and reload that page's service list when the emitted result is non-null. The page does not exist in AdminApp yet — if it is still absent, record the blocker in `specs/005-clinic-services-management/contracts/component-contracts.md` §5 and leave this task open instead of creating a substitute page.
  - Status (2026-11-15): the prerequisite surface exists as `AdminApp/src/app/features/services/pages/services-page/services-page.component.ts` (route `/services`, guarded by `roleGuard('Receptionist')`, "Services" header nav entry). `openCreate()` calls `openServiceCreateDialog(dialog, selectedSpecializationId())` and reloads the specialization's services when the result is non-null. Covered by `services-page.component.spec.ts` ("opens the create dialog for the selected specialization and reloads after creation", "does not open the create dialog without a selected specialization").

**Checkpoint**: The form and create dialog are complete and unit-tested; creation is wired end to end through the `/services` page's "Add service" action.

---

## Phase 4: User Story 2 - View service information (Priority: P2)

**Goal**: `/services/:id` shows name, price, category, and status read-only, with an "Edit" button and no editable fields until Edit is activated.

**Independent Test**: Navigate to `/services/:id` for an existing service and verify all four values render read-only, the "Edit" button exists, and an Inactive service is displayed with its status instead of being hidden.

### Implementation for User Story 2

- [X] T024 [US2] Add the route `{ path: 'services/:id', canActivate: [roleGuard('Receptionist')], loadComponent: () => import('./features/services/pages/service-info/service-info.component').then((m) => m.ServiceInfoComponent) }` inside the authenticated children of `AdminApp/src/app/app.routes.ts`.
- [X] T025 [US2] Create the smart page `AdminApp/src/app/features/services/pages/service-info/service-info.component.ts`: standalone, `OnPush`; injects the generated Services client, `ActivatedRoute`, `Router`, `Dialog`, `NotificationService`, `DestroyRef`; signals `service` (`ServiceView | null`), `isEditMode` (`false`), `isLoading`, `isSaving`, `statusSaving`, `loadError`; loads the service by route id on init through `toServiceView` with `takeUntilDestroyed`; maps `404` to the message "Service not found." and exposes a `retry()` method; renders nothing editable while `isEditMode()` is `false`.
- [X] T026 [US2] Create `AdminApp/src/app/features/services/pages/service-info/service-info.component.html` with Tailwind: loading state, error state with a retry button, and a read-only definition list for name, price, category label, and status plus an "Edit" button; responsive `sm:`/`md:` layout; the "Edit" button is visible in View mode.
- [X] T027 [US2] Create `AdminApp/src/app/features/services/pages/service-info/service-info.component.spec.ts` with a typed stub of the generated client: load success renders name/price/category/status and the "Edit" button; an `HttpErrorResponse` with status 404 renders "Service not found." and the retry action re-requests; an Inactive service still renders with `Inactive`; no input/select elements are present in View mode.
- [X] T028 [US2] Wire service-row navigation into the prerequisite Specialization info page so each row routes to `/services/:id`. If the page is still absent, record the blocker in `specs/005-clinic-services-management/contracts/component-contracts.md` §5 and leave this task open.
  - Status (2026-11-15): `ServicesPageComponent` renders a "View" action per row that calls `openService(id)` → `router.navigate(['/services', id])`. Covered by `services-page.component.spec.ts` ("navigates to the service information page").

**Checkpoint**: The information page is reachable by URL and fully read-only; US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Edit service information (Priority: P3)

**Goal**: "Edit" switches the page to Edit mode with a pre-filled reusable form, "Save changes" persists via PUT and returns to View, and "Cancel" asks for confirmation with the exact message.

**Independent Test**: Open a service, click "Edit", verify pre-filled fields and the "Save changes"/"Cancel" footer, clear the name and verify the message on blur plus a disabled "Save changes", save valid values and verify View mode shows them, then "Cancel" → "No" keeps edits and "Cancel" → "Yes" restores the stored values.

### Implementation for User Story 3

- [X] T029 [US3] Extend `AdminApp/src/app/features/services/pages/service-info/service-info.component.ts`: add `enterEdit()` that sets `isEditMode(true)`; `onSubmitted(value)` that guards on `isSaving()`, sets `isSaving`, calls the generated update operation with `toUpdateServiceRequest(value)`, on success updates `service` with the saved values, sets `isEditMode(false)`, and shows a success toast, and on failure keeps Edit mode, preserves the entered values, shows an error toast via `extractErrorMessage`, and clears `isSaving`; `onCancelled()` that opens `CancelConfirmDialogComponent` with "Do you really want to cancel? Changes will not be saved." and on `true` sets `isEditMode(false)` without saving while `false` changes nothing.
- [X] T030 [US3] Extend `AdminApp/src/app/features/services/pages/service-info/service-info.component.html` so Edit mode replaces the read-only block with `<app-service-form mode="edit" [initialValue]="service()" [submitting]="isSaving()" (submitted)="onSubmitted($event)" (cancelled)="onCancelled()" />`, keeping the same Tailwind card layout.
- [X] T031 [US3] Extend `AdminApp/src/app/features/services/pages/service-info/service-info.component.spec.ts`: "Edit" renders the form pre-filled with the loaded values and the "Save changes"/"Cancel" footer; invalid form keeps "Save changes" disabled; successful save sends the PUT body and returns to View with the new values without reloading; failed save keeps Edit mode with the values intact, shows an error toast, and allows retry; "Cancel" → "No" keeps Edit mode and the edits; "Cancel" → "Yes" returns to View with the original values and sends no request; a second submit while `isSaving` is ignored; saving with unchanged values succeeds.

**Checkpoint**: Create, View, and Edit all work; the same form component is reused in both modes.

---

## Phase 6: User Story 4 - Change a service's status (Priority: P4)

**Goal**: In View mode the status radio group calls the status operation immediately, persists the new value, and rolls back with an error toast if the call fails.

**Independent Test**: On `/services/:id` switch the status to "Inactive" and verify the change persists after reload and hides the service from patient-facing views; switch back to "Active" and verify it reappears; stop the Services API, switch the status, and verify the radio rolls back with an error toast.

**Note**: spec.md assumption "In View mode the status … is not changeable until Edit is activated" contradicts US4 and the user's plan input requiring an immediate API call. The approved [plan.md](./plan.md) resolves this in favour of US4: View mode PATCHes immediately; Edit mode submits status through PUT.

### Implementation for User Story 4

- [X] T032 [US4] Extend `AdminApp/src/app/features/services/pages/service-info/service-info.component.ts` with `changeStatus(next: ServiceStatus)`: return immediately when `next` equals the current status (no request, no toast); otherwise store the previous value, set `service` optimistically, set `statusSaving`, call the generated status operation with `{ status: fromServiceStatus(next) }`, and on success show a success toast and clear `statusSaving`; on failure restore the previous status, show an error toast via `extractErrorMessage`, and clear `statusSaving`; ignore changes while `statusSaving()` is `true`.
- [X] T033 [US4] Extend `AdminApp/src/app/features/services/pages/service-info/service-info.component.html` so View mode renders the status as an accessible radio group (`role="radiogroup"` or `<fieldset>`/`<legend>`) with exactly "Active" and "Inactive", `[disabled]="statusSaving()"`, and `(change)="changeStatus($event)"`; the group is not rendered inside the edit form.
- [X] T034 [US4] Extend `AdminApp/src/app/features/services/pages/service-info/service-info.component.spec.ts`: changing the status sends the status operation immediately with the mapped numeric value; the UI reflects the new value before the response resolves; a failure restores the previous value and shows an error toast; selecting the already-set status sends no request and shows no toast; a change during `statusSaving` is ignored; after a successful change the page shows the new status without a reload.

**Checkpoint**: All four user stories are functional and independently verifiable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, responsiveness, cleanup of the temporary bridge, and final verification.

- [X] T035 [P] Accessibility pass over `AdminApp/src/app/features/services/components/service-form/service-form.component.html`, `AdminApp/src/app/features/services/pages/service-info/service-info.component.html`, and `AdminApp/src/app/features/services/dialogs/service-create-dialog/service-create-dialog.component.html`: every control has a `<label for>`, invalid controls carry `aria-invalid` and `aria-describedby`, messages use `role="alert"`, the status group has an accessible name, and all actions are keyboard operable.
- [X] T036 [P] Responsive Tailwind pass over `AdminApp/src/app/features/services/components/service-form/service-form.component.html`, `AdminApp/src/app/features/services/pages/service-info/service-info.component.html`, and `AdminApp/src/app/features/services/dialogs/service-create-dialog/service-create-dialog.component.html`: verify `sm:`/`md:` breakpoints, no horizontal scrolling at 360 px, and consistent button sizing across the form, dialog, and page.
- [ ] T037 Remove the temporary OpenAPI bridge once the backend publishes typed responses and enum names: delete `AdminApp/scripts/augment-services-openapi.mjs` and `AdminApp/openapi/services.openapi.json`, point `AdminApp/ng-openapi-gen.json` at `http://localhost:5095/swagger/v1/swagger.json`, update `AdminApp/package.json` `api:services`, regenerate the client, and update `specs/005-clinic-services-management/contracts/services-api.contract.md` §5–§6. Keep this task open while gaps G1–G3 remain.
  - Status (2026-11-15): re-run attempted; the Services API was not running (`http://localhost:5095/swagger/v1/swagger.json` unreachable), so G1–G3 could not be re-verified and the client could not be regenerated from the live definition. The overlay bridge stays in place; keep open.
- [X] T038 Run `npm run build` and `npm test -- --watch=false` in `AdminApp/` and fix every failure; no `any`, no `NgModule`, `OnPush` on every new component.
- [ ] T039 Execute the manual scenarios in `specs/005-clinic-services-management/quickstart.md` §4.1-§4.6 against the running stack (Keycloak, Services API, Gateway) and record the outcome per scenario.
  - Status (2026-11-12): environment checks pass and the outcome is recorded in `quickstart.md` §7. All scenarios are verified at component level (149 tests); the remaining browser steps are blocked by the missing specialization page (T023/T028) and the need for a signed-in session. Keep open until those are executed.
  - Status (2026-11-15): the entry points now exist (`/services` page, T023/T028 closed), so only a signed-in browser session against the running stack is still required. The stack was not running during this pass (Services API on `http://localhost:5095` unreachable), so no browser scenario was executed. Unit suite is green at 22 files / 159 tests.
  - Status (2026-11-15, follow-up check): the stack was reachable (Keycloak `200`, Services API `200`, Gateway `401`/`405` without a token). API-level end-to-end through the Gateway with a real `testreceptionist` token passed: create `201` + `ApiResponse<Guid>`, read `200`, update `204` (including changed values), status `204` with persistence, `404`/`400` error envelopes, CORS preflight for `http://localhost:4200` for GET/POST/PUT/PATCH, and the patient catalog (`/api/Service/by-category/{category}`) hiding an Inactive service while showing it when Active. `npm run api:services` regenerated the client from the live definition (17 models / 2 services) and the suite stayed green. Browser UI interaction (§4.1–§4.6) is still not executed — keep open for the signed-in browser pass.
- [X] T040 Update `specs/005-clinic-services-management/contracts/services-api.contract.md` §5 gap status, `specs/005-clinic-services-management/plan.md` §Definition of done, and `specs/005-clinic-services-management/contracts/component-contracts.md` §5 integration status to match what was actually delivered.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately. T001 must be recorded before T002.
- **Foundational (Phase 2)**: depends on T006 — BLOCKS all user stories.
- **User Stories (Phase 3+)**: all depend on Phase 2.
  - **US1** is independent of US2–US4.
  - **US2** is independent of US1 (different files) but must precede US3 and US4 because they extend the same page.
  - **US3** depends on US1 (`ServiceFormComponent`) and US2 (`ServiceInfoComponent`, route).
  - **US4** depends on US2 (same page); it is independent of US3's save flow.
- **Polish (Phase 7)**: depends on all delivered stories.

### Task-level graph

```text
T001 ──> T002 ──> T003 ──> T004 ──┬──> T005 ──> T006 ──> Phase 2 (T007–T015)
                                  │
                                  └──> (T004 records generated method names)

T007 ─┬─> T015
T008 ─┤
T009 ─┤
T010 ─┤
T011 ─┤
T012 ─┤
T013 ─┤
T014 ─┘

T015 ──> T016 ──> T017 ──> T018 ──┬──> T019 ──> T020 ──> T021 ──> T022 ──> T023   [US1]
                                  │
T015 ──> T024 ──> T025 ──> T026 ──> T027 ──> T028                                  [US2]

T021 + T027 ──> T029 ──> T030 ──> T031                                            [US3]
T027 ──────────> T032 ──> T033 ──> T034                                            [US4]

T034 ──> T035/T036 (parallel) ──> T038 ──> T039 ──> T040
T037 (blocked by backend G1–G3) ─────────────────────┘
```

### Within each user story

- Form/component class before its template, template before its spec.
- Model and validator before any component that consumes them.
- Story complete and its tests green before moving to the next priority.

### Parallel Opportunities

- **Phase 1**: T005 is `[P]` relative to T004's output once generation is done; T001–T004 are sequential.
- **Phase 2**: T007, T009, T011, T012 can be written concurrently; T008, T010, T013 run alongside their subjects; T014 is independent of T007–T013.
- **US1**: T016 and T017 can be authored together, then T018; T019/T020/T021 form a chain; T022 depends on T019.
- **US1 vs US2**: with two developers, US1 (T016–T023) and US2 (T024–T028) touch disjoint files and can run in parallel after T015.
- **Polish**: T035 and T036 are independent.

---

## Parallel Example: User Story 1

```text
# After T015, start the dumb form and the shared plumbing together:
Task: "Create service-form.component.ts in AdminApp/src/app/features/services/components/service-form/"
Task: "Create service-form.component.html in AdminApp/src/app/features/services/components/service-form/"

# Then the dialog chain:
Task: "Create service-create-dialog.component.ts in AdminApp/src/app/features/services/dialogs/service-create-dialog/"
Task: "Create service-create-dialog.component.html in AdminApp/src/app/features/services/dialogs/service-create-dialog/"
```

## Parallel Example: Phase 2

```text
Task: "Create service.model.ts in AdminApp/src/app/features/services/models/"
Task: "Create positive-price.validator.ts in AdminApp/src/app/core/validators/"
Task: "Create service-form.model.ts in AdminApp/src/app/features/services/models/"
Task: "Create cancel-confirm-dialog.component.ts/.html in AdminApp/src/app/shared/components/cancel-confirm-dialog/"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (generated client) and Phase 2 (models, validator, shared dialog).
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: run `service-form` and `service-create-dialog` specs, plus the manual §4.1 checks from quickstart.md.
4. The create flow is fully clickable through the `/services` page's "Add service" action (T023, delivered).

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate → demo creation (MVP).
3. US2 → validate `/services/:id` → demo the read-only record.
4. US3 → validate edit/save/cancel → demo the full edit loop.
5. US4 → validate immediate status change and rollback → demo the lifecycle.
6. Polish → a11y, responsiveness, bridge removal, quickstart run.

### Parallel Team Strategy

- Developer A: US1 (form + create dialog + opener).
- Developer B: US2 (route + information page) in parallel after Phase 2.
- Then A and B pair on US3 (A: form reuse, B: page save/cancel), and B takes US4 (same page).

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependency.
- No task may create a hand-written HTTP service, DTO, or model: API access is only through `AdminApp/src/app/api/generated/services/`.
- Exact user-facing strings are authoritative: "Please, enter the name", "Please, enter the price", "You've entered an invalid price", "Please, choose the service category", "Do you really want to cancel? Entered data will not be saved.", "Do you really want to cancel? Changes will not be saved.", and the buttons "Confirm", "Cancel", "Save changes", "Edit", "Add service", "Yes", "No".
- Validation constraints: name trimmed and at most 100 characters; price finite, `> 0`, at most 2 fractional digits; category has no default; status defaults to `Active`.
- API enum values are integers: Status `0=Active`, `1=Inactive`; Category `0=Analyses`, `1=Consultations`, `2=Diagnostics`.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
