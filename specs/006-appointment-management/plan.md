# Implementation Plan: Appointment Management

**Branch**: `006-appointment-management` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-appointment-management/spec.md`

## Summary

Deliver the reception workspace for appointments inside `AdminApp`: a cascading creation modal (patient, specialization, doctor, service, office, date, slots), a filterable appointments table with the required multi-level ordering, one-click approval, and confirmed permanent cancellation.

The technical approach is:

1. **One canonical signal store per screen**, fed by `ReactiveFormsModule` and bridged with `toSignal()`. All cascade interdependencies live in a **pure reducer** (`reduceAppointmentCascade`) so the form has no subscription spaghetti and every rule is unit-testable. `@ngrx/signals` is not part of this project; adding a state library for one form is not justified (see `research.md`, D1).
2. **Appointments data only through a generated OpenAPI client.** `ng-openapi-gen` currently covers the Services API alone. A second client is generated from an appointments OpenAPI overlay using the same pattern as `scripts/augment-services-openapi.mjs`; no HTTP service, DTO, or path is written by hand.
3. **Angular CDK for overlays**: `@angular/cdk/dialog` for the creation modal and both confirmation dialogs, `@angular/cdk/overlay` for every autocomplete listbox. The table stays native HTML + Tailwind.
4. **Filtering and ordering server-first, client-defensive**: the appointments API already filters by date, doctor name, service name, approval flag, and office, and already orders by time → doctor surname → doctor name → service name. A pure client comparator re-applies the ordering after any optimistic update.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21.2 (standalone APIs, signals, `ChangeDetectionStrategy.OnPush`)

**Primary Dependencies**: `@angular/forms` (Reactive Forms), `@angular/cdk` 21.2 (`dialog`, `overlay`, `a11y`), RxJS 7.8, Tailwind CSS 4, `ng-openapi-gen` 1.1

**Storage**: No client persistence. Catalogs are cached in memory per session; appointments live in the backend.

**Testing**: Vitest 4 with jsdom through `ng test`; Angular `TestBed` component tests; pure-function tests for the cascade reducer, comparator, filter mapping, and error mapping.

**Target Platform**: Admin SPA in a modern desktop/mobile browser, served behind the Gateway at `/appointments`, `/profiles`, `/services`, `/offices`.

**Project Type**: Web application frontend (single Angular workspace at `AdminApp/`).

**Performance Goals**: A generated table renders within 2 seconds for a day with 300 appointments; catalog loads are cached and reused across modal reopenings; typing in a filter or combobox does not trigger redundant network calls.

**Constraints**: No `any`; no hand-written HTTP clients/DTOs; standalone components with `OnPush`; overlays via CDK; Tailwind utility classes only; no hanging subscriptions; receptionist-only access.

**Scale/Scope**: One route (`/appointments`), one creation modal, one filter panel, one table, three shared primitives (dialog, combobox, date field), one generated API client, roughly 20 new files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Standalone & Smart/Dumb | All new components `standalone: true`, `OnPush`, no `NgModule`; page and modal own state and API calls; table/filters/dialogs receive inputs and emit outputs | PASS |
| II. Automated API integration | Appointments and profiles/offices calls go through generated clients only; missing contracts pause work (see Gating Prerequisites) | PASS with prerequisite **P-1** |
| II. Centralized error interception | 401/403/500 remain in existing `auth-error.interceptor` / `api-error.interceptor`; feature code maps domain errors to notifications only | PASS |
| III. Signals first | `toSignal()` bridges `valueChanges`; `computed()` derives options and validity; a single `effect()` synchronizes the store to the form; commands use `firstValueFrom` inside async handlers, so no manual subscriptions exist | PASS |
| IV. Tailwind + CDK | Native table with Tailwind; dialogs on `@angular/cdk/dialog`; combobox panels on `@angular/cdk/overlay`; no `@apply`, no component stylesheet | PASS |
| V. Strict TypeScript | No `any`; API payloads enter as `unknown` and are narrowed by guards in the generated-client adapter layer; no `I` prefixes | PASS |
| Scope & directories | Work confined to `Frontend/AdminApp/AdminApp/src/app/{features/appointments, shared, api, core}`; backend read-only | PASS |

**Legacy note (pre-existing, not introduced here):** `src/app/api/{doctor,office,specialization}.service.ts` are hand-written clients that predate this feature. This plan MUST NOT extend them; every new call uses a generated client. Migrating them is out of scope.

## Gating Prerequisites

These must be resolved before `/speckit.tasks` execution reaches the affected tasks. They are contract gaps, not design choices.

| ID | Gap | Impact | Resolution |
|---|---|---|---|
| **P-1** | No generated client for the Appointments API. Swagger is exposed at Gateway `/appointments/swagger/v1/swagger.json` (`SwaggerKey: appointments`). | Blocks creation, list, approve, delete, slots. | Add `openapi/appointments.openapi.json` + `scripts/augment-appointments-openapi.mjs` (same overlay pattern as the services script), a second `ng-openapi-gen` config, and `provideAppointmentsApiConfiguration()`. **Do not** hand-write the client. |
| **P-2** | No patient search/list endpoint exists in ProfilesAPI (`/api/Patients` exposes only `POST confirm`, `POST force-create`, `GET account/{accountId}`, `GET {id}`). | Blocks the patient combobox and FR-011 validation. | Backend must expose a Receptionist-readable patient search (`GET /api/Patients?search=&page=&pageSize=`). Until then the patient field cannot be implemented; "Create patient" alone is insufficient. |
| **P-3** | AppointmentsAPI doctors expose specialization as a string and no office link; their `Status` is never synchronized (defaults to `Active`), so it cannot express "At work". | Blocks doctor→office auto-fill and the "At work only" rule. | Use ProfilesAPI doctor table (`GET /profiles/doctors/doctors`, which returns `specialization`, `officeAddress`, `status`) as the doctor catalog, and AppointmentsAPI offices for `officeId`. Map doctor→office by normalized address match. Follow-up: backend should expose `officeId` on the doctor read model. |
| **P-4** | Slot length is derived from `ServiceCategory` (Analyses 10, Consultations 20, Diagnostics 30 minutes), not a fixed 20 minutes. | Diverges from spec assumption SC/FR-014. | Use the slots returned by `GET /appointments/schedule/available-time-slots` and the `StartTime`/`EndTime` from the list DTO. Update the spec: slot length is service-category dependent; the "11:00 - 11:20" example is a consultation. |
| **P-5** | Services are linked to specializations only in ServicesAPI; AppointmentsAPI services carry no specialization. | Blocks service↔specialization filtering. | Load `GET /services/specialization` (ids + names) then `GET /services/specialization/{id}` (includes `services[]` with `status`). Cache the assembled `specializationId → services[]` map; IDs are preserved by the appointments service sync. |
| **P-6** | `Reschedule` has no workflow in the spec or the backend. | Row action would be dead. | Render it disabled with an explanatory tooltip, as FR-070 already states. |

## Spec ↔ Backend Contract Notes

| Spec statement | Backend reality | Plan treatment |
|---|---|---|
| Slots are 20 minutes | 10/20/30 by service category | Render server-provided slots and end times; raise a spec amendment (P-4) |
| Doctor must be "At work" | Appointments doctor status always `Active` | Doctor catalog + status filter come from ProfilesAPI rows |
| Filters can be combined | Supported: `Date`, `DoctorName` (substring over first **or** last name), `ServiceName` (substring), `IsApproved`, `OfficeId` | Send every filter; additionally apply exact doctor-name matching client-side because the API cannot match "Surname Name" as one string |
| Sort by time → surname → name → service | Backend applies exactly this ordering | Keep server order, re-apply with a pure comparator after optimistic updates |
| Cancellation deletes permanently | `DELETE /api/Appointments/{id}` | No undo, no soft delete |
| Table shows phone | `PatientPhoneNumber` is included in `ViewAppointmentListDTO` | Render verbatim |

## Project Structure

### Documentation (this feature)

```text
specs/006-appointment-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── appointments-api.md
│   ├── appointment-cascade.md
│   └── ui-contracts.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
AdminApp/
├── scripts/
│   └── augment-appointments-openapi.mjs        # new overlay (mirrors the services overlay)
├── openapi/
│   └── appointments.openapi.json               # generated overlay input (committed)
├── ng-openapi-gen.json                         # existing services config
├── ng-openapi-gen.appointments.json            # new generator config
└── src/app/
    ├── api/
    │   ├── generated/
    │   │   ├── services/                       # existing
    │   │   └── appointments/                   # generated, never edited
    │   └── appointments-api.provider.ts        # rootUrl = ${environment.apiUrl}/appointments
    ├── core/
    │   ├── services/notification.service.ts    # existing
    │   └── validators/catalog-match.validator.ts # reused for combobox text validation
    ├── shared/
    │   ├── components/
    │   │   ├── app-dialog/                     # new: CDK Dialog wrapper (title, slots, actions)
    │   │   ├── app-combobox/                   # new: CDK Overlay combobox (generic, CVA for text)
    │   │   ├── autocomplete/                   # existing; kept for doctor-create, not extended
    │   │   └── confirm-cancel-dialog/          # existing; re-hosted inside app-dialog
    │   └── ...
    └── features/
        └── appointments/
            ├── appointments.routes.ts
            ├── models/
            │   ├── appointment.model.ts        # list row, create payload view models
            │   ├── appointment-form.model.ts   # typed form group, field catalog shapes
            │   ├── appointment-filter.model.ts # filter state + status filter enum
            │   └── appointment-catalog.model.ts# patient/doctor/service/specialization/office options
            ├── services/
            │   ├── appointment-catalog.service.ts      # loads + caches catalogs via generated clients
            │   ├── appointment-form.store.ts           # signal store + reduceAppointmentCascade
            │   ├── appointment-cascade.ts              # pure cascade reducer + option selectors
            │   ├── appointment-filters.service.ts      # filter state → API params, exact-match refinement
            │   ├── appointment-sort.ts                 # pure comparator (time → surname → name → service)
            │   ├── appointment-availability.service.ts # slot fetching + per-doctor availability probes
            │   └── appointments-facade.service.ts      # list/approve/cancel orchestration + notifications
            ├── components/
            │   ├── appointment-create-modal/           # smart container
            │   ├── appointment-filters/                # dumb
            │   ├── appointment-table/                  # dumb
            │   └── appointment-status-badge/           # dumb
            └── pages/
                └── appointments-page/                  # smart page
```

**Structure Decision**: A single feature folder under `features/appointments` following the existing `features/doctors` and `features/services` conventions. Shared, generic primitives (`app-dialog`, `app-combobox`) live in `shared/components`; feature-specific cascading, sorting, and filter logic lives in feature services and is pure where possible.

## Architecture Design

### 1. Reactive form driven by signals (US 1)

- `FormGroup<AppointmentFormGroup>` with non-nullable controls: `patientId`, `specializationId`, `doctorId`, `serviceId`, `officeId`, `date`, `timeSlot`, plus display-only controls for the visible combobox text (`patientText`, etc.).
- The modal never calls `.subscribe()`. `formValueChanges = toSignal(form.valueChanges, { initialValue: form.getRawValue() })` plus `toSignal` over the initial catalogs give the store everything it needs.
- `AppointmentFormStore` holds `catalogs`, `selected` values, `lastEditedField`, and derived `cascade` (pure `computed`).
- **Loop safety**: the cascade is a pure function of `(formValue, catalogs, lastEditedField)` that returns `{ options, autoFill, clear, dateEnabled, slotsEnabled, complete }`. One `effect()` applies only the returned `autoFill`/`clear` entries to the form with `emitEvent: false`, and then calls `form.markAsDirty()`; the store ignores any incoming value equal to its current value. No rule writes into the field that triggered it, so no oscillation is possible.
- Comboboxes use `AppComboboxComponent` with `(optionSelected)` emitting an `AutocompleteOption` (id + label). Typing emits text; the store validates text against the current option set on blur and sets the `invalidCatalog` error used for "Invalid patient name".
- Date and slots are disabled by the cascade (`dateEnabled = specializationId && serviceId`). Clearing either clears date and slot.
- Slots: `GET /appointments/schedule/available-time-slots?doctorId&serviceId&date`. When no doctor is selected yet but specialization + service + date are set, availability probes run per candidate doctor (`forkJoin`, deduplicated and cached by `doctorId|serviceId|date`); when exactly one doctor remains, the cascade auto-fills that doctor.
- "Create patient" opens the existing patient creation flow in a second CDK dialog; on success the returned patient is pushed into the catalog and selected, all other values untouched.

### 2. List, filters, sorting (US 2)

- Filter state is a small signal object: `{ date, doctorId, serviceId, status: 'all' | 'approved' | 'notApproved', officeId }`, with `Generate` flipping `hasGenerated` to `true`.
- `AppointmentFiltersService.toParams(filter)` maps to `GetAppointmentsFilterDTO`: `Date` as `yyyy-MM-dd`, `DoctorName` = selected doctor surname (server narrowing), `ServiceName` = selected service name, `IsApproved` omitted for `all`, `OfficeId` = id.
- After the response, `refineByExactDoctor` keeps only rows whose `doctorFullName` equals the selected doctor's expected `"Surname Name Middle"` display string, because the API substring-matches first and last name separately.
- `sortAppointments(rows)` is a pure comparator: `startTime` ascending, then doctor surname, then doctor name, then service name, using a shared `Intl.Collator` with `sensitivity: 'base'`. It runs after every load and every optimistic update so ordering cannot drift.
- Date changes trigger a reload only when `hasGenerated` is true. Other filter changes re-apply immediately. Failures keep the previous rows and show a notification.
- Row actions: `Approve` (disabled when `isApproved`), `Cancel` (always), `Reschedule` (disabled, tooltip "Reschedule is not available yet").

### 3. Approve and cancel (US 3–4)

- `Approve` calls `PATCH /appointments/Appointments/{id}/approve`, optimistically flips the row's `isApproved` and highlight, and reverts on error with a notification. Per-row in-flight sets prevent double submission.
- `Cancel` opens an `AppDialog` with the exact message; `Yes` calls `DELETE /appointments/Appointments/{id}`, removes the row, and shows the empty state when the last row disappears; `No` closes only.
- Both actions re-apply `sortAppointments` only when values changed (approval does not reorder).

### 4. Shared UI primitives (requirement 3)

- `AppDialogComponent` + `AppDialogService`: wraps `@angular/cdk/dialog` (`autoFocus`, `restoreFocus`, `ariaLabelledBy`, `disableClose` on backdrop), providing header/title/close-slot and footer actions. Used by the creation modal, the exit dialog, and the cancellation dialog.
- `AppComboboxComponent`: accessible combobox with `ControlValueAccessor` for visible text, `input()` options, `output() optionSelected`, keyboard navigation, ARIA wiring, and a suggestion panel rendered in a CDK overlay connected to the input (`matchWidth`, `reposition`, `closeOnScroll`). Replaces ad-hoc dropdown markup for this feature.
- `app-date-field`: thin wrapper over the native `input[type=date]` with Tailwind classes, min/max, and error text, so no date-picker dependency is added.
- Table: native `<table>` with `<thead>`/`<tbody>`, `@for (row of rows(); track row.id)`, `overflow-x-auto`, sticky header, `aria-sort` on sortable headers (visual sort is fixed by spec; `aria-sort` reflects it), highlight class for approved rows.

### 5. API integration (requirement 4)

- Generated `AppointmentsService`, `ScheduleService`, `DoctorsService`, `OfficesService` (from the appointments client) and generated `ProfilesDoctorsService`/`ProfilesPatientsService` (profiles client, added in the same generation step).
- `appointments-api.provider.ts` and `profiles-api.provider.ts` set distinct `ApiConfiguration` instances via `provideApiConfiguration(...)`.
- Envelope handling (`ApiResponse<T>`: `isSuccess`, `message`, `errors`, `data`) is centralized in a small `readApiEnvelope` helper in the generated-client layer; feature services receive typed models only.
- Error messages come from `extractErrorMessage` in the existing api error interceptor; the feature never inspects status codes except for slot conflicts (409) and not-found (404).

### 6. Routing and access

- Lazy route `appointments` guarded by `authGuard` + `roleGuard('Receptionist')`, registered in `AdminApp/src/app/app.routes.ts`.
- Navigation entry "Appointments" added to `app-header` nav items for the Receptionist role only.

## Phase 0: Research

Resolved in [research.md](./research.md):

- D1 Signals vs `@ngrx/signals` for the cascade (project has no dependency; pure reducer + `toSignal` chosen).
- D2 Preventing auto-fill feedback loops while keeping `valueChanges` as the input.
- D3 CDK overlay combobox vs native autocomplete reuse.
- D4 Server-side vs client-side filtering/sorting.
- D5 Generated-client extension strategy for a second microservice.
- D6 Slot/availability strategy and conflict handling.
- D7 Doctor catalog source and "At work" mapping.
- D8 Patient search gap and its gating.
- D9 Testing strategy with Vitest/TestBed.
- D10 Context7 availability (quota exceeded) and fallback sources.

## Phase 1: Design Artifacts

- [data-model.md](./data-model.md) — view models, typed form group, catalog shapes, filter state, API DTO mapping, state transitions, validation rules.
- [contracts/appointments-api.md](./contracts/appointments-api.md) — generated client operations, parameters, envelopes, error mapping, gating checklist.
- [contracts/appointment-cascade.md](./contracts/appointment-cascade.md) — rule matrix, precedence, clearing/auto-fill behavior, availability probing.
- [contracts/ui-contracts.md](./contracts/ui-contracts.md) — component inputs/outputs and dialog/combobox contracts.
- [quickstart.md](./quickstart.md) — runnable validation scenarios mapped to acceptance criteria.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 with the finalized component and service design:

| Gate | Result |
|---|---|
| Standalone/OnPush everywhere | PASS — all planned components declare both; no `NgModule` introduced |
| Smart/Dumb separation | PASS — `AppointmentsPageComponent` and `AppointmentCreateModalComponent` are the only feature containers; filters, table, badge, combobox, and dialog remain presentational |
| Zero hand-written API code | PASS — every network call routes through a generated client; the only new non-generated files are providers and narrowing helpers |
| Signals first, no leaks | PASS — reads via `toSignal`, derivation via `computed`, one guarded `effect`, commands via `firstValueFrom`; no `.subscribe()` in feature code |
| Tailwind + CDK | PASS — CDK dialog/overlay adopted; table and layout use utilities; no `@apply` |
| Strict typing | PASS — no `any`, envelope narrowing from `unknown`, no `I` prefixes |
| Directory architecture | PASS — `features/appointments`, `shared/components`, `api/generated`, `core` reused as intended |

No constitutional violations require justification. The three items in Complexity Tracking are design trade-offs, not gate exceptions.

## Complexity Tracking

| Decision | Why needed | Simpler alternative rejected because |
|---|---|---|
| Four API clients (appointments, profiles, services, offices) | Catalogs and appointments live in different microservices; the constitution forbids hand-written transport code | A single hand-written adapters file would violate Principle II and duplicate DTOs |
| Pure cascade reducer + store alongside a Reactive Form | 20+ interdependent rules and auto-fill require deterministic, testable behavior | Direct per-control `valueChanges` handlers produced implicit ordering and loops in `doctor-create` |
| Doctor→office address matching | AppointmentsAPI exposes no doctor↔office link | Waiting for a backend field would block the entire feature; mapping is isolated in one mapper with a fallback |
