# Implementation Plan: Receptionist Management

**Branch**: `009-receptionist-management` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-receptionist-management/spec.md`

## Summary

Deliver the Receptionists module in `Frontend/AdminApp`: a staff directory backed by the paged list endpoint, a create dialog with credentials provisioning, a read-only profile with in-place View/Edit mode, and confirmed deletion. The UI reuses one dumb `ReceptionistFormComponent` for create and edit, with an `isEditMode` input that hides the create-only email field. View/Edit state is driven by Angular Signals, and every cancel/delete confirmation is hosted by `@angular/cdk/dialog`. All transport goes through generated OpenAPI clients (`ReceptionistsService`, `OfficesService`, and a generated Documents client for photos); no hand-written HTTP services, DTOs, or models are introduced.

Three contract prerequisites were identified by read-only inspection of `Backend/` and of the current generated clients:

- **CG-1 (blocking, backend-owned)**: `ReceptionistProfileDto` has no `id`, and `GET /Receptionists` returns it for every row. Without an id the list cannot open a profile or delete a row. The Profiles API DTO must expose `id` and the Profiles client must be regenerated.
- **CG-2 (frontend-owned)**: the current generated `ReceptionistsService` declares every operation as returning `void` and the generated functions discard the response body (`responseType: 'text'`). The response schemas must be added to `scripts/augment-profiles-openapi.mjs` and the client regenerated.

Photo persistence additionally requires a generated Documents client (CG-3), because the Documents API is not currently part of the generated clients.

## Technical Context

**Language/Version**: TypeScript ~5.9.2; Angular 21.2 (standalone components, signal inputs/outputs, `@if`/`@for` control flow)

**Primary Dependencies**: `@angular/core`, `@angular/common`, `@angular/forms` (ReactiveFormsModule), `@angular/router`, `@angular/cdk` ^21.2.14 (`Dialog`, `DIALOG_DATA`, `DialogRef`), RxJS ~7.8, Tailwind CSS 4.1, `ng-openapi-gen` 1.1

**Storage**: No client-side persistence beyond the existing session storage. Receptionist profiles, accounts, and photos live in the backend and are reached through the Gateway.

**Testing**: Vitest 4 + jsdom via `ng test`; Angular `TestBed` component specs colocated with sources (`*.spec.ts`), pure-function specs for guards and mappers

**Target Platform**: Desktop and mobile browsers supporting the existing admin SPA; responsive from 375 px upward

**Project Type**: Angular web application feature inside `AdminApp/src/app/features/receptionists`

**Performance Goals**: Directory of up to 500 receptionists renders in under 2 seconds; `OnPush` everywhere; one in-flight list request at a time; no duplicate create/save/delete requests from repeated clicks

**Constraints**: Generated OpenAPI clients only (no manual HTTP/DTO code); no `any`; strict templates; backend is read-only for this work; confirmations must use `@angular/cdk/dialog`; styling only with Tailwind utility classes; one shared dumb form for create and edit; email hidden in edit mode

**Scale/Scope**: 5 user stories, 2 routes (`/receptionists`, `/receptionists/:id/profile`), 1 create dialog, 3 confirmation flows, roughly 8 components and 5 feature services, 1 nav entry

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Plan compliance |
|-----------|------|-----------------|
| I. Standalone & Smart/Dumb | Standalone components, `OnPush`, no business logic in dumb components, lightweight constructors | `ReceptionistFormComponent`, `ReceptionistTableComponent`, and `ReceptionistProfileViewComponent` are standalone dumb components with signal inputs/outputs and `OnPush`. Dialog host and both pages are smart containers. |
| II. Automated API Integration | No hand-written HTTP services, DTOs, or models; generated clients only; missing contracts pause work | All calls go through generated `ReceptionistsService`, `OfficesService`, and a generated Documents client. CG-1/CG-2/CG-3 are resolved by regeneration, never by hand-written HTTP. The plan explicitly gates list navigation/deletion on CG-1. |
| III. Reactive State | Signals first; RxJS for async; `toSignal()`; no leaks | `isEditMode = signal(false)`, directory/catalog signals, `computed` for `canSubmit`, `toSignal(form.statusChanges)`, `takeUntilDestroyed(DestroyRef)` for every subscription. |
| IV. Tailwind & CDK | Utility-first styling, minimal SCSS, mobile-first, CDK for overlays | Templates use Tailwind classes only; dialogs use CDK `Dialog`; no `@apply`; existing dialog shell classes reused. |
| V. Strict TypeScript | No `any`, no `I` prefix, `unknown` + type guards | Generated payloads enter as `unknown` and are narrowed by `receptionist-contract.guards.ts`; interfaces use `Receptionist...` names without an `I` prefix. |
| Scope | Changes only in `Frontend/AdminApp/` | Backend files are inspected read-only; all edits are confined to `AdminApp/` and the spec artifacts. |

**Gate result: PASS with prerequisites.** CG-1 is an external contract gap, not a design workaround. Design and implementation of the UI can proceed, but end-to-end verification of list navigation and deletion is blocked until the backend DTO exposes `id` and the Profiles client is regenerated. No suppression, manual HTTP fallback, or `any` is permitted to bypass the gap.

**Post-Phase 1 re-check**: PASS. The design keeps a single generated-client transport boundary, a single dumb form, and signal-based mode state; no new principles are violated.

## Project Structure

### Documentation (this feature)

```text
specs/009-receptionist-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── receptionists-api.contract.md
│   └── receptionists-ui.contract.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
AdminApp/src/app/
├── app.routes.ts                                  # + /receptionists, /receptionists/:id/profile
├── app.ts                                         # + "Receptionists" nav item for Receptionist role
├── app.config.ts                                  # + generated Documents client provider
├── api/generated/
│   ├── profiles/                                  # regenerated with Receptionists response schemas
│   └── documents/                                 # new generated client (upload/delete photo)
├── core/
│   ├── services/notification.service.ts           # reused for success/error toasts
│   ├── validators/non-blank.validator.ts          # reused
│   └── interceptors/api-error.interceptor.ts      # reused for global errors
├── shared/
│   ├── components/app-dialog/app-dialog.service.ts        # reused CDK confirmation service
│   └── components/app-dialog/app-confirm-dialog.component.ts # reused dumb Yes/No dialog
└── features/receptionists/
    ├── components/
    │   ├── receptionist-form/receptionist-form.component.{ts,html,spec.ts}
    │   ├── receptionist-table/receptionist-table.component.{ts,html,spec.ts}
    │   ├── receptionist-profile-view/receptionist-profile-view.component.{ts,html,spec.ts}
    │   └── receptionist-create-dialog/receptionist-create-dialog.component.{ts,html,spec.ts}
    ├── pages/
    │   ├── receptionists-page/receptionists-page.component.{ts,html,spec.ts}
    │   └── receptionist-profile-page/receptionist-profile-page.component.{ts,html,spec.ts}
    ├── models/
    │   ├── receptionist.model.ts
    │   ├── receptionist-form.model.ts
    │   └── receptionist-dialog.model.ts
    ├── services/
    │   ├── receptionist-contract.guards.ts
    │   ├── receptionist-directory.store.ts
    │   ├── receptionist-catalog.store.ts
    │   ├── receptionist-form.mapper.ts
    │   └── receptionist-photo.service.ts
    └── utils/
        ├── photo-file.validator.ts
        └── receptionist-presentation.ts
```

**Structure Decision**: The feature is a new domain folder under `features/`, matching the existing `doctors`, `services`, and `specializations` features. It keeps its own guards, mappers, store, and presentational components so it does not depend on doctor-specific code. Only genuinely shared UI (header, dialogs, notifications, validators) is reused.

## Phase 0: Research Decisions

Full rationale is in [research.md](./research.md). Key decisions:

1. **Generated transports only.** `ReceptionistsService` for CRUD, `OfficesService` for the office catalog, generated Documents client for photos. Response bodies are validated with `readApiEnvelope`/`readApiAcknowledgment` and feature guards.
2. **Regenerate before integration.** Extend the Profiles OpenAPI overlay with receptionist schemas and response types; add a Documents overlay/config/provider. Never write a temporary hand-written HTTP client.
3. **One dumb form.** `ReceptionistFormComponent` owns no services and receives a host-built `FormGroup`; an `isEditMode` signal input (the Angular 21 equivalent of `@Input()`) hides email and switches labels (`Confirm` → `Save changes`).
4. **Signals for mode.** `isEditMode = signal(false)` in the profile page; cancel confirmation resets the form and flips the signal back.
5. **CDK confirmations.** Reuse `AppDialogService.confirm` + `AppConfirmDialogComponent` for create-cancel, edit-cancel, and delete with the exact spec copy. Always confirm on Cancel, even when the form is untouched.
6. **Load all pages.** The directory store follows the doctor-store pattern: sequential `pageSize=100` loads, one table, error/empty states.
7. **Duplicate email.** The backend returns HTTP 409 with "User with this email already exists."; the create host maps it to the email control error. No async uniqueness endpoint exists, so no manual lookup is added.
8. **Photo pipeline.** Validate MIME type and size locally, upload through the generated Documents client, store the returned file id in `photoPath`, render the image through the Gateway URL, and delete the stored photo after a successful profile deletion.

## Phase 1: Design Summary

### Directory page (`/receptionists`)

- Smart `ReceptionistsPageComponent` loads `ReceptionistDirectoryStore` in `ngOnInit`.
- Dumb `ReceptionistTableComponent` renders exactly two data columns (Full name, Office address) plus an actions cell with a profile icon and a Delete button per row.
- Row activation and the profile icon emit `profileRequested(id)`; the page navigates to `/receptionists/:id/profile`.
- "Create receptionist" opens `ReceptionistCreateDialogComponent` through CDK `Dialog.open` with `disableClose`, `restoreFocus`, and a responsive width.
- Delete opens the shared CDK confirmation with exactly "Do you really want to delete? Data will be lost." and Yes/No. On success the row is removed; on failure the row stays and a toast is shown.

### Create dialog

- Smart host owns `NonNullableFormBuilder`, office loading, submit state, and the POST.
- Dumb `ReceptionistFormComponent` renders photo, first name, last name, middle name, email, office, and Confirm/Cancel. `isEditMode=false` keeps email visible and required.
- Success returns `{ created: { id, fullName, officeAddress } | null }` to the page; the page shows a toast and refreshes the directory.

### Profile page (`/receptionists/:id/profile`)

- Smart `ReceptionistProfilePageComponent` loads the profile and the office catalog, and owns `isEditMode = signal(false)`.
- View mode renders `ReceptionistProfileViewComponent` (photo, first name, last name, middle name, office) with an Edit action.
- Edit mode renders the same `ReceptionistFormComponent` with `isEditMode=true` (email hidden) and Save changes/Cancel.
- Save sends PUT, validates the acknowledgment, updates the profile signal, shows a success toast, and returns to View mode.
- Cancel opens the shared CDK confirmation with exactly "Do you really want to cancel? Changes will not be saved."; Yes resets the form and returns to View; No stays in Edit with values preserved.

### Cross-cutting

- Routes are lazy-loaded and protected by `roleGuard('Receptionist')`.
- The header gains a "Receptionists" nav item for the Receptionist role.
- Every confirmation and form uses the exact copy from the spec; copy is centralized as exported constants to prevent drift.
- Errors are surfaced through `NotificationService` and inline field messages; `extractErrorMessage` supplies backend messages.

## Complexity Tracking

No constitution violations. The only complexity is external: the Profiles list contract must expose `id`, and the current generated receptionist operations must be regenerated with response schemas. These are tracked as prerequisites, not worked around.

| Risk / Dependency | Impact | Mitigation |
|-------------------|--------|------------|
| CG-1: `ReceptionistProfileDto` has no `id` | List rows cannot open a profile or delete | Backend DTO update + regenerate Profiles client before integration testing; UI guards require `id` |
| CG-2: receptionist operations generated as `void` | List/profile responses unusable | Extend `augment-profiles-openapi.mjs` with receptionist envelopes and re-run `npm run api:profiles` |
| CG-3: no generated Documents client | Photo upload unavailable | Add Documents overlay/config/provider and regenerate; UI can ship selection/preview first, persistence follows |
| Credentials email failure after profile insert | User sees an error although the profile exists | On create failure, keep the dialog values and refresh the directory so the user can see whether the profile was created; surface the backend message |
| 500 receptionists performance | Slow initial render | Load pages sequentially with `pageSize=100`, cap at 50 pages, use `OnPush` and `trackBy` (`track row.id`) |
