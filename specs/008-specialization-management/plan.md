# Implementation Plan: Specialization Management

**Branch**: `008-specialization-management` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-specialization-management/spec.md`

## Summary

Deliver the Specializations module of the AdminApp: a list page with per-row immediate status
change, a creation dialog with a nested, repeatable services table, and a detail page that
switches between View and Edit mode in place. The nested services table is a typed
`FormArray<FormGroup<ServiceRowControls>>`; View/Edit switching is a `signal<boolean>`; cancel
confirmations use `@angular/cdk/dialog`; every request goes through the auto-generated Services
API client. The deactivation cascade is not implemented in the frontend: the module only calls
the generated status endpoint and relies on the backend to propagate Inactive to related doctors
and services.

The specification is fully stable, but the current backend contract does not yet match it
(see [Contract Gates](#contract-gates)). Frontend work that depends on the missing pieces is
sequenced behind those gates; the design below is the target state.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21.2 (standalone components, signal-first APIs)

**Primary Dependencies**: `@angular/core`, `@angular/common`, `@angular/forms` (typed reactive
forms), `@angular/router`, `@angular/cdk/dialog`, `@angular/cdk/a11y`, RxJS 7.8, Tailwind CSS 4,
Vitest 4 with `@angular/core/testing`, and the generated Services API client
(`src/app/api/generated/services`, produced by `ng-openapi-gen`).

**Storage**: N/A in the browser. Specializations and services are persisted by the Services API;
the frontend keeps only in-memory component/store state.

**Testing**: Vitest 4 with Angular `TestBed`, generated services replaced by `vi.fn()` doubles, no
live backend in unit tests; manual end-to-end verification per `quickstart.md`.

**Target Platform**: Modern browsers (desktop and mobile widths) running the AdminApp SPA.

**Project Type**: Web application - Angular single-page admin frontend.

**Performance Goals**: List interactive within 2 seconds for 200 specializations (SC-001); status
change reflected immediately (optimistic) and confirmed by the API; no full-page reloads; no
layout shift when switching View/Edit.

**Constraints**: Zero hand-written API contracts (generated client only); no `any`; no `NgModule`;
`ChangeDetectionStrategy.OnPush` everywhere; `@apply` and custom SCSS avoided; no backend edits.

**Scale/Scope**: 2 routes (`/specializations`, `/specializations/:id`), 1 list page, 1 detail page,
1 creation dialog, 1 dumb form with a `FormArray`, 1 dumb table, 1 orchestration service, 1 mapper
module, unit tests for all of them.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status | Evidence / planned enforcement |
|---|-----------|------|--------|-------------------------------|
| I | Standalone + Smart/Dumb + OnPush | All new components standalone, no `NgModule`, smart/dumb split, explicit `OnPush` | PASS | `SpecializationsPageComponent` and `SpecializationInfoComponent` are smart; `SpecializationTableComponent` and `SpecializationFormComponent` are dumb (inputs/outputs only); every component declares `OnPush`; constructors only inject |
| II | Automated API integration | Only generated clients; no hand-written HTTP/DTO code; missing contract pauses work | PASS (with gates) | All calls go to `SpecializationService` / `ServiceService` from `api/generated/services`. No new DTO types: UI models derive from generated models. Gaps G-1..G-4 are recorded as blocking gates, not worked around with hand-written clients |
| III | Signals + RxJS | Signals for local state, RxJS for async, `toSignal()`/`takeUntilDestroyed()` | PASS | `isEditMode`, `rows`, `isLoading`, `statusSavingId` are signals; HTTP stays RxJS; every explicit subscription uses `takeUntilDestroyed`; form validity exposed through `computed` + `valueChanges` bridge |
| IV | Tailwind + CDK | Utility classes in templates, CDK for overlays | PASS | Tables/forms styled with Tailwind only; cancellation dialogs hosted by `Dialog` using the existing `CancelConfirmDialogComponent` |
| V | Strict TypeScript | No `any`, no `I` prefix, `unknown` + guards for external data | PASS | Generated payloads are `unknown`-narrowed via existing guards/`readApiEnvelope` patterns before mapping; typed forms; interfaces named `SpecializationView`, `SpecializationListRow`, etc. |

No violations - `Complexity Tracking` stays empty.

**Post-design re-check (Phase 1)**: PASS. The design introduces one extra service
(`SpecializationWriterService`) to orchestrate multi-call saves; it is an application service over
generated clients, not an HTTP client, and it does not add a project or a layer. All other
principles hold.

## Project Structure

### Documentation (this feature)

```text
specs/008-specialization-management/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities, form models, state machines
├── quickstart.md        # Phase 1 validation guide
├── contracts/
│   ├── services-api.contract.md   # Generated-client usage + contract gaps
│   └── ui-contracts.md            # Routes, component I/O, dialog and form contracts
└── checklists/
    └── requirements.md  # Spec quality gate (already complete)
```

### Source Code (repository root)

```text
AdminApp/src/app/
├── app.routes.ts                    # MODIFIED: add /specializations and /specializations/:id
├── app.ts                           # MODIFIED: add "Specializations" nav item for Receptionist
├── api/
│   └── generated/services/          # READ-ONLY generated client (no edits)
├── core/
│   ├── validators/non-blank.validator.ts        # REUSED
│   ├── validators/positive-price.validator.ts   # REUSED
│   ├── interceptors/api-error.interceptor.ts    # REUSED (extractErrorMessage)
│   └── services/notification.service.ts         # REUSED
├── shared/
│   ├── components/cancel-confirm-dialog/        # REUSED via CDK Dialog
│   └── layout/app-header/                       # REUSED (nav items passed in)
└── features/specializations/
    ├── models/
    │   ├── specialization.model.ts              # UI models + generated-model mappers
    │   └── specialization-form.model.ts         # Typed control interfaces, factories, constants
    ├── components/
    │   ├── specialization-table/                # Dumb: rows in, open/status out
    │   └── specialization-form/                 # Dumb: typed FormGroup + FormArray
    ├── dialogs/
    │   └── specialization-create-dialog/        # Smart host of the create flow
    ├── pages/
    │   ├── specializations-page/                # Smart: list, immediate status change
    │   └── specialization-info/                 # Smart: detail, View/Edit signal, staged status
    ├── services/
    │   └── specialization-writer.service.ts     # Orchestrates generated create/update calls
    └── utils/
        └── open-specialization-create-dialog.ts # CDK dialog opener
```

**Structure Decision**: Single Angular SPA. The module lives entirely inside
`AdminApp/src/app/features/specializations/` following the existing `features/services` and
`features/doctors` layout (models / components / dialogs / pages / services / utils). Nothing
outside the feature folder changes except the two integration points in `app.routes.ts` and
`app.ts`. No new dependency is added.

## Phase 0 - Research (output: research.md)

Resolved unknowns:

1. Typed `FormArray` syntax for the installed Angular version (context7 unavailable - see
   research.md D1).
2. How form validity is surfaced reactively under `OnPush` while keeping `FormArray` emptiness an
   explicit submit condition.
3. How View/Edit switching and staged status interact with the already-shipped `service-info`
   pattern.
4. How a nested-services save is expressed with the generated client when the API has no atomic
   "specialization + services" operation.
5. Which contract gaps exist and how they gate the work.

## Phase 1 - Design (outputs)

- `data-model.md` - UI entities, form model shapes, mapping rules, state transitions, validation.
- `contracts/services-api.contract.md` - exact generated operations consumed, payload mapping,
  error handling, and the four contract gaps.
- `contracts/ui-contracts.md` - route table, component input/output contracts, dialog data/result,
  orchestration service signature, exact user-facing message strings.
- `quickstart.md` - runnable validation path (commands + manual scenarios + automated suites).

## Design Highlights

1. **Nested services table is a typed `FormArray`.** The specialization form group owns
   `services: FormArray<FormGroup<ServiceRowControls>>`. "Add service" pushes a typed row group;
   discarding a session row calls `removeAt(index)`. Submit is blocked by both
   `form.valid` and an explicit `form.controls.services.length === 0` check (spec FR-014/FR-029),
   so an empty table can never be submitted even if validators are later relaxed.
2. **Signals own page state, the form owns edit state.** `isEditMode` is a `signal(false)`. In View
   mode the detail page renders read-only values plus a single status-control group; entering Edit
   mode mounts the `FormArray` form pre-filled from the loaded view model. Status is immediate
   outside Edit mode and staged inside it, matching spec FR-038/FR-039.
3. **CDK dialogs for every cancellation.** Both "Cancel" entry points open the existing
   `CancelConfirmDialogComponent` through `Dialog.open`, with `disableClose: true` and
   `restoreFocus: true`; "Yes" resolves `true`, "No" resolves `false`.
4. **Status change is optimistic but reversible.** The row/page status is updated locally, then
   `specializationIdStatusPatch` is called. Failure restores the previous value and shows an error.
   A per-row in-flight guard ignores repeated changes. No cascade logic runs in the browser.
5. **Nested saves are orchestrated, not atomic.** `SpecializationWriterService` sequences
   generated calls (specialization first, then services) and records progress in a session object
   so a retry never duplicates an already-created specialization or service. See research.md D6.
6. **List is loaded once and sorted locally.** `specializationGet({ Page: 1, PageSize: 200 })`,
   then alphabetical sort by name; request sequencing prevents a stale response from overwriting a
   newer status selection.

## Contract Gates

The backend contract is narrower than the specification. These gates are blocking for the
affected user stories and must be resolved by regenerating the OpenAPI client (and, where stated,
by a backend change request). No gate is bypassed with hand-written HTTP code.

| Gate | Gap | Impact | Resolution required | Final status |
|------|-----|--------|---------------------|--------------|
| G-1 | `CreateSpecializationCommand` and `EditSpecializationDto` carry `name`, `price`, `category`, `status` - the specification has no price or category for a specialization, and both are required by backend validation (`Please, enter the price`, `Please, choose the service category`) | US2 create and US4 edit cannot be submitted as specified | Request backend change: specialization payload = `{ name, status }` (+ optional nested `services[]`). Then regenerate `npm run api:services` | **Still blocked (backend)**. Decision recorded: no placeholder `price`/`category` is sent. The frontend, its unit tests and the production build are complete; real create/edit submits fail backend validation until the payload changes |
| G-2 | `POST /Specialization` is generated as `Observable<void>`, so the created id needed to append services is not typed/available | US2 cannot attach service rows to the new specialization | Backend `[ProducesResponseType]` with `ApiResponse<Guid>` (route already returns 201 with that body) or extend the existing overlay script `scripts/augment-services-openapi.mjs`; then regenerate | **Closed**. `scripts/augment-services-openapi.mjs` now declares `201 ApiResponseOfGuid`; regenerated `specializationPost` returns `Observable<ApiResponseOfGuid>` |
| G-3 | `specializationIdPut` / `specializationIdStatusPatch` have no declared success responses in the generated client | Success handling relies on HTTP status only; acceptable but untyped | Extend the overlay to declare 204, or add backend `[ProducesResponseType(204)]` | **Closed**. Overlay declares `204` for PUT and PATCH; regenerated methods return `Observable<void>` |
| G-4 | Deactivation cascade is backend-only and currently absent for services (no service update in `EditSpecializationStatusHandler`) and for doctors (no ProfilesAPI consumer of the specialization status event) | US5 AC-2 / FR-040 cannot pass end-to-end | Backend change request; frontend always calls only `specializationIdStatusPatch` and does not compensate | **Still blocked (backend)**. Immediate status change and rollback are implemented and unit-tested; no cascade logic exists in the browser |
| G-5 | No service delete operation | "Discard row" is limited to rows added in the current session, as specified | None - matches FR-037 | **Accepted**. The writer never deletes stored services; Discard is rendered only for rows with `id === null` |

A frontend-only interim for G-1 (sending a placeholder price/category) is **rejected**: it would
persist fabricated business data. The create/edit code, specs, test suite and production build are
delivered; only the backend payload change (G-1) and the backend cascade (G-4) remain as follow-up
backend requests before the end-to-end quickstart scenarios V2/V4/V5 can pass.

## Complexity Tracking

> No Constitution Check violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | - | - |
