# Phase 0 Research: Receptionist Management

**Feature**: `009-receptionist-management`
**Date**: 2026-11-19
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## R-001 — Context7 lookup for CDK dialog data injection

**Decision**: Follow the verified in-repository CDK pattern for standalone dialogs and use `inject(DIALOG_DATA)` only in dialogs that receive a payload.

**Evidence from the project**:
- `src/app/shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component.ts` is a standalone `OnPush` component that injects `DialogRef<boolean>` and `DIALOG_DATA` via `inject(...)`, and is opened with `Dialog.open<boolean, CancelConfirmDialogData>(...)`.
- `src/app/shared/components/app-dialog/app-confirm-dialog.component.ts` follows the same pattern and is wrapped by `AppDialogService.confirm(...)`, which configures `autoFocus`, `restoreFocus`, `disableClose`, backdrop, and panel classes.
- `src/app/features/doctors/components/doctor-create-dialog/doctor-create-dialog.component.ts` injects `DialogRef<DoctorCreateDialogResult>` and closes with a typed result.

**Why this matters for this feature**: the create dialog receives no injected payload (it starts empty), so it only needs `DialogRef`. The three confirmation dialogs (create cancel, edit cancel, delete) receive `{ title, message, confirmText, cancelText }` through `DIALOG_DATA` via the shared `AppDialogService`/`AppConfirmDialogComponent`. No new dialog infrastructure is required.

**Context7 status**: The required `context7` lookup was attempted twice during planning: `resolve-library-id` for "Angular CDK" with a query about injecting `DIALOG_DATA` into standalone components, and `query-docs` against `/angular/components` for the same topic. Both returned: "Monthly quota exceeded. Create a free API key at https://context7.com/dashboard for more requests." No documentation could be retrieved. The fallback is the project-local pattern above, which is already compiled and tested against the installed `@angular/cdk` 21.2.14. This limitation is recorded here so the reviewer can re-run the lookup when quota is available.

**Alternatives considered**:
- Inject `DIALOG_DATA` in every dialog, even when no data is passed — rejected as unnecessary and would require a dummy provider in tests.
- Build a new receptionist-specific confirmation component — rejected; the shared CDK dialog already provides focus trapping, Escape handling, and exact-copy support.

## R-002 — Generated API client reality and regeneration

**Decision**: Keep `ReceptionistsService` as the only receptionist transport, but regenerate it from an augmented OpenAPI definition before integration.

**Findings (read-only inspection)**:
- `src/app/api/generated/profiles/services/receptionists.service.ts` exposes `receptionistsGet`, `receptionistsPost`, `receptionistsIdGet`, `receptionistsIdPut`, `receptionistsIdDelete`.
- Every operation is typed `Observable<void>`; the generated functions use `responseType: 'text'` and then `.clone({ body: undefined })`, so the response body is discarded at runtime.
- `scripts/augment-profiles-openapi.mjs` currently adds response schemas only for doctors, patients, and guid acknowledgments. It does not declare receptionist schemas or rewrite the receptionist operations.
- The backend controller (`Backend/ProfilesAPI/.../ReceptionistsController.cs`) returns `ApiResponse<Guid>` on create, `ApiResponse<PagedResult<ReceptionistProfileDto>>` on list, `ApiResponse<ReceptionistProfileDto>` on read, and `ApiResponse` acknowledgments on update/delete.

**Implementation consequence**: extend the existing overlay with:
- `ReceptionistProfileDTO` (`id`, `photoPath`, `firstName`, `lastName`, `middleName`, `officeAddress`)
- `PagedResultOfReceptionistProfileDTO`
- `ApiResponseOfReceptionistProfileDTO`, `ApiResponseOfPagedResultOfReceptionistProfileDTO`
- `ApiResponseOfGuid` (already present)
- response rewrites for `GET/POST /api/Receptionists` and `GET/PUT/DELETE /api/Receptionists/{id}`

Then run `npm run api:profiles`. Feature code is unchanged by the exact generated method names; the current names are already correct.

**Alternatives considered**:
- Hand-written HTTP service around the generated client — forbidden by the constitution and by the feature brief.
- Consuming the raw body through `HttpClient` directly — same violation, and duplicates the generated path/query handling.
- Using the existing `void` client and relying on side effects — impossible, the body is discarded.

## R-003 — Blocking contract gap: missing receptionist id

**Decision**: Treat the missing `id` in `ReceptionistProfileDto` as a blocking backend contract gap (CG-1). Design the UI against a corrected DTO and do not invent a client-side identity.

**Findings**:
- `Backend/ProfilesAPI/.../DTOs/ReceptionistProfileDto.cs` contains only `PhotoPath`, `FirstName`, `LastName`, `MiddleName`, `OfficeAddress`.
- `ReceptionistService.GetAllPagedAsync` maps every entity through that DTO, so list rows carry no identity.
- `ReceptionistService.GetReceptionistAsync` uses the route id, so the profile page itself can be loaded once the user has an id.
- Without an id in list rows, the app cannot navigate to a profile, delete a row, or track rows reliably.

**Required resolution**: Profiles API adds `Guid Id` to `ReceptionistProfileDto` (and emits it in the list and read responses), then the frontend regenerates the Profiles client. The frontend guard `isReceptionistProfile` will require a non-empty `id`.

**Alternatives considered**:
- Use the account id — not returned by the DTO either.
- Use array index or full name as identity — unsafe and cannot address delete/read endpoints.
- Add a separate lookup endpoint — still requires backend work and adds a round trip; fixing the DTO is smaller and matches the doctor table pattern (`DoctorTableRowDTO` already exposes `id`).

## R-004 — Shared dumb form with `isEditMode`

**Decision**: Implement one `ReceptionistFormComponent` used by the create dialog and the profile edit page. It receives the host-owned `FormGroup` and an `isEditMode` signal input; it injects no services and performs no transport.

**Design**:
- Inputs: `form`, `isEditMode`, `offices`, `photoPreview`, `photoError`, `formError`, `isSubmitting`, `canSubmit`.
- Outputs: `submitted`, `cancelled`, `photoSelected`, `officeSelected`.
- `isEditMode=false`: email is rendered, required, and validated.
- `isEditMode=true`: email is not rendered at all (per the feature brief), and the form's email control has no validators, so it cannot block saving.
- Labels: primary button is `Confirm` in create mode and `Save changes` in edit mode; Cancel is always present.
- Validation messages are computed by the dumb component from control errors, using exact spec copy.

**Why a host-owned FormGroup**: validation differs per mode (email required only on create), and both hosts already own their submit/cancel logic. This is the same proven pattern as `DoctorFormComponent`.

**Alternatives considered**:
- A form component that builds its own `FormGroup` — creates two sources of truth for values and makes mode-specific validators harder.
- Two separate forms — explicitly rejected by the brief and duplicates markup.

## R-005 — View/Edit state with Signals

**Decision**: Use `readonly isEditMode = signal(false)` in `ReceptionistProfilePageComponent`, plus a `profile` signal and a `computed` submit state.

**Behavior**:
- `enterEdit()` resets the form from the loaded profile and sets `isEditMode(true)`.
- `cancelEdit()` opens the CDK confirmation; on Yes it resets the form and sets `isEditMode(false)`; on No nothing changes.
- Save success sets the profile signal with the new values, closes edit mode, and shows a toast.
- Form status is bridged with `toSignal(this.form.statusChanges.pipe(startWith(this.form.status)))`; no `AsyncPipe` and no manual status polling.

**Alternatives considered**:
- A boolean field on the profile model — loses the clear render boundary and makes `OnPush` updates less explicit.
- Separate routes for view/edit — not requested and complicates cancel semantics.

## R-006 — CDK dialogs for cancel and delete

**Decision**: Reuse `AppDialogService.confirm(...)` backed by `AppConfirmDialogComponent` for all three confirmations.

**Copy contract**:
- Create cancel: "Do you really want to cancel? Entered data will not be saved." — Yes returns to `/receptionists`, No stays.
- Edit cancel: "Do you really want to cancel? Changes will not be saved." — Yes returns to View mode, No stays in Edit.
- Delete: "Do you really want to delete? Data will be lost." — Yes deletes and removes the row, No closes.

**Configuration**: `disableClose: true`, `autoFocus: 'first-tabbable'`, `restoreFocus: true`, shared backdrop and panel classes. Escape resolves to `false` (never silently discards or deletes).

**Difference from the doctor dialog**: the doctor create dialog skips the cancel prompt when the form is pristine. This feature's acceptance criteria require the prompt on every Cancel activation, so the receptionist flows always confirm.

**Alternatives considered**:
- `window.confirm` — violates the CDK requirement and accessibility standards.
- A new dialog per flow — duplicates the same shell and copy handling.

## R-007 — Directory loading strategy

**Decision**: Load every page sequentially in `ReceptionistDirectoryStore`, following `DoctorDirectoryStore`.

**Rationale**:
- The backend list is paged (`page`, `pageSize`), and the spec assumes a complete single table.
- The data set is small (hundreds of staff), so 100-row pages with a 50-page cap are sufficient.
- One store owns rows, loading, error state, and deletion, so the page stays a thin smart container.
- Rows are tracked by `id`.

**Alternatives considered**:
- Real pager UI — not requested by the acceptance criteria and adds navigation state for little value at this scale.
- Single unpaged request — the backend paging contract would be ignored and the page size unbounded.

## R-008 — Duplicate email handling

**Decision**: Use the backend's HTTP 409 response as the duplicate signal and map it to the email control's `emailTaken` error.

**Evidence**:
- `ReceptionistErrors.DuplicateEmail` is a conflict error with message "User with this email already exists." and the controller returns it through `HandleFailure`.
- FluentValidation messages already match the spec ("Please, enter the first name", "Please, enter the last name", "Please, enter the email", "You've entered an invalid email", "Please, choose the office").
- No generated endpoint exposes an email-existence lookup for receptionists; `emailUniqueValidator` exists but requires a lookup function that would need a contract.

**Behavior**: client-side validators block empty/malformed values before submit; the server remains the authority for duplicates; a 409 sets `emailTaken` and keeps every entered value. A failure to learn uniqueness never blocks the user (fail-open on lookup, fail-closed on submit).

## R-009 — Photo upload and display

**Decision**: Photograph persistence uses a generated Documents client, not a hand-written service.

**Findings**:
- `Backend/DocumentsAPI/.../DocumentsController.cs` exposes `POST /api/Documents` (multipart `file`), `GET /api/Documents/{id}`, and `DELETE /api/Documents/{id}`.
- The Gateway routes `/documents/{everything}` to Documents API.
- The AdminApp currently has generated clients only for Profiles, Appointments, and Services; there is no Documents client.
- Receptionist DTOs carry `photoPath` (a string), so the generated upload id can be stored there.

**Plan**:
- Add `scripts/augment-documents-openapi.mjs` (envelope + response schemas), `ng-openapi-gen.documents.json`, `npm run api:documents`, generated output under `api/generated/documents`, and `provideDocumentsApiConfiguration()` pointing at `${environment.apiUrl}/documents`.
- `ReceptionistPhotoService` wraps the generated upload/delete calls and exposes a `photoUrl(photoPath)` helper that resolves the Gateway path. It contains no `HttpClient` calls.
- Local validation: JPEG/PNG/WebP and a 5 MB limit, with an inline error and preview.
- On profile deletion, the profile is deleted first; photo deletion is then best-effort through the generated client so a storage failure cannot resurrect the profile.

**Alternatives considered**:
- Deferring photos like the doctor form (`showPhoto=false`) — contradicts the receptionist spec.
- Base64 in `photoPath` — not the backend contract and bloats list responses.
- Direct `fetch` upload — violates the generated-client rule.

## R-010 — Routing, navigation, and authorization

**Decision**: Add lazy routes `/receptionists` and `/receptionists/:id/profile`, both guarded by `roleGuard('Receptionist')`, and add the "Receptionists" item to the header nav for that role.

**Rationale**: Matches the existing routing style in `app.routes.ts` and the nav computed in `app.ts`; the backend also restricts every receptionist endpoint to the `Receptionist` role.

**Alternatives considered**:
- A feature-local `Routes` array — not used by other features and adds indirection.

## R-011 — Error handling and notifications

**Decision**: Use the existing `apiErrorInterceptor`/`authErrorInterceptor` for global failures, `extractErrorMessage` for user-facing backend messages, and `NotificationService` toasts for operation-level success/failure. Page-level load failures render an inline error state with a retry button.

**Special cases**: 404 on the profile page renders "Receptionist not found." with a back action; 409 on create maps to the email field; create failures keep the dialog values and refresh the list so an already-created profile is visible.

## R-012 — Testing strategy

**Decision**: Vitest unit/component specs plus a manual end-to-end quickstart.

**Coverage**:
- Guards/mappers: `receptionist-contract.guards.spec.ts`, `receptionist-form.mapper.spec.ts`.
- Store: pagination, empty/error states, delete success/failure, no duplicate requests.
- Dumb form: email visibility by `isEditMode`, exact validation messages, submit disablement, photo preview/error outputs.
- Table: columns, row/profile actions, delete action, empty/error states.
- Pages: create/cancel flows, View→Edit→Save→View, cancel Yes/No, delete Yes/No, self-contained navigation.
- Dialogs: CDK data injection and exact copy (reusing shared dialog tests as a pattern).

## R-013 — Spec alignment applied during planning

The following spec details were adjusted to match the explicit planning brief and the verified backend contract:

1. **Email is create-only and hidden in Edit mode** (not merely read-only). Updated US4 AC-1, FR-033, FR-035, and the email assumption.
2. **No self-deletion special case.** The backend DTO has no account id, so the frontend cannot identify the signed-in receptionist's row reliably. The feature follows the same deletion flow and relies on session revalidation on the next protected request. Removed the self-deletion scenario, the corresponding FR, and the assumption; FRs were renumbered.
3. **Directory loads all pages.** The spec now states that the backend list is paged while the application renders one table, consistent with the existing staff-directory convention.
