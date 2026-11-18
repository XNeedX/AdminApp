# Implementation Plan: Clinic Services Management

**Branch**: `005-clinic-services-management` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-clinic-services-management/spec.md`

**Research**: [research.md](./research.md) | **Data model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/](./contracts/) | **Validation**: [quickstart.md](./quickstart.md)

---

## Summary

Deliver the Receptionist-facing service management surface for AdminApp: create a service from a specialization page, view a service's information, edit it in place, and change its Active/Inactive status with an immediate API call. The UI is built from one reusable dumb form (`ServiceFormComponent`) shared by Create and Edit, a smart `ServiceInfoComponent` that owns the View/Edit signal state, and CDK-based cancel dialogs. All API access goes through the generated Services OpenAPI client — no hand-written HTTP layer.

---

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21.2 (standalone components, signals, new template control flow)

**Primary Dependencies**: `@angular/core`, `@angular/forms` (typed reactive forms), `@angular/cdk` 21.2 (`Dialog`), `rxjs` 7.8, `tailwindcss` 4.1; new dev dependency `ng-openapi-gen` for the generated Services client

**Storage**: N/A — the Services API owns persistence; the SPA keeps only in-memory signals

**Testing**: Vitest 4 + jsdom through `ng test` / `npm test -- --watch=false`, Angular `TestBed` for component and signal-state tests

**Target Platform**: Web SPA, modern evergreen browsers

**Project Type**: Angular standalone application (AdminApp)

**Performance Goals**: View ↔ Edit toggle under 100 ms; status change feels instant via optimistic update; no full page reloads

**Constraints**: No hand-written HTTP services/DTOs (Constitution II); no `any`; Tailwind utility classes only; CDK for overlays; `OnPush` on every component; generated client required before API-dependent work starts

**Scale/Scope**: 1 routed page, 1 create dialog, 1 reusable dumb form, 1 shared cancel dialog, 3 model/mapper modules, ~4 API operations, ~6 test files

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Status | Evidence / action |
|---|---|---|---|
| I. Standalone & Smart/Dumb | All new components standalone + `OnPush`; form is dumb, pages/dialogs are smart | **PASS** | `ServiceFormComponent` uses only `input()`/`output()` and `ReactiveFormsModule`; `ServiceInfoComponent` and `ServiceCreateDialogComponent` own state, API, dialogs |
| II. Automated Backend API Integration | Zero hand-written API contracts; generated client only | **PASS WITH PREREQUISITE (T0)** | No generator exists yet and Swagger has no response schemas (gaps G1–G4). The plan's first task is to generate the client after the backend publishes typed responses. API-dependent implementation is blocked until then, per the "Missing Contract Protocol". |
| III. Signals & RxJS | Signals for local state, RxJS for async, `takeUntilDestroyed` for subscriptions | **PASS** | `isEditMode`, `service`, `isSaving`, `statusSaving` are signals; HTTP is RxJS; every manual subscribe uses `takeUntilDestroyed` |
| IV. Tailwind + CDK | Utility-first styles; CDK for overlays; mobile-first | **PASS** | Templates use Tailwind only; cancel/create dialogs use `@angular/cdk/dialog`; responsive `sm:`/`md:` layout |
| V. Strict TypeScript | No `any`, no `I` prefix, `unknown` + guards at boundaries | **PASS** | Numeric enums mapped through exhaustive switches; generated client types are used directly; no casts to DTOs |
| Scope / Polyrepo | Only `Frontend/AdminApp/` is modified; `Backend/` read-only | **PASS** | Backend inspection only; contract gaps are reported, not patched |

**Post-design re-check (after Phase 1)**: unchanged — the design introduces no manual HTTP, no `any`, and no `NgModule`. Gate II remains conditional on T0 (client generation), which is a dependency rather than a design violation.

---

## Project Structure

### Documentation (this feature)

```text
specs/005-clinic-services-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── services-api.contract.md
│   └── component-contracts.md
├── checklists/
│   └── requirements.md
└── tasks.md              # created by /speckit.tasks, not by this command
```

### Source Code (repository root)

```text
AdminApp/src/app/
├── api/
│   └── generated/
│       └── services/                  # ng-openapi-gen output (T0) — never edited by hand
├── core/
│   ├── validators/
│   │   └── positive-price.validator.ts
│   └── services/                      # existing AuthService, NotificationService
├── shared/
│   └── components/
│       └── cancel-confirm-dialog/     # extracted CDK dialog, reused by Create and Edit
│           ├── cancel-confirm-dialog.component.ts
│           └── cancel-confirm-dialog.component.html
└── features/
    └── services/
        ├── components/
        │   └── service-form/          # dumb, reused for Create and Edit
        │       ├── service-form.component.ts
        │       └── service-form.component.html
        ├── dialogs/
        │   └── service-create-dialog/ # smart CDK dialog host (Create)
        │       ├── service-create-dialog.component.ts
        │       └── service-create-dialog.component.html
        ├── models/
        │   ├── service.model.ts       # ServiceView, ServiceFormValue, enum maps
        │   └── service-form.model.ts  # ServiceFormControls, category options
        ├── utils/
        │   └── open-service-create-dialog.ts  # create entry point for the /services page
        └── pages/
            ├── services-page/         # specialization context: list, "Add service", row navigation
            │   ├── services-page.component.ts
            │   └── services-page.component.html
            └── service-info/          # smart page (View / Edit / Status)
                ├── service-info.component.ts
                └── service-info.component.html
```

**Structure Decision**: Single Angular application. The feature follows the existing `features/<domain>/` layout used by `doctors/` and `profile/`. The reusable form lives under `features/services/components/` because it is service-specific; only the cancel dialog is promoted to `shared/` because it is generic. The generated client lives under `api/generated/services/` to keep generated code visibly separate from hand-written code. The specialization-context page (`pages/services-page/`) arrived after the original plan and is documented in [contracts/component-contracts.md](./contracts/component-contracts.md) §5.

### Routing changes

```text
/services       → ServicesPageComponent  (roleGuard('Receptionist'))   — specialization context: list + "Add service"
/services/:id   → ServiceInfoComponent   (roleGuard('Receptionist'))
```

The create flow is a CDK dialog opened from the `/services` page (the specialization-context surface), not a route. Initially planned as an external prerequisite ("Specialization info" page), that surface was delivered inside this feature as the `/services` tab: it selects a specialization, lists its services, opens `ServiceCreateDialogComponent` and navigates each row to `/services/:id`.

---

## Architecture

### Component responsibilities

```text
/services → ServicesPageComponent (smart) — specialization context
  └─ opens ServiceCreateDialogComponent (smart, CDK Dialog)
       └─ ServiceFormComponent (dumb, mode="create")
            └─ emits submitted → create API → closes with { id }

/services/:id → ServiceInfoComponent (smart)
  ├─ View mode: read-only fields + "Edit" + immediate status radios
  ├─ Edit mode: ServiceFormComponent (dumb, mode="edit")
  │    └─ emits submitted → update API → View mode
  └─ Cancel → CancelConfirmDialogComponent (shared, CDK Dialog) → boolean
```

### Smart / Dumb boundary

| Component | Type | Owns | Must not do |
|---|---|---|---|
| `ServiceFormComponent` | Dumb | Form group, validation, messages, button labels | Inject API/router/dialog/notification; navigate |
| `ServiceInfoComponent` | Smart | Load, View/Edit signal, save, status PATCH, dialogs, toasts | Contain presentational markup duplication |
| `ServiceCreateDialogComponent` | Smart | Create request, dialog lifecycle, cancel confirmation | Own the form's validation logic |
| `CancelConfirmDialogComponent` | Dumb | Render message and two buttons | Decide the consequence of the answer |

### View / Edit state (Signals)

```text
isEditMode = signal(false)
service    = signal<ServiceView | null>(null)
isSaving   = signal(false)
statusSaving = signal(false)
```

- `enterEdit()` sets `isEditMode(true)`; the template swaps the read-only block for `ServiceFormComponent`.
- `onSubmitted(value)` calls the update operation; on success it sets `service`, `isEditMode(false)`, and shows a toast.
- `onCancelled()` opens the CDK dialog; `true` → `isEditMode(false)` without saving; `false` → no change.

### Immediate status change

- View mode renders an Active/Inactive radio group; `(change)` calls the status operation immediately.
- Optimistic update: set the local `service.status` first, keep the previous value, call the API, roll back on error and show a toast.
- `statusSaving` disables the radios during the request.
- In Edit mode the status is part of the form and is saved by "Save changes" (shared field rules).

---

## Forms and validation

### Typed form

```ts
new FormGroup<ServiceFormControls>({
  name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
  price: new FormControl<number | null>(null, { validators: [Validators.required, positivePriceValidator] }),
  category: new FormControl<ServiceCategory | ''>('', { nonNullable: true, validators: [Validators.required] }),
  status: new FormControl<ServiceStatus>(ServiceStatus.Active, { nonNullable: true }),
})
```

### Custom validator

`positivePriceValidator` returns `{ invalidPrice: true }` for `null`, `NaN`, `Infinity`, `<= 0`, or more than two fractional digits. Empty is handled by `Validators.required` so the two messages remain distinct.

### Error display

- The template reads `control.touched && control.invalid`.
- Message selection is exhaustive: `required` → "Please, enter the price"; `invalidPrice` → "You've entered an invalid price".
- Red border classes are applied only in the touched-invalid state, matching F-1…F-3.
- Submit is disabled while `form.invalid || submitting`.

---

## API integration

### Generated client (mandatory)

- Add `ng-openapi-gen` as a dev dependency and an `api:services` npm script.
- Generate from the Services API definition into `src/app/api/generated/services/`.
- Configure the generated base path as `${environment.apiUrl}/services` (Gateway route `/services/{everything}`).
- Inject the generated service into `ServiceInfoComponent` and `ServiceCreateDialogComponent`.
- No feature-level HTTP wrapper, no hand-written DTOs.

### Blocking prerequisites (owned by the backend team)

| Gap | Needed before |
|---|---|
| G1 — response schemas (`[ProducesResponseType]`) | Any typed response usage |
| G2 — enum names (string converter or `x-enumNames`) | Clean generated enum types |
| G3 — document `201` for create | Correct create response handling |
| G4 — generator setup in AdminApp | All API tasks |

UI-only work (form, validators, dialogs, model mappers, tests) can start before G1–G3; API wiring waits for G4 and the generated models. See [contracts/services-api.contract.md](./contracts/services-api.contract.md) §5.

---

## Dialogs

- Shared `CancelConfirmDialogComponent` (extracted from the profile feature) opened with `Dialog.open<boolean, CancelConfirmDialogData>`.
- `disableClose: true`, `ariaLabelledBy`, `restoreFocus: true`.
- Create message: "Do you really want to cancel? Entered data will not be saved."
- Edit message: "Do you really want to cancel? Changes will not be saved."
- The create dialog itself is a CDK dialog opened by the `/services` page and returns `{ id } | null`.

---

## Error handling

- Global `apiErrorInterceptor` handles 401/403/5xx; no new global handling.
- Feature-level failures (create/save/status) show `NotificationService.showError(...)` and preserve user data.
- A `404` on load shows an inline "Service not found." state with a retry action.
- Backend validation errors (400 with `errors[]`) are surfaced through the same toast path.

---

## Testing strategy

| Test file | Coverage |
|---|---|
| `service-form.component.spec.ts` | Required messages on blur, price validator cases, disabled/enabled submit, mode button labels, status default |
| `service-info.component.spec.ts` | Load → View; Edit → prefill; save success/failure; cancel Yes/No; immediate status change with rollback; duplicate-submit guard |
| `service-create-dialog.component.spec.ts` | Create success closes with id; failure keeps the dialog and shows an error; cancel Yes/No |
| `service.model.spec.ts` | Exhaustive enum mapping, DTO conversion, unknown value handling |
| `positive-price.validator.spec.ts` | Boundary values: empty, `0`, negative, `NaN`, `0.001`, `12.34` |

Commands: `npm test -- --watch=false` and `npm run build` must be green before the feature is considered done.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| No generated client exists (G4) | T0 is the first task; API-dependent tasks are blocked, not hand-written |
| Swagger lacks response schemas (G1) | Backend adds `[ProducesResponseType]`; regenerate before API wiring |
| Numeric enums lose labels (G2) | Single exhaustive mapper; ask backend for string enums as a follow-up |
| The specialization page does not exist yet | Resolved: delivered as the `/services` tab (`ServicesPageComponent`), which opens the create dialog and navigates rows to `/services/:id`; keep the integration to the two documented calls |
| Status changed in View and Edit in the same session | View mode uses PATCH immediately; Edit mode sends the form status via PUT; the last successful write wins |
| Duplicate submissions | Disable buttons while `submitting`/`isSaving`; ignore repeated events |
| CDK overlay styles missing | Verify the global overlay CSS is imported (already required by the profile feature) |

---

## Definition of done

Status after implementation (T040, 2026-11-12):

- [x] `ServiceFormComponent` is reused by Create and Edit with signal inputs/outputs and no injected services.
- [x] `ServiceInfoComponent` switches View/Edit via `isEditMode` and saves through the generated client.
- [x] Cancel dialogs use `@angular/cdk/dialog` (shared `CancelConfirmDialogComponent`) and show the exact required messages.
- [x] The status change in View mode calls the status operation immediately with optimistic update and rollback.
- [x] No hand-written HTTP client, no `any`, no `NgModule`, `OnPush` everywhere.
- [x] `npm run build` and `npm test -- --watch=false` pass (22 files / 159 tests).
- [ ] [quickstart.md](./quickstart.md) scenarios pass against the running stack — the entry points are delivered (`/services` tab opens the create dialog and rows navigate to `/services/:id`, T023/T028 closed on 2026-11-15) and the API-level flows were verified end-to-end through the Gateway (create `201`, read `200`, update `204`, status `204` with persistence, `404`/`400` envelopes, CORS for `localhost:4200`, patient catalog hiding Inactive services). Only the interactive browser walkthrough (§4.1–§4.6) remains. See the validation log in quickstart.md §7–§8.
- [ ] T037 (remove the OpenAPI overlay) remains open until the backend closes gaps G1–G3.
