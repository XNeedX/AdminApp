# Implementation Plan: Doctor Directory and Patient Profile

**Branch**: `007-doctor-directory-patient-profile` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-doctor-directory-patient-profile/spec.md`

## Summary

Deliver the Doctors module as three cooperating slices on top of the existing Angular 21 admin app:

1. **Doctor directory** (P2) — one signal-based directory store owns the complete doctor list, the
   cascading name/specialization/office filters and the optimistic inline status update.
2. **Create + edit** (P1/P3) — a single dumb `DoctorFormComponent` renders the create dialog and the
   profile edit mode; the two smart hosts only own submission and navigation.
3. **Patient profile for doctors** (P4) — a doctor-scoped schedule page whose approved rows link to a
   read-only patient profile with CDK-backed tabs.

All transport goes through the generated OpenAPI clients in `src/app/api/generated/*`. Where a
generated operation currently loses its response body (typed `void`), the feature is blocked on
client regeneration rather than worked around with a hand-written HTTP service (see
[contracts/openapi-gaps.md](./contracts/openapi-gaps.md)).

## Technical Context

**Language/Version**: TypeScript 5.9.2, Angular 21.2.26 (standalone components, signals, `strict`
templates, `noPropertyAccessFromIndexSignature`), SCSS-free templates

**Primary Dependencies**: `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router`,
`@angular/cdk` 21.2.14 (`Dialog`, `Overlay`, `a11y`), RxJS 7.8, Tailwind CSS 4.1

**Storage**: N/A — persistence belongs to ProfilesAPI / AppointmentsAPI / ServicesAPI; the SPA keeps
only in-memory signal state and reads/writes through generated clients

**Testing**: Vitest 4 with jsdom, executed through `ng test` (`@angular/build:unit-test`); existing
suite is 32 spec files

**Target Platform**: Modern evergreen browsers; mobile-first responsive admin UI

**Project Type**: Single Angular workspace application (`AdminApp`), feature-first folders under
`src/app/`

**Performance Goals**: Directory usable with 500 doctors — filter combination resolves in < 1 s, one
initial directory load, no re-fetch per keystroke; every component `OnPush`

**Constraints**: Zero `any`, zero hand-written HTTP services/DTOs, generated OpenAPI client only,
Tailwind utilities only (no `@apply`, no component SCSS), overlays and dialogs via Angular CDK,
`@ngrx/signals` is **not** installed (so `rxMethod` is unavailable), no new runtime dependency
without approval

**Scale/Scope**: 4 user stories, 4 new signal stores (`doctor-directory`, `doctor-catalog`,
`patient-profile`, `doctor-schedule`), 1 shared form component, 1 filter panel, 1 table, 1 patient
profile page, 1 minimal schedule page, 2 new routes (5 routes in scope), ~14 new files plus 6 existing
files reworked

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Standalone & Smart/Dumb | Every new component `standalone: true` + `OnPush`; dumb components take `input()` and emit `output()` only; heavy work in `ngOnInit` | PASS — the plan defines 4 dumb presentational components and 4 smart hosts |
| II. Automated Backend API Integration | No hand-written HTTP service, DTO or client interface; generated clients only; missing contract ⇒ pause | PASS with action — see *Gate note* and [openapi-gaps.md](./contracts/openapi-gaps.md) |
| III. Signal-First Reactivity | `signal`/`computed` for local and derived state; RxJS only for async streams; `toSignal()` for template consumption; no unbounded `.subscribe()` | PASS — the store is signal-only; async commands use `firstValueFrom`; `takeUntilDestroyed` wherever a stream is subscribed |
| IV. Tailwind + CDK | Utility classes in templates, no `@apply`, no component stylesheet; overlays/dialogs on CDK | PASS — CDK `Dialog`, `Overlay` (via existing combobox) and `a11y` focus management |
| V. Strict TypeScript | No `any`, no `I`-prefixed types, `unknown` + type guards for transport data | PASS — `readApiEnvelope`/`readApiAcknowledgment` guards already exist and are reused |
| Scope & Layout | Changes confined to `Frontend/AdminApp/`; `core/`, `shared/`, `features/`, `api/` responsibilities respected | PASS — one shared addition (`shared/components/app-tabs`), everything else inside `features/doctors`, `features/profile`, `features/patients` |

**Gate note (Principle II)**: The repository currently contains three hand-written transport
services — `api/doctor.service.ts`, `api/office.service.ts`, `api/specialization.service.ts` — written
before the OpenAPI generator was configured. They are pre-existing technical debt, not a pattern to
extend. This feature **retires all three** and routes every call through the generated clients. Two
generated operations still return `void` (`GET /Doctors/{id}`, `POST /Doctors`) and three more
(`GET /Schedule/doctor/{doctorId}`, `GET /Schedule/patient/{patientId}/history`,
`GET /appointments/{appointmentId}/results`) likewise. Because the constitution forbids hand-written
clients and forbids proceeding on a stale contract, those operations are listed as blocking
prerequisites that must be regenerated before their stories are implemented. No violation is
committed by this plan; the alternative (keeping the hand-written services) is what would violate
the constitution.

## Project Structure

### Documentation (this feature)

```text
specs/007-doctor-directory-patient-profile/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── ui-contracts.md  # Routes, component inputs/outputs, dialog and tab contracts
│   ├── api-contracts.md # Generated-client usage per user story
│   └── openapi-gaps.md  # Blocking contract gaps + required regeneration
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
AdminApp/src/app/
├── api/
│   ├── api-envelope.ts                      # reused guards (readApiEnvelope/readApiAcknowledgment)
│   └── generated/{profiles,appointments,services}/…
│                                            # ONLY transport for this feature
├── core/
│   ├── guards/role.guard.ts                 # reused for role-restricted routes
│   ├── validators/{non-blank,catalog-match,max-date,email-unique}.validator.ts
│   └── services/{auth,notification}.service.ts
├── shared/components/
│   ├── app-combobox/                        # reused (CDK Overlay autocomplete)
│   ├── app-dialog/                          # reused (CDK Dialog confirmations)
│   ├── cancel-confirm-dialog/               # reused verbatim copy for both cancel dialogs
│   └── app-tabs/                            # NEW: accessible Tailwind tablist (CDK a11y)
├── features/doctors/
│   ├── models/
│   │   ├── doctor-form.model.ts             # extended: form group, payload mapping, messages
│   │   ├── doctor-directory.model.ts        # NEW: entry, filter state, catalog option
│   │   └── doctor-table-row.model.ts        # retained, folded into directory entry
│   ├── services/
│   │   ├── doctor-directory.store.ts        # NEW: rows, filters, cascade, status mutation
│   │   ├── doctor-catalog.store.ts          # NEW: specializations + offices via generated clients
│   │   └── doctor-form.mapper.ts            # pure create/update payload mapping
│   ├── components/
│   │   ├── doctor-form/                     # NEW: ONE dumb form for create + edit
│   │   ├── doctor-create-dialog/            # NEW: smart CDK dialog host (US1)
│   │   ├── doctor-filters/                  # NEW: dumb name combobox + cascade dropdowns (US4)
│   │   └── doctor-table/                    # NEW: dumb table with inline status select (US4)
│   └── pages/doctors-page/                  # smart container (US1 + US4)
├── features/profile/
│   ├── components/
│   │   ├── profile-view/                    # retained (read mode)
│   │   └── profile-edit/                    # REMOVED, replaced by doctor-form
│   └── pages/profile-page/                  # smart container (US3), reworked
├── features/patients/
│   ├── models/patient-profile.model.ts      # NEW
│   ├── services/patient-profile.store.ts    # NEW
│   ├── components/patient-personal-info/    # NEW dumb
│   ├── components/patient-results/          # NEW dumb
│   └── pages/patient-profile-page/          # NEW smart (US2)
└── features/schedule/
    ├── models/doctor-schedule.model.ts      # NEW
    ├── services/doctor-schedule.store.ts    # NEW
    └── pages/my-schedule-page/              # NEW minimal schedule surface (US2 precondition)
```

**Structure Decision**: Single Angular project (`AdminApp`), feature-first. The directory belongs to
`features/doctors`; the patient profile belongs to a new `features/patients` domain because it is
patient data consumed by doctors, not doctor data; the minimal schedule surface lives in
`features/schedule` so `appointments` (Receptionist workspace) stays untouched. The tablist is the
only addition to `shared/` because both the patient profile and future screens need an accessible
tab pattern.

### Key design decisions

- **One dumb form, two hosts.** `DoctorFormComponent` receives a required `FormGroup`, the catalogs,
  `mode: 'create' | 'edit'`, `isSubmitting` and `canSubmit`; it emits `submitted`, `cancelled`,
  `photoSelected`, `specializationSelected`, `officeSelected`. It injects nothing. `DoctorCreateDialogComponent`
  and the reworked `ProfilePageComponent` own the form instance, validation and transport.
- **Cascading filters without `valueChanges`.** The directory store holds `rows`, `nameQuery`,
  `specialization` and `officeAddress` signals. `specializationOptions` is `computed` from `rows`
  narrowed by `officeAddress`; `officeOptions` is `computed` from `rows` narrowed by
  `specialization`; `visibleRows` applies all three with AND semantics. There is no writable derived
  state, so no feedback loop and no need for `emitEvent: false`. Full rationale and the rejected
  `FormControl` alternative are in [research.md](./research.md) (R-1).
- **Optimistic status with rollback.** Selecting a status patches the row immediately, disables that
  row's select, sends the update, and on failure restores the previous value and reports the error.
- **Patient link entitlement.** The schedule row renders a link only when `isApproved`; the patient
  route additionally uses a guard that re-checks the doctor's schedule, so a direct URL cannot bypass
  the rule.
- **Directory completeness.** The store aggregates pages until `totalCount` is reached (bounded), so
  FR-027 holds without a pagination widget, and filter cascades stay client-side and instant.

## Blocking prerequisites (must be resolved before implementation)

| ID | Item | Needed by | Required action |
|----|------|-----------|-----------------|
| P-1 | `GET /Doctors/account/{accountId}` is absent from ProfilesAPI and already documented as unimplemented in `contracts/profiles-sign-in.contract.md` | US2, US3 (doctor editing own profile and opening their schedule) | Add the endpoint in ProfilesAPI, then regenerate the Profiles client |
| P-2 | `GET /Doctors/{id}` generated response is `void`; backend returns `DoctorDetailsDto`, which has **no `status`** | US4 (status update needs a full profile body), US3 (edit prefill) | Regenerate with a response schema and include `status` (e.g. `DoctorAdminDto`) |
| P-3 | `POST /Doctors` generated response is `void`, so a business failure (`isSuccess: false`) cannot be detected | US1 | Regenerate with `ApiResponse<Guid>` |
| P-4 | `GET /Schedule/doctor/{doctorId}` and `GET /Schedule/patient/{patientId}/history` generated responses are `void` | US2 | Regenerate with `ApiResponse<IEnumerable<DoctorScheduleDto>>` / `…PatientAppointmentHistoryDto…` |
| P-5 | `GET /appointments/{appointmentId}/results` generated response is `void` | US2 | Regenerate with `ApiResponse<ViewAppointmentResultDto>` |

Stories P1 (create), P2 (directory/filters), P3 (edit) can be implemented as soon as P-2/P-3 land;
P2/P3 status + edit depend on P-2. US2 is blocked by P-1, P-4, P-5. Per the constitution, no
hand-written replacement client may be introduced in the meantime.

## Phase 0 — Research

`research.md` resolves the open technical questions: signal vs `FormControl` cascade handling, the
`rxMethod` availability check, directory pagination strategy, form reuse boundaries, CDK primitives for
tabs/dialogs/comboboxes, generated-client envelope validation, optimistic status semantics, patient
entitlement enforcement and testing strategy. Context7 could not be consulted (quota exceeded); the
fallback verification and its limits are recorded in R-0.

## Phase 1 — Design & Contracts

- `data-model.md` — frontend entities, field-by-field mapping to generated DTOs, validation rules from
  FR-010…FR-017/FR-036, status and mode state transitions.
- `contracts/ui-contracts.md` — routes, smart/dumb boundaries, component input/output signatures,
  dialog data/result shapes, tab and filter-state contracts, exact copy strings.
- `contracts/api-contracts.md` — operation-by-operation mapping from user story to generated method,
  including request parameters and envelope guards.
- `contracts/openapi-gaps.md` — the P-1…P-5 gaps with current vs required schema and the blocking
  protocol.
- `quickstart.md` — prerequisite preflight, run/test/build commands and manual validation scenarios
  per user story with expected outcomes.

## Post-Design Constitution Re-check

| Gate | Result |
|------|--------|
| Standalone + OnPush + Smart/Dumb | PASS — 4 dumb, 4 smart, no service injection in dumb components |
| Generated client only | PASS — P-1…P-5 recorded as blockers; three legacy hand-written services deleted by this feature |
| Signals first | PASS — store and cascade are `computed`; `toSignal` used for catalog streams; commands via `firstValueFrom` |
| Tailwind + CDK | PASS — no component stylesheet added, dialogs/overlay/a11y from CDK |
| Strict TS | PASS — transport narrowed with existing guards, no `any`, no `I` prefixes |
| Scope boundaries | PASS — all paths under `Frontend/AdminApp/AdminApp/src/app` |

## Complexity Tracking

> Fill only if Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |

## Risks

- **Contract latency (high).** P-1…P-5 are outside this repository's editable scope. US2 cannot ship
  before the Appointments/Profiles schemas are published; US4 status update cannot ship before `status`
  is readable from `GET /Doctors/{id}`. Mitigation: implement US1/US4/US3 in dependency order and keep
  the store's data source behind one method so the switch from "aggregate pages" to a richer read model
  is local.
- **Directory aggregation (medium).** Looping pages assumes the backend honours `pageSize`. Mitigation:
  bounded loop (guard against infinite pagination), and a single `loadAll()` entry point.
- **Patient history N+1 (medium).** History rows expose only `ResultId`, so details need one call per
  appointment that has a result. Mitigation: parallel `forkJoin` over results, capped, with a loading
  state per row and a graceful partial-failure message.
- **Tab implementation (low).** CDK has no tab component; ARIA + roving tabindex must be hand-written
  and tested with keyboard navigation.
