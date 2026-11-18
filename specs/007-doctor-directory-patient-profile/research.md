# Phase 0 Research — Doctor Directory and Patient Profile

**Feature**: `007-doctor-directory-patient-profile` | **Date**: 2026-11-17

## R-0. Context7 verification (requested, unavailable)

**Decision**: Treat the Context7 consultation as attempted and failed, and verify the API surface
against the installed Angular 21.2.26 type definitions instead.

**Evidence**: `tools.context7["resolve-library-id"]` and `query-docs` were called twice for
"Angular → `toSignal`" and "`@ngrx/signals` → `rxMethod`". Both calls returned:

> `Monthly quota exceeded. Create a free API key at https://context7.com/dashboard for more requests.`

**Fallback verification performed**

| Claim | Verified against |
|-------|------------------|
| `toSignal(source, { initialValue })` overloads exist and clean up through the injection context | `AdminApp/node_modules/@angular/core/types/rxjs-interop.d.ts` (lines 144–157 declare the overload set; `manualCleanup`/`injector` options documented above it) |
| `linkedSignal` and `computed` are available (used for derived filter state) | `AdminApp/node_modules/@angular/core/types/core.d.ts` |
| Angular version is 21.2.26 | `AdminApp/node_modules/@angular/core/package.json` |
| `@ngrx/signals` (the package that owns `rxMethod`) is **not** a dependency and not installed | `AdminApp/package.json` dependencies; `AdminApp/node_modules/@ngrx/signals` does not exist |
| CDK 21.2.14 provides `Dialog`, `Overlay` and `a11y` | `AdminApp/node_modules/@angular/cdk/package.json`; existing usage in `shared/components/app-dialog` and `shared/components/app-combobox` |

**Limitation**: the Context7 consultation could not confirm current upstream guidance or any
post-21.2 API changes. If the reviewer requires the Context7 pass, it must be repeated with a working
API key; nothing in this plan depends on undocumented API surface — every API used is already present
in this repository today.

## R-1. Cascading office/specialization filters

**Decision**: Implement the cascade with signals only. A `DoctorDirectoryStore` holds
`rows`, `nameQuery`, `selectedDoctorId`, `specialization` and `officeAddress` as writable signals;
`specializationOptions`, `officeOptions`, `visibleRows`, `hasActiveFilters` and `isEmpty` are
`computed`. Filters are applied client-side. No `FormControl`, no `valueChanges`, no `emitEvent`.

**Rationale**

- The requirement's cycle (office narrows specialization, specialization narrows office) is a
  *derivation*, not an event. Expressing it as `computed` makes the cycle impossible: options are
  recomputed from the current pair of selections in one pass, and no write-back occurs.
- One source of truth. With `valueChanges`, programmatic option updates need `emitEvent: false`, plus
  guards for "was this change user-initiated?", plus ordering rules for which filter wins when both
  are set. Every one of those is a bug surface the signal version does not have.
- Constitution Principle III mandates signals for synchronous/derived local state.
- The existing `AppointmentsPageComponent` + `AppointmentFiltersComponent` pair already proves the
  pattern in this codebase: dumb panel receives a complete state object as `input()`, emits a
  complete replacement state, smart host stores it.

**Shape of the derivation**

```text
specializationOptions = distinct(sort(rows where officeAddress ∈ {''} ∪ {officeAddress}.specialization))
officeOptions         = distinct(sort(rows where specialization ∈ {''} ∪ {specialization}.officeAddress))
visibleRows           = rows where nameQuery matches fullName
                             and selectedDoctorId ∈ {''} ∪ {id}
                             and specialization ∈ {''} ∪ {specialization}
                             and officeAddress ∈ {''} ∪ {officeAddress}
```

Clearing a filter re-widens the other options automatically, so FR-024's "clear all" is a single
`resetFilters()` call. If a previously selected value disappears from the narrowed option list (edge
case in the spec), an `effect` resets that one filter instead of leaving an impossible combination.

**Alternatives considered**

| Alternative | Why rejected |
|-------------|--------------|
| `FormControl` + `valueChanges` + `emitEvent: false` for programmatic narrowing | Two sources of truth (control value and option list) and a bidirectional dependency. `emitEvent: false` hides the loop but not the ordering problem: the narrowed list must be written before the user can pick from it, yet after the other control settles. Also harder to unit test than a pure `computed`. |
| `rxMethod` (as suggested in the request) | `@ngrx/signals` is not installed. Adding a state-management dependency for two filters contradicts the constitution's "no new dependency without need" spirit and duplicates Angular's own signal primitives. |
| Server-side filtering on every change (`?specialization=`/`?officeAddress=`) | Each keystroke or selection triggers a request; the cascade needs the full mapping doctor → specialization → office, which the filtered list does not return. Combined with FR-027 (see every doctor) this means loading everything anyway. |

## R-2. Async data flow: `toSignal` vs `rxMethod`

**Decision**: Use `toSignal()` for read streams that the template consumes directly (catalogs and the
initial directory load), and `firstValueFrom()` inside store commands for imperative operations
(create, save, status update). Keep `takeUntilDestroyed(this.destroyRef)` on any `Observable` that is
subscribed rather than converted.

**Rationale**: This is exactly the split the codebase already uses — `ProfilePageComponent` uses
`toSignal` for `statusChanges`, while `AppointmentsFacadeService` uses `firstValueFrom` for commands.
It keeps the store synchronous to callers (`await store.load()`), which makes rollback logic and
optimistic updates straightforward.

**Alternatives considered**: `rxMethod` (unavailable, see R-0); `resource()`/`rxResource()` (Angular
21 has them, but they are still experimental/developer-preview for this use and would add a second
loading paradigm next to the existing facade style); manual `.subscribe()` (allowed only with
`takeUntilDestroyed`, but it scatters state writes).

## R-3. Directory loading and FR-027 (all doctors, beyond one page)

**Decision**: `DoctorDirectoryStore.loadAll()` requests `pageSize = 100` pages sequentially until
`totalCount` is reached, with a hard page cap (50) and a guard for empty pages. Rows are stored once;
filters and status changes never trigger a reload.

**Rationale**: The list endpoint filters on `searchName`, `specialization` and `officeAddress`
server-side, but the cascade needs the *whole* doctor→specialization→office mapping. Loading once also
satisfies FR-027 without adding a pagination UI (out of scope in the spec) and makes SC-005 (500
doctors, < 1 s filtering) achievable because filtering is in-memory.

**Alternatives considered**: pagination widget (not requested, and would break "options reflect all
doctors"); server-side filtering per filter change (network chatter, cannot derive the cascade);
`pageSize = 500` single request (relies on an undocumented backend cap; still kept as a fallback if
`totalCount` is missing).

## R-4. One dumb form for create and edit

**Decision**: Extract `features/doctors/components/doctor-form/doctor-form.component.ts` as a dumb,
standalone, `OnPush` component. It renders the photo preview/upload, first/last/middle name, date of
birth, email, specialization combobox, office dropdown, career start year, status dropdown and the two
actions. Inputs: `form: FormGroup<DoctorFormGroup>`, `mode: 'create' | 'edit'`,
`specializations`, `offices`, `photoPreview`, `photoError`, `isSubmitting`, `canSubmit`,
`emailReadonly`. Outputs: `submitted`, `cancelled`, `photoSelected`, `specializationSelected`,
`officeSelected`.

Hosts: `DoctorCreateDialogComponent` (create, inside a CDK dialog) and `ProfilePageComponent`
(edit mode). `ProfileEditComponent` and `DoctorCreateComponent` are removed; their markup and message
helpers move into the shared form.

**Rationale**: Requirement 2 of the plan request; eliminates the duplicated validation-message
functions that currently exist in both `ProfileEditComponent` and `DoctorCreateComponent`'s template.
Keeping the form dumb preserves Principle I — no `inject()` inside it.

**Alternatives considered**: keeping two components and sharing a service (duplicated markup, two
places to fix a message); using the profile form for creation (email is editable in create, read-only
in edit; hiding a control in one mode is cheaper than branching two templates).

**Placement note**: the form lives under `features/doctors` because both hosts are doctor-facing. The
`profile` feature imports it, which is an allowed feature→feature dependency only for this shared
doctor surface; no patient data crosses the boundary.

## R-5. Validation messages and when they appear

**Decision**: Reuse `nonBlankValidator` for text fields (same `required` key, so whitespace-only input
shows the "please enter" message, FR-014), `maxDateValidator`/`maxYearValidator` for date limits,
`catalogMatchValidator` for specialization/office text, and replace `emailUniqueValidator`'s dependency
on the hand-written `DoctorService` with a callback that calls the generated
`DoctorsService.doctorsDoctorsGet` (`searchName = email`) and compares emails case-insensitively.

Message mapping (exact copy, rendered only for touched + invalid controls):

| Field | Empty | Invalid |
|-------|-------|---------|
| first name | `Please, enter the first name` | — |
| last name | `Please, enter the last name` | — |
| email | `Please, enter the email` | `You've entered an invalid email` / `User with this email already exists` |
| date of birth | `Please, select the date` | future date message |
| specialization | `Please, choose the specialisation` | `Invalid specialization name` |
| office | `Please, choose the office` | — |
| career start year | `Please, select the year` | future year message |
| status | `Please, choose the status` | — |

**Rationale**: These strings are contractual (spec FR-011…FR-013) and already exist in
`ProfileEditComponent`; centralising them in the shared form guarantees create and edit cannot drift.
Hiding a message until `touched` implements "empty on blur → red border + message".

**Note**: the doctors table endpoint returns `DoctorTableRowDto` without email, so the uniqueness check
must use `GET /Doctors` (list) or the future dedicated check. If the list call cannot confirm
uniqueness, the form still blocks on the server's 409 and shows `User with this email already exists`
(FR-008). Recorded as a known limitation in `contracts/api-contracts.md`.

## R-6. Tabs for the patient profile

**Decision**: New `shared/components/app-tabs/app-tabs.component.ts` — dumb, `OnPush`, Tailwind-styled
`role="tablist"` with `aria-selected`, `aria-controls`, roving `tabindex`, and keyboard support
(`ArrowLeft`/`ArrowRight`/`Home`/`End`) driven by `FocusKeyManager` from `@angular/cdk/a11y`.
Panels use `role="tabpanel"` with `aria-labelledby`.

**Rationale**: Angular CDK has no tab component, and the requirement explicitly asks for Tailwind +
CDK rather than a UI kit. `FocusKeyManager` supplies the correct roving-focus behaviour instead of
hand-rolled index math, and the component is reusable for future screens.

**Alternatives considered**: `<details>`/native disclosure (no tab semantics); adding a UI library
(new runtime dependency, contradicts "Tailwind only"); keeping the tabs inline in the patient page
(untestable duplication, no keyboard contract).

## R-7. Cancel dialogs

**Decision**: Reuse `CancelConfirmDialogComponent` through `Dialog.open` exactly as
`ProfilePageComponent` does today. Two constants, verbatim:

- create: `Do you really want to cancel? Entered data will not be saved.`
- edit: `Do you really want to cancel? Changes will not be saved.`

The dialog closes with `boolean`; `true` discards and returns to the previous mode/page, `false` keeps
the form and its data. `disableClose: true` ensures Escape does not silently discard data.

**Rationale**: Already CDK-based (focus trap, restoration), already tested
(`cancel-confirm-dialog.component.spec.ts`), and the exact copy is parameterised through `data`.

**Alternatives considered**: `AppDialogService.confirm` (its copy is appointment-specific); browser
`confirm()` (no Tailwind, no focus management, not testable).

## R-8. Generated OpenAPI clients and envelope validation

**Decision**: All calls go through imported generated services:

| Concern | Generated service | Method |
|---------|-------------------|--------|
| Directory list | `profiles/services/doctors.service` → `DoctorsService` | `doctorsDoctorsGet({ page, pageSize, searchName?, specialization?, officeAddress? })` |
| Create | same | `doctorsPost({ body })` — blocked, see P-3 |
| Read full doctor | same | `doctorsIdGet({ id })` — blocked, see P-2 |
| Update / status | same | `doctorsIdPut({ id, body })` |
| Specializations catalog | `appointments/services/specializations.service` | `specializationsGet()` |
| Offices catalog | `appointments/services/offices.service` | `officesGet()` |
| Patient profile | `profiles/services/patients.service` | `patientsIdGet({ id })` |
| Doctor schedule | `appointments/services/schedule.service` | `scheduleDoctorDoctorIdGet({ doctorId, date })` — blocked, P-4 |
| Patient history | same | `schedulePatientPatientIdHistoryGet({ patientId })` — blocked, P-4 |
| Appointment result | `appointments/services/appointments-result.service` | `appointmentsAppointmentIdResultsGet({ appointmentId })` — blocked, P-5 |

Every response is narrowed with `readApiEnvelope(payload, guard)` or `readApiAcknowledgment(payload)`
from `api/api-envelope.ts` before reaching feature models, because generated interfaces mark all fields
optional. Feature stores keep their own fully-required domain models.

**Rationale**: Constitution Principle II; the guards close the gap between "generated but all-optional"
and "no `any`, no unvalidated data". Catalogs come from the AppointmentsAPI clients because they are
already typed and already used by the appointments feature.

**Alternatives considered**: keeping `DoctorService`/`OfficeService`/`SpecializationService` (the
constitution's Zero-Manual-API-Code rule forbids extending them, and their ad-hoc envelope sniffing is
what the `api-envelope` guards replaced); adding a thin hand-written wrapper "just for mapping"
(still a hand-written HTTP service, explicitly out of bounds).

## R-9. Inline status change semantics

**Decision**: `DoctorDirectoryStore.setStatus(id, next)`:

1. ignore if unchanged or already saving for that row;
2. snapshot the previous status, patch the row optimistically, mark the row saving;
3. fetch the full profile (P-2 dependent), send `doctorsIdPut` with the complete body and the new
   status;
4. on success: keep the row, toast `Status changed to "<status>"`;
5. on failure: restore the snapshot, show the error (409 uses the server message), re-enable the
   select.

**Rationale**: FR-020 requires instant persistence and rollback; `PUT` needs every field because the
backend replaces the profile, so a full read is mandatory until a dedicated status endpoint exists.
Patience: `finalize`-style cleanup is expressed with `try/finally` since the command is promise-based.

**Alternatives considered**: PATCH with a partial body (no such endpoint); leaving the row unlocked
during the save (double submits); not rolling back (silent data divergence).

## R-10. Patient profile entitlement

**Decision**: Two layers.

1. **UI**: the schedule row renders the patient name as a `<button>`/link only when `isApproved`;
   otherwise it renders plain text with `aria-disabled` semantics.
2. **Route**: `patientProfileGuard` (functional `CanActivateFn`) loads the doctor's schedule for the
   appointment/patient pair and returns `true` only when an approved appointment exists for that patient;
   otherwise it redirects to `/my-schedule`. Role is already enforced by `roleGuard('Doctor')`.

**Rationale**: FR-046 explicitly requires direct-URL protection. Client-side guards are a UX control,
not a security boundary — the backend already authorises `GET /Patients/{id}` for Doctor and
Receptionist — but the spec asks for the interface rule, and the guard is the only way to enforce it.

**Alternatives considered**: hiding only (direct URL bypasses it); server-side enforcement (out of
scope, backend change); storing a one-time token in navigation state (fragile on refresh).

## R-11. Minimal "My schedule" surface

**Decision**: Add `/my-schedule` (Doctor only) rendering one date's appointments from
`ScheduleService`, with patient links per R-10. The doctor's own `doctorId` is resolved from the signed-in
account; because `GET /Doctors/account/{accountId}` does not exist (P-1), this story is blocked until it
does.

**Rationale**: US2 cannot be independently testable without a schedule surface (spec assumption), and
building it here avoids a hidden dependency on an unbuilt page.

**Alternatives considered**: waiting for a separate schedule feature (leaves US2 untestable);
mocking rows in the UI (violates "no fabricated data" and cannot be validated end-to-end).

## R-12. Testing strategy

**Decision**: Vitest unit/component tests for the pure logic and the dumb components:

- cascade: options narrow on office selection, widen on clear, combined AND filter, single-match name
  search, reset-all;
- store: status optimistic patch + rollback on failure, double-click guard, load-all page aggregation
  with `totalCount`, error state;
- form: one component rendered in both modes, exact messages per field, email read-only in edit,
  "save disabled while invalid/submitting";
- dialogs: `true` discards, `false` keeps data (component + host integration);
- tabs: ARIA wiring, keyboard navigation, default tab;
- patient profile: link enabled only when approved, empty state for no results, error state.

`npm run build` and `npm test` are the gates; both were green (32 spec files) before this feature.

**Rationale**: Matches the existing suite layout (`*.spec.ts` next to the unit under test) and the
project's jsdom/Vitest setup; no e2e framework exists in the repo, so manual scenarios live in
`quickstart.md`.

## Open questions carried into implementation

- P-1…P-5 (see plan) are external contract items, not design unknowns.
- If `GET /Doctors/{id}` gains `status` (P-2), the directory's status update can skip the table-row
  fallback entirely; the store is written so only one method changes.
