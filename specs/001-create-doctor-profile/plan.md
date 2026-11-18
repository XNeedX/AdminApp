# Implementation Plan: Create Doctor Profile

**Branch**: `001-create-doctor-profile` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-create-doctor-profile/spec.md`

## Summary

Implement the doctor profile creation feature for signed-in Receptionists on the "Doctors" page. The feature includes:
1. `DoctorCreateComponent`: A Standalone Smart container modal hosting a strictly typed Reactive Form with OnPush change detection.
2. Synchronous & asynchronous validation triggering on `blur` with Tailwind CSS error styling.
3. Custom validators: `maxDateValidator` (<= current date/year) and `emailUniqueValidator` (debounced async check via generated API client).
4. `ConfirmCancelDialogComponent`: A Standalone Dumb dialog providing safe cancellation confirmation ("Do you really want to cancel? Entered data will not be saved.").
5. Zero hand-written HTTP calls: strictly consuming auto-generated backend API clients in `src/app/api/`.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21.2
**Primary Dependencies**: `@angular/core`, `@angular/forms` (ReactiveFormsModule), `@angular/router`, `rxjs` 7.8, `@angular/cdk` (or modal overlays), `tailwindcss` 4.1
**Storage**: N/A (Client-side form state; persistent data handled via backend microservices)
**Testing**: Vitest (`npm test`)
**Target Platform**: Modern Web Browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Angular Single Page Application (Admin Dashboard)
**Performance Goals**: Modal open < 100ms, form validation feedback < 50ms, zero change-detection cycles outside OnPush triggers
**Constraints**: Mobile-First responsive design (Tailwind `sm:`, `md:`, `lg:`), zero `any` tolerance, zero handwritten HTTP services/DTOs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Compliance Status | Implementation Detail |
|---|---|---|
| **Standalone Components Only** | PASS | All new components (`DoctorCreateComponent`, `ConfirmCancelDialogComponent`) use `standalone: true`. No `NgModule`. |
| **Smart/Dumb Pattern** | PASS | `DoctorCreateComponent` acts as Smart container (injects API clients, manages form & modal state). `ConfirmCancelDialogComponent` is purely Dumb (emits user choices via output). |
| **OnPush Change Detection** | PASS | Both components explicitly specify `changeDetection: ChangeDetectionStrategy.OnPush`. |
| **Automated Backend API** | PASS | Form submission, uniqueness check, and catalog retrieval strictly use auto-generated clients in `src/app/api/`. No manual HTTP services or DTOs. |
| **Reactivity & Memory Safety** | PASS | Uses Angular Signals for local state, typed Reactive Forms, and `takeUntilDestroyed()` with `DestroyRef` on all subscriptions. |
| **Utility-First Tailwind CSS** | PASS | All layouts and error states (`border-red-500`, `text-red-600`) use Tailwind classes directly in HTML templates. No `@apply`. |
| **Strict TypeScript** | PASS | `any` is strictly prohibited. Interface names avoid `I`-prefix (e.g., `DoctorCreateForm`, `Specialization`). Strict null checks enabled. |

## Project Structure

### Documentation (this feature)

```text
specs/001-create-doctor-profile/
├── plan.md              # This implementation plan
├── research.md          # Technical decisions and validation strategy
├── data-model.md        # Form model, DTOs, and error mappings
├── quickstart.md        # Step-by-step verification and test scenarios
└── contracts/
    └── doctor-api.contract.md # API client contracts
```

### Source Code (AdminApp)

```text
AdminApp/src/app/
├── core/
│   └── validators/
│       ├── max-date.validator.ts       # <= current date / year validator
│       └── email-unique.validator.ts   # Debounced async email check
├── shared/
│   └── components/
│       └── confirm-cancel-dialog/
│           ├── confirm-cancel-dialog.component.ts
│           └── confirm-cancel-dialog.component.html
├── features/
│   └── doctors/
│       ├── components/
│       │   ├── doctor-create/
│       │   │   ├── doctor-create.component.ts
│       │   │   ├── doctor-create.component.html
│       │   │   └── doctor-create.component.spec.ts
│       └── models/
│           └── doctor-form.model.ts    # Form interfaces & status enum
└── api/
    ├── doctor.service.ts               # Auto-generated API client
    ├── specialization.service.ts       # Auto-generated API client
    └── office.service.ts               # Auto-generated API client
```

**Structure Decision**: The implementation follows the modular structure defined in the project Constitution: `features/doctors/` encapsulates doctor-specific domain logic, `shared/` hosts the reusable dumb cancellation dialog, `core/validators/` contains reusable form validators, and `api/` houses generated backend clients.

## Complexity Tracking

*No violations or unjustified complexity.*
