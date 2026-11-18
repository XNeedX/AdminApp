# Phase 0 Research: Appointment Management

**Feature**: `006-appointment-management` | **Date**: 2026-11-15

## Research Inputs

| Source | Used for |
|---|---|
| `specs/006-appointment-management/spec.md` | Required behavior, ACs, assumptions |
| `.specify/memory/constitution.md` v1.1.0 | Architectural gates |
| `AdminApp/package.json`, `angular.json`, `app.config.ts` | Framework and dependency reality |
| `AdminApp/src/app/features/doctors/*` | Existing cascading-form and modal patterns |
| `AdminApp/src/app/shared/components/*` | Reusable autocomplete and confirmation dialog |
| `AdminApp/src/app/api/*`, `ng-openapi-gen.json`, `scripts/augment-services-openapi.mjs` | API generation conventions |
| `Backend/AppointmentsAPI`, `Backend/ProfilesAPI`, `Backend/ServicesAPI`, `Backend/OfficesApi`, `Backend/GatewayAPI/ocelot.json` | Read-only contract verification |

## Context7 Status

Context7 was invoked twice as requested:

1. `resolve-library-id` for `Angular` with the query "Reactive form valueChanges to signals, toSignal, forms best practices".
2. `query-docs` for `/angular/angular` with the query "Reactive forms valueChanges toSignal best practices".

Both calls failed with: `Monthly quota exceeded. Create a free API key at https://context7.com/dashboard for more requests.` No Context7 documentation could be retrieved, so no Context7 findings are cited in this plan.

Fallback used instead:

- The Angular 21 API surface actually present in `node_modules` and already exercised in this repository (`toSignal`, `takeUntilDestroyed`, `effect`, signal inputs/outputs).
- Existing project precedent (`doctor-create.component.ts` for `valueChanges` handling; `doctors-page.component.ts` for command + notification flow).
- `@angular/cdk` 21 usage already available in the workspace (`@angular/cdk` is a direct dependency).

Consequence: the plan deliberately relies only on stable, already-available APIs. If the team can supply a Context7 key, re-validate D1–D3 before implementation; the design does not depend on any preview/experimental API.

---

## D1. Cascade state: signals + pure reducer, not `@ngrx/signals`

**Decision**: Keep one signal-based feature store (`AppointmentFormStore`) whose behavior is a pure function `reduceAppointmentCascade(value, catalogs, lastEditedField)`, bridged to the Reactive Form with `toSignal(form.valueChanges, { initialValue })`.

**Rationale**:

- `@ngrx/signals` is **not** a dependency of `AdminApp/package.json`. Adding a state library for one modal contradicts the constitution's preference for signals and would expand the review surface.
- The cascade has 20+ rules with several sources per field; a reducer makes the precedence explicit, side-effect free, and directly unit-testable with Vitest (no `TestBed`).
- `toSignal` is the idiomatic bridge and keeps `ReactiveFormsModule` as the user-input mechanism, which the request requires.

**Alternatives considered**:

- `rxMethod` from `@ngrx/signals`: satisfies the request's optional wording but adds a dependency and a second state paradigm next to plain signals; rejected.
- One `valueChanges.subscribe()` per control: produced implicit ordering, race conditions, and cleanup burden in `DoctorCreateComponent`; rejected.
- `signal()`-only form (no Reactive Forms): conflicts with the explicit requirement and loses `Validators` composition.

## D2. Loop-safe auto-fill while keeping `valueChanges` as the trigger

**Decision**: `form.valueChanges` → `toSignal` → `computed` cascade plan → **one** `effect()` that writes only `autoFill`/`clear` entries with `{ emitEvent: false }`, guarded by value equality and a `lastEditedField` discriminator.

**Rationale**:

- Writing into a control that triggered the computation is the classic source of infinite loops. The reducer never emits a change for the field that produced the action, and the equality guard makes any duplicate a no-op.
- `lastEditedField` encodes intent: selecting a doctor must auto-fill office (doctor wins), while selecting an office must filter/clear an incompatible doctor (office wins). Without it, the two rules fight.
- `emitEvent: false` keeps the cascade authoritative; the store updates its own `selected` signal in the same tick, so the view and the form never diverge.

**Alternatives considered**:

- `effect()` that reads the whole form and writes back unconditionally: unstable, would fire on its own writes, and fights Angular's effect scheduling.
- Deriving display values instead of writing: would violate AC-13/14/25 (fields visibly auto-fill and are then submitted).

## D3. Combobox and dialogs on Angular CDK

**Decision**: Introduce `AppComboboxComponent` (CDK Overlay suggestion panel + existing ARIA/keyboard behavior) and `AppDialogComponent`/`AppDialogService` on `@angular/cdk/dialog`. Keep `app-autocomplete` untouched for the legacy doctor form.

**Rationale**:

- The request explicitly requires CDK for comboboxes and dialogs.
- The existing `app-autocomplete` renders its listbox inline; inside a modal with `overflow` and on small screens the panel clips. A CDK connected overlay fixes positioning, width matching, and scroll handling.
- `@angular/cdk/dialog` provides focus trap, `restoreFocus`, `ariaLabelledBy`, and Escape/backdrop policy, satisfying the spec's dialog accessibility edge cases without hand-rolled focus management.
- Native `<table>` keeps the bundle small and matches the request.

**Alternatives considered**:

- Extending `app-autocomplete` in place: risks regressions in the doctor creation flow and mixes presentation styles; rejected.
- A third-party UI kit: unnecessary dependency, violates the utility-first constraint.
- Native `<dialog>` with manual focus management: workable but re-implements CDK behavior the project already depends on.

## D4. Filtering and sorting: server-first, client-defensive

**Decision**: Send all filters to `GET /appointments/Appointments/receptionist`; rely on the backend's existing ordering; then run `sortAppointments()` (pure comparator) on the result and after any optimistic mutation.

**Rationale**:

- Backend already orders `TimeSlot → Doctor.LastName → Doctor.FirstName → Service.Name` (`AppointmentManagmentService.GetFilteredAppointmentsAsync`), so a second server round-trip per sort is unnecessary.
- The response has no doctor id, only `DoctorFullName`, so exact doctor filtering must be refined client-side; the comparator uses the same display strings.
- Optimistic approve/cancel updates mutate local rows; the comparator guarantees the spec's ordering invariant after such updates.

**Alternatives considered**:

- Server-side sort parameters: the endpoint accepts none; adding them would require a backend change with no user-visible gain for a single-day list.
- Full client-side filtering: would download every appointment for all dates; rejected for scale.

## D5. Generated-client strategy for a second microservice

**Decision**: Replicate the established overlay + generator pattern: `scripts/augment-appointments-openapi.mjs` → `openapi/appointments.openapi.json` → `ng-openapi-gen.appointments.json` → `src/app/api/generated/appointments`, plus an `appointments-api.provider.ts` that sets `rootUrl = ${environment.apiUrl}/appointments`.

**Rationale**:

- The Gateway exposes `/appointments/{everything}` → downstream `/api/{everything}`; the overlay strips `/api`, exactly like the services overlay does.
- Appointments controllers return `IActionResult`, so the live Swagger lacks response schemas; the overlay adds the envelopes and enum names that the backend actually returns (verified read-only in `AppointmentsAPI.Presentation` and `AppontmentsAPI.Application.DTOs`).
- This keeps the constitution's "zero hand-written API code" intact and gives typed models for `CreateAppointmentDTO`, `GetAppointmentsFilterDTO`, `ViewAppointmentListDTO`, and the doctor/office/service/specialization read models.
- The profiles client is generated the same way because the doctor catalog (status + office address) and patient search must not be hand-written.

**Alternatives considered**:

- Extending the existing hand-written `doctor.service.ts`/`office.service.ts`: explicitly forbidden by the constitution and would deepen legacy debt.
- Generating from a locally running Docker stack in CI: unreliable; the overlay is committed and regenerable.

## D6. Slot and availability strategy

**Decision**: Fetch slots from `GET /appointments/schedule/available-time-slots?doctorId&serviceId&date`; for doctor filtering by availability, probe candidate doctors in parallel through a cached `AppointmentAvailabilityService`; rely on the backend's conflict check and map conflict responses to a slot-selection message.

**Rationale**:

- The backend already computes availability per doctor/service/date and returns formatted `HH:mm` strings, so the client must not re-implement scheduling rules.
- Probing is bounded: candidates are already narrowed by specialization/office/service, and results are cached per `doctorId|serviceId|date`, so a typical form issues a handful of requests.
- The backend validates slot uniqueness (`DoctorId` + `TimeSlot`) and returns a domain error; the spec's conflict edge case is satisfied without client-side locking.

**Alternatives considered**:

- Client-side slot generation from working hours: the API exposes no working-hours endpoint; would duplicate scheduling logic.
- Requiring doctor selection before showing slots: contradicts AC-9/19-20 (date+time drive doctor filtering, and a single remaining doctor is auto-filled).

## D7. Doctor catalog source and "At work"

**Decision**: Build the doctor catalog from ProfilesAPI `GET /profiles/doctors/doctors` (`DoctorTableRowDto`), keep only `status === 'At work'`, and map each doctor to an appointments office by normalized `officeAddress` → office `address`.

**Rationale**:

- AppointmentsAPI `Doctor` carries specialization as a string and **no office**, and its `Status` is never synchronized (always `Active`). It cannot satisfy the "At work" rule or doctor→office auto-fill.
- `DoctorTableRowDto` exposes exactly the needed fields: id, first/last/middle name, specialization, office address, status.
- Office ids are preserved by the appointments sync (`OfficeSyncService` uses `dto.Id`), so address-based mapping yields a usable `officeId`; the mapper is isolated and returns `null` when no match exists (the form then treats office as unset).

**Alternatives considered**:

- Trusting appointments doctor status: produces doctors on leave in the list; rejected.
- Adding an office field to the backend sync: correct long-term, but blocked for this frontend-only plan; recorded as follow-up P-3.

## D8. Patient catalog gap

**Decision**: Treat patient search as a blocking prerequisite (P-2). The plan defines the expected contract and keeps the patient picker behind a typed adapter; it does not invent a client call.

**Rationale**:

- No profiles/patients list or search endpoint exists; only create/force-create/link/get-by-id/get-by-account.
- The constitution requires pausing on missing contracts rather than fabricating endpoints.
- The creation modal still supports "Create patient" (which returns a patient id) and can select the newly created patient, but choosing an existing patient cannot be implemented until the endpoint exists.

**Alternatives considered**:

- Loading patients by guessing ids: impossible.
- Using `GET /profiles/patients/{id}` with an id typed by the receptionist: unacceptable UX and not in the spec.

## D9. Testing strategy

**Decision**: Vitest unit tests for `reduceAppointmentCascade`, `sortAppointments`, filter mapping, envelope narrowing, and availability caching; TestBed component tests for the page, modal, table, combobox keyboard behavior, and dialog actions.

**Rationale**: Matches the existing `*.spec.ts` convention and the workspace's `vitest` + jsdom setup; the pure reducer removes most of the need for fragile DOM-driven cascade tests. No e2e framework exists in the workspace, so end-to-end behavior is covered by the manual quickstart.

**Alternatives considered**: Introducing Playwright would add infrastructure outside this feature's scope.

## D10. Context7 research integration

**Decision**: Document the failed attempt and proceed with repository-verified API usage; no Context7 claim is cited.

**Rationale**: Both Context7 calls returned a quota error, so there is no retrieved evidence to cite. Fabricating citations would be misleading.

**Alternatives considered**: Retrying later in the session — the error is a monthly quota, not transient.

---

## Resolved Unknowns

| Unknown | Resolution |
|---|---|
| Angular version and form approach | Angular 21.2, Reactive Forms + `toSignal` (D1) |
| State library | None added; pure reducer + signals (D1) |
| Loop-safe auto-fill | `lastEditedField` + equality-guarded `effect` with `emitEvent: false` (D2) |
| Combobox/dialog primitives | CDK overlay + CDK dialog (D3) |
| Sort location | Backend order + pure client comparator (D4) |
| Missing appointments client | Generated via overlay (D5, P-1) |
| Slot source | Backend schedule endpoint (D6, P-4) |
| Doctor availability of "At work" | ProfilesAPI table (D7, P-3) |
| Patient selection | Blocked pending backend search endpoint (D8, P-2) |
| Testing | Vitest + TestBed (D9) |

## Remaining Risks

1. **Patient endpoint (P-2)** blocks a P1 acceptance criterion; it cannot be worked around in the frontend.
2. **Doctor→office address matching** is string-based and can mis-map if address formats drift. Mitigation: single mapper, normalized comparison, explicit "no office resolved" state, and a follow-up backend field.
3. **Slot duration mismatch (P-4)** will make the spec's 20-minute assumption fail for analyses/diagnostics; the spec should be amended before tasks are finalized.
4. **ProfilesAPI doctor status vs appointments doctor** may differ during sync lag; the UI trusts ProfilesAPI, which is the status authority.
5. **Gateway swagger availability** is required to regenerate the appointments client; the overlay script should accept a local file path as a fallback.
