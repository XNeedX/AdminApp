# Implementation Plan: Doctor Profile Management

**Branch**: `004-doctor-profile-management` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-doctor-profile-management/spec.md`

## Summary

Deliver the doctor profile workflow for the AdminApp: a read-only profile page, an in-place edit mode with a strictly typed Reactive Form, and a receptionist status change directly from the "Doctors" page.

Technical approach:

1. **One Smart page, two Dumb views.** `ProfilePageComponent` owns all state (`isEditMode = signal(false)`, profile, catalogs, saving flags) and switches between `ProfileViewComponent` and `ProfileEditComponent` — both pure presentational components with `input()`/`output()` only.
2. **Reactive Forms.** A typed `FormGroup<DoctorProfileForm>` with `Validators.required`, catalog-match validators, and the existing custom `maxDateValidator` / `maxYearValidator` for AC-5. `canSave` is derived from `statusChanges` bridged with `toSignal()`.
3. **CDK Dialog for cancellation.** The AC-6 dialog uses `@angular/cdk/dialog` (`Dialog.open`, `DialogRef.closed`, `DIALOG_DATA`) for focus trapping, focus restoration, and an accessible modal. `@angular/cdk` is added to the project.
4. **Native, Tailwind-styled autocomplete.** A reusable `AutocompleteComponent` (native `<input role="combobox">` + `<ul role="listbox">`, `ControlValueAccessor`) serves Specialization and Office. No Angular Material, no `@apply`.
5. **Strictly typed hand-written API clients.** Profile read/update, catalogs, photo upload, and the doctor list are consumed from `src/app/api/`. There is no OpenAPI generator in the repository, so these clients are written by hand: every payload is `unknown`, narrowed by guards, with zero `any` and no unchecked casts.
6. **Receptionist status select.** A plain `<select>` per row on the "Doctors" page, bound with `(change)`, with optimistic UI and rollback on failure. The select is rendered only when the signed-in user has the `Receptionist` role; the page also gains a "View profile" row action that navigates to `/doctors/:id/profile`.

> **Backend prerequisite**: the backend must add `GET /api/Doctors/account/{accountId}` (with `AccountId` linked to the Keycloak `sub`) and widen `GET /api/Doctors/{id}` to `Receptionist` while returning `id` and `status`. The status change reuses the existing `PUT` with the full `UpdateDoctorDto`. The required contracts are specified in [contracts/profile-api.contract.md](./contracts/profile-api.contract.md) and the concrete backend patch in [backend-unblock-plan.md](./backend-unblock-plan.md). The frontend is implemented against those contracts and degrades to a clear "Profile not found" state until they land.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21.2 (standalone APIs, signals, `input()`/`output()`)

**Primary Dependencies**: `@angular/core`, `@angular/common`, `@angular/forms` (`ReactiveFormsModule`), `@angular/router`, `rxjs` 7.8, `@angular/cdk` 21.2 (**new dependency**, for Dialog/Overlay), `tailwindcss` 4.1

**Storage**: N/A — all persistence through the Profiles API and Documents API via the Gateway

**Testing**: Vitest 4 via `@angular/build:unit-test` (`npm test`), Angular TestBed + `HttpTestingController`, jsdom

**Target Platform**: Modern desktop and tablet browsers (Chrome, Edge, Firefox, Safari); Mobile-First responsive layout

**Project Type**: Angular single-page application (admin dashboard)

**Performance Goals**: profile first render < 300 ms after the profile response; View↔Edit switch < 50 ms; blur validation feedback < 50 ms; status select feedback immediate (optimistic), server confirmation < 1 s on the local Docker stack

**Constraints**: `strict: true`, zero `any`, `standalone: true`, `ChangeDetectionStrategy.OnPush`, Smart/Dumb separation, Tailwind utility classes only, no `@apply`, typed hand-written API clients with runtime guards (no generator exists), no edits under `Backend/`

**Scale/Scope**: 2 routes (`/profile`, `/doctors/:id/profile`), 1 Smart page, 3 Dumb components, 1 reusable autocomplete, 1 role guard, 1 CDK dialog integration, 1 status column on the existing Doctors page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Implementation Detail |
|---|---|---|
| **I. Standalone & Smart/Dumb** | PASS | `ProfilePageComponent` is Smart (injects API clients, `Dialog`, `NotificationService`, `ActivatedRoute`, `AuthService`). `ProfileViewComponent`, `ProfileEditComponent`, `CancelEditDialogComponent`, and `AutocompleteComponent` are Dumb (inputs/outputs, no business services). All components `standalone: true`, `OnPush`. |
| **I. Lifecycle cleanliness** | PASS | Constructors only inject; data loading and form construction happen in `ngOnInit`. |
| **II. Automated API integration** | PASS | The repository has no OpenAPI generator, so the `api/` clients are hand-written and strictly typed: `unknown` payloads narrowed by guards, no `any`, no unchecked casts. This is the documented fallback agreed for this feature. |
| **II. Centralized error handling** | PASS | 401/403/5xx continue to be handled by `authErrorInterceptor` / `apiErrorInterceptor`; the page only adds contextual toasts and preserves edit state. |
| **III. Signals first** | PASS | `isEditMode`, `profile`, `specializations`, `offices`, `isSaving`, `statusSavingIds` are signals. `canSave` is a `computed()` fed by `toSignal(form.statusChanges)`. |
| **III. RxJS for async** | PASS | HTTP streams use RxJS with `takeUntilDestroyed(this.destroyRef)`; no hanging subscriptions. |
| **IV. Tailwind & Mobile-First** | PASS | All layout, error borders (`border-red-500`), and responsive breakpoints are Tailwind classes in templates. No component `.scss`, no `@apply`. |
| **IV. Accessible headless UI** | PASS | Cancellation dialog uses CDK Dialog (focus trap, `ariaLabelledBy`, `disableClose`). Autocomplete uses native ARIA combobox/listbox patterns with keyboard navigation. |
| **V. Strict TypeScript** | PASS | Typed forms (`FormGroup<DoctorProfileForm>`), discriminated `AutocompleteOption`, type guard `isDoctorStatus`, zero `any`, no `I`-prefixed interfaces. |
| **Polyrepo boundary** | PASS | Only `Frontend/AdminApp/` is modified; backend files were inspected read-only to verify contracts. |
| **Modular directories** | PASS | New code lives in `features/profile/`, reusable UI in `shared/components/`, role guard in `core/guards/`, typed API clients remain in `api/`. |

**Post-design re-check**: PASS. The only new architectural element is `@angular/cdk`, explicitly mandated by Principle IV for overlays. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-doctor-profile-management/
├── plan.md                          # This file
├── research.md                      # Phase 0: decisions and rationale
├── data-model.md                    # Phase 1: entities, form model, validation, state transitions
├── quickstart.md                    # Phase 1: runnable validation guide
├── contracts/
│   └── profile-api.contract.md      # Phase 1: endpoint contracts and API gaps
└── checklists/
    └── requirements.md              # Spec quality checklist (already generated)
```

### Source Code (AdminApp)

```text
AdminApp/src/app/
├── api/                                          # Hand-written, strictly typed clients
│   ├── doctor.service.ts                         # profile read/update, doctor table, photo upload
│   ├── office.service.ts                         # offices catalog
│   └── specialization.service.ts                 # specializations catalog
├── core/
│   ├── guards/
│   │   └── role.guard.ts                         # NEW: roleGuard(...roles)
│   └── validators/
│       └── max-date.validator.ts                 # EXISTING: maxDateValidator / maxYearValidator (reused)
├── shared/
│   └── components/
│       ├── autocomplete/                         # NEW: reusable Tailwind combobox (CVA)
│       │   ├── autocomplete.component.ts
│       │   └── autocomplete.component.html
│       └── confirm-cancel-dialog/                # EXISTING: untouched, used by doctor-create
├── features/
│   ├── profile/                                  # NEW feature
│   │   ├── models/
│   │   │   └── profile.model.ts                  # DoctorProfile, DoctorProfileForm, AutocompleteOption, mappers
│   │   ├── pages/
│   │   │   └── profile-page/
│   │   │       ├── profile-page.component.ts     # Smart container
│   │   │       ├── profile-page.component.html
│   │   │       └── profile-page.component.spec.ts
│   │   └── components/
│   │       ├── profile-view/                     # Dumb read-only view
│   │       │   ├── profile-view.component.ts
│   │       │   └── profile-view.component.html
│   │       ├── profile-edit/                     # Dumb form renderer
│   │       │   ├── profile-edit.component.ts
│   │       │   ├── profile-edit.component.html
│   │       │   └── profile-edit.component.spec.ts
│   │       └── cancel-edit-dialog/               # Dumb CDK dialog content
│   │           ├── cancel-edit-dialog.component.ts
│   │           └── cancel-edit-dialog.component.html
│   └── doctors/
│       ├── models/
│       │   └── doctor-form.model.ts              # EXISTING: DoctorStatus enum + shared status list
│       ├── pages/doctors-page/                   # MODIFIED: real table data, status select (Receptionist), View profile action
│       │   ├── doctors-page.component.ts
│       │   └── doctors-page.component.html
│       └── components/doctor-create/             # EXISTING: untouched
├── shared/layout/app-header/                     # MODIFIED: profile icon for Doctors
│   ├── app-header.component.ts
│   └── app-header.component.html
├── app.ts / app.html                             # MODIFIED: profile navigation handler
├── app.routes.ts                                 # MODIFIED: /profile and /doctors/:id/profile
└── styles.css                                    # MODIFIED: @angular/cdk overlay prebuilt CSS
```

**Structure Decision**: The profile page is its own domain feature (`features/profile/`) because it is reachable by two roles and has its own routing. Doctor-specific constants (`DoctorStatus`) stay in `features/doctors/` and are imported by the profile feature to guarantee one status vocabulary. Reusable presentational controls go to `shared/`, and the strictly typed API clients remain in `api/`.

## API Contract Prerequisites

The design is complete; two backend contracts must change for the feature to work end to end. They are documented in full in [contracts/profile-api.contract.md](./contracts/profile-api.contract.md), and the concrete backend patch is specified in [backend-unblock-plan.md](./backend-unblock-plan.md).

Verified additional constraints:

- `DoctorProfile.AccountId` is `NULL` for every seeded doctor, so E1 also requires an account-link/backfill step.
- `GET /api/Doctors/{id}` is limited to `Patient, Doctor` and returns `DoctorDetailsDto` without `id`/`status`.
- No OpenAPI generator is configured in `AdminApp`; the `src/app/api/*.service.ts` clients are hand-written, strictly typed, and free of `any`.

| # | Capability | Current backend | Required contract | Impacted stories |
|---|---|---|---|---|
| G1 | Doctor reads own profile | No lookup by Keycloak `sub`; `AccountId` is always null | `GET /profiles/doctors/account/{accountId}` returning the full profile **including `id` and `status`**, with `AccountId` linked to `sub` | US1, US2 |
| G2 | Receptionist reads a doctor profile | `GET /api/doctors/{id}` is `Patient, Doctor` and returns `DoctorDetailsDto` **without `id`/`status`** | Add `Receptionist` to the roles and return `DoctorAdminDto` **with `id` and status** | US1, US3 |
| G3 | Receptionist changes status | Only `PUT /api/doctors/{id}` with the full `UpdateDoctorDto`; the table row lacks `careerStartYear`, split names, and photo | Compose `GET /{id}` (G2) + `PUT /{id}` (E3); **no `PATCH`** | US3 |

Until G1/G2 land, the profile page shows a clear "Profile not found" / contract-mismatch state and the status select rolls back with an error toast. No hand-written fallback endpoint is invented.

## Phase 0: Research

All decisions, alternatives, and the exact CDK dialog syntax are recorded in [research.md](./research.md). Key outcomes:

- CDK `Dialog` with `DialogRef.closed` and `DIALOG_DATA`; `disableClose: true`, `ariaLabelledBy`, focus restoration.
- Typed Reactive Forms with `toSignal(statusChanges)` for a reactive `canSave`.
- Reuse of the existing custom `maxDateValidator` / `maxYearValidator`.
- Native ARIA combobox/listbox instead of a second overlay implementation.
- Optimistic status update with rollback.

## Phase 1: Design

- [data-model.md](./data-model.md) — profile entity, typed form model, validation matrix, state transitions, DTO mapping.
- [contracts/profile-api.contract.md](./contracts/profile-api.contract.md) — endpoint contracts, error mapping, client methods, envelope guards.
- [quickstart.md](./quickstart.md) — setup, run commands, and AC-by-AC validation scenarios.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `@angular/cdk` dependency | AC-6 needs a modal with focus trap, focus restoration, backdrop, and Escape/backdrop policy; Principle IV mandates CDK for overlays | The existing inline overlay div has no focus trap or focus restoration; a hand-rolled overlay duplicates CDK and is less accessible. Native `<dialog>` still needs custom focus management and consistent overlay styling. |
| Reusable `AutocompleteComponent` (CVA) | Specialization and Office share identical type-to-filter behavior, keyboard handling, and ARIA semantics | Duplicating the create-form combobox logic in the profile form would drift and duplicate keyboard/ARIA bugs. |
| Separate `CancelEditDialogComponent` | CDK dialog content needs `DIALOG_DATA` / `DialogRef`; the existing `ConfirmCancelDialogComponent` is an inline overlay with its own backdrop | Reusing the existing component inside a CDK overlay would nest two backdrops and couple the create flow to the dialog service. |
