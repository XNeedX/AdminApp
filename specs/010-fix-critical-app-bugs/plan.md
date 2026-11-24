# Implementation Plan: Bugfix Iteration 1 — Critical AdminApp Defects

**Branch**: `010-fix-critical-app-bugs` | **Date**: 2026-11-19 | **Spec**: `specs/010-fix-critical-app-bugs/spec.md` (template — see "Spec Gap" below)

**Input**: Bugfix Iteration 1 request (`Frontend/AdminApp`, rules per `AGENTS.md`).

## Spec Gap (read first)

`spec.md` in this feature folder is still the **unfilled template**. The actual defect
descriptions live in `.specify/bugs/*/fix.md` (previously applied reports) and in the
iteration request. This plan treats the iteration request + verified code diagnosis as the
requirement contract. **`/speckit-specify` should be run (or `spec.md` filled manually)
before `/speckit-tasks`**, otherwise tasks will be generated from placeholders.

## Summary

Three defects are in scope. Diagnosis against the working tree (branch `develop`,
uncommitted changes present) produced **one hard blocker** and two code-level fixes:

| # | Defect | Verified root cause | Status |
|---|--------|--------------------|--------|
| 1 | Sign-in fails / 401 storm | Invariants in `AuthService`/interceptor verified correct; failure is Keycloak realm config + stale `develop` branch auth model. Residual code risk: competing auth approach (see research) | Fixable; needs runtime confirmation |
| 2 | Patient search in Create Appointment | `GET /Patients` was **hand-added** to `openapi/profiles.openapi.json` with **no query parameters** and a **`void`** response. The generated `patientsGet()` is unusable. Catalog loader is full-list, uses `any` | **BLOCKED — API regeneration required** |
| 3 | Receptionists tab crash / empty | Feature code is internally consistent; failure originates in the `@if` chain silently swallowing a validation throw (`readApiEnvelope`) or a role guard redirect | Fixable in code |

**Hard stop (Bug 2)** — per constitution §II *Missing Contract Protocol* and `AGENTS.md`:

> Необходимо обновить сгенерированный API-клиент из актуального swagger.json микросервиса

Phases below plan Bug 1 and Bug 3 fully; Bug 2 is blocked at Phase 1 and resumed only after
the generator re-runs against the real backend Swagger.

## Technical Context

**Language/Version**: TypeScript ~5.9.2, Angular 21.2 (standalone, signals, zoneless-era APIs)

**Primary Dependencies**: `@angular/core`, `@angular/common/http`, `@angular/forms`, `@angular/router`, `@angular/cdk`, `rxjs` ~7.8, `ng-openapi-gen` ^1.1.0 (codegen), `keycloak-angular` ^21 / `keycloak-js` ^26 (recorded in `develop` history via `.specify/bugs/auth-401-bug/fix.md` — absent from current `package.json`)

**Storage**: `sessionStorage` (auth session) via `AUTH_SESSION_STORAGE_KEY`

**Testing**: Vitest 4 (`ng test`, jsdom); existing specs — `auth.service.spec.ts`, `app.config.spec.ts`, `api-error.interceptor.spec.ts`, `auth-error.interceptor.spec.ts`, `appointment-cascade.spec.ts`, `appointment-availability.service.spec.ts`, `appointment-create-modal.component.spec.ts`

**Target Platform**: Browser SPA (`localhost:4200`), Gateway `localhost:5137`, Keycloak `localhost:8080`, realm `InnoClinic`

**Project Type**: Web application (Angular frontend only — scope confined to `Frontend/AdminApp/`)

**Performance Goals**: Patient search debounce ≤ 300 ms; catalog load reuses `shareReplay` cache; no duplicate in-flight requests (`switchMap` cancels stale)

**Constraints**: Zero `any`; zero hand-written API contracts; `HttpInterceptorFn` only; OnPush everywhere; no hanging subscriptions

**Scale/Scope**: 3 bugs; ~6 source files + 4 spec files + 1 codegen artifact set

**Context7**: Requested as a pre-step. **The `context7` MCP server is not registered in this
session** (not present in tool list; `ToolSearch` returned no match). Current syntax was
therefore verified against installed `@angular/*` sources/types in `node_modules` and the
official Angular 21 API surface, and recorded in `research.md`. If Context7 is attached later,
the items marked *[Context7]* in `research.md` should be re-verified before implementation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Result |
|-----------|------|--------|
| I. Standalone / Smart-Dumb / OnPush | New/changed components standalone + OnPush; smart keeps API calls, dumb stays presentational | **PASS** — no new components planned; edits preserve the split (`AppointmentCreateModalComponent` smart, `ReceptionistTableComponent` dumb) |
| I. Lifecycle cleanliness | No heavy constructor logic | **PASS** — existing `constructor` + `effect()` slot wiring in create modal is pre-existing; new work moves to `ngOnInit` / declarative streams |
| II. Zero manual API code | No hand-written HTTP services/DTOs | **PASS** (enforced) — Bug 2 explicitly **stops** and requests regeneration rather than writing a manual client. Note: current `patientsGet` was produced from a *hand-edited* OpenAPI file; that edit must be reverted |
| II. Centralized error interception | Global 401/403/500 in `HttpInterceptorFn` | **PASS** — `authErrorInterceptor` + `apiErrorInterceptor` remain the single entry point |
| II. Missing contract protocol | Stop when contract missing/incorrect | **PASS** — Bug 2 blocked; this plan does **not** implement it |
| III. Signal-first | `signal`/`computed` for local state; `toSignal()` for Rx streams | **PASS** — Bug 2 result converted via `toSignal()`; Bug 3 uses signals + `@if`/`@for` |
| III. Subscription leaks | `takeUntilDestroyed` or declarative | **PASS** — all new subscriptions use `takeUntilDestroyed(this.destroyRef)` |
| IV. Tailwind / Mobile-first | Utilities in templates; no `@apply` | **PASS** — template edits use existing utility patterns with `sm:` breakpoints |
| V. Strict TS / no `any` | No `any`; `unknown` + type guards | **FAIL (existing)** — `appointment-catalog.service.ts:230-238` (`loadPatients`) uses `any` throughout. This is in the exact code Bug 2 touches, so the fix **must** remove it (tracked in Complexity below) |
| V. Naming | No `I`-prefix interfaces | **PASS** |

**Verdict**: No new violations are introduced. One pre-existing violation (`any` in
`loadPatients`) lies directly on the Bug 2 fix path and is repaired as part of it — no
justification needed because the fix removes it rather than relying on it.

**Post-design re-check**: PASS (see "Constitution Check (Post-Design)" at end).

## Project Structure

### Documentation (this feature)

```text
specs/010-fix-critical-app-bugs/
├── spec.md          # TEMPLATE — must be filled before /speckit-tasks
├── plan.md          # This file
├── research.md      # Phase 0 output
├── data-model.md    # Phase 1 output
├── quickstart.md    # Phase 1 output
├── checklists/
│   └── requirements.md
└── contracts/       # Phase 1 output
    ├── auth-sign-in.contract.md
    ├── patient-search.contract.md
    └── receptionists-list.contract.md
```

### Source Code (repository root — `Frontend/AdminApp/AdminApp/`)

```text
src/
├── app/
│   ├── app.config.ts                     # Bug 1: interceptor order / provider wiring (verify)
│   ├── app.routes.ts                     # Bug 3: route declaration order ('receptionists/:id/profile')
│   ├── core/
│   │   ├── services/auth.service.ts      # Bug 1: signIn DTO, token handling, profile gate
│   │   ├── interceptors/
│   │   │   ├── auth.interceptor.ts       # Bug 1: header handling, anonymous whitelist
│   │   │   ├── auth-error.interceptor.ts # Bug 1: 401 → clearSession + redirect
│   │   │   └── api-error.interceptor.ts
│   │   ├── guards/{auth,role}.guard.ts   # Bug 3: roleGate redirect to '/'
│   │   └── utils/gateway-url.ts          # Bug 1: URL scoping
│   ├── api/
│   │   ├── generated/profiles/           # Bug 2: REGENERATE (do not hand-edit)
│   │   └── api-envelope.ts               # Bug 3: readApiEnvelope throws on contract mismatch
│   └── features/
│       ├── auth/pages/sign-in-page/      # Bug 1: submit → outcome mapping
│       ├── appointments/
│       │   ├── components/appointment-create-modal/   # Bug 2: patient autocomplete wiring
│       │   └── services/appointment-catalog.service.ts # Bug 2: loadPatients (remove `any`)
│       └── receptionists/
│           ├── services/receptionist-directory.store.ts
│           ├── services/receptionist-contract.guards.ts
│           └── components/receptionist-table/         # Bug 3: @empty block, null-safe office
backend/                                   # READ-ONLY inspection only (constitution §II)
```

**Structure Decision**: Single Angular application. All edits are inside
`Frontend/AdminApp/AdminApp/src/`. Backend `PatientsController`/`ReceptionistController`
may be *read* to confirm the real contract, never edited.

## Bug 1 — Authorization (sign-in)

### Diagnosis

- `AuthService.signIn` (`core/services/auth.service.ts:93-113`) sends the password grant with
  `username: email.trim()`, `client_id: public-client`, `scope: openid`, form-encoded headers.
  This matches the Keycloak password-grant contract; `AuthService` is the documented exception
  to the generated-client rule.
- `auth.interceptor.ts:12-14` short-circuits non-Gateway and anonymous URLs **before** touching
  a token, so it cannot block or overwrite the Keycloak login request. `ApiErrorInterceptor`
  only logs (it does not mutate requests). **Header-overwrite risk: none found.**
- `auth-error.interceptor.ts:19-27` clears the session on **any** Gateway 401. Because it runs
  *inside* `AuthService`'s own profile-status probe, a 401 from that probe also triggers a
  redirect to `/sign-in` mid-sign-in — an observable "login flashes and bounces" symptom.
- `.specify/bugs/sign-in-unauthorized-client/fix.md` records that the last 400 was Keycloak
  config (`directAccessGrantsEnabled=false`, pending `UPDATE_PASSWORD`) — external, not code.
- Branch is `develop`; `auth-401-bug/fix.md` describes a **keycloak-angular** integration that
  is **not** present in the current tree (`package.json` has no `keycloak-angular`). The
  current session-based `AuthService` model is what must be fixed forward.

### Fix plan

1. **Verify DTO once against Keycloak** (not the backend): `grant_type=password`,
   `client_id`, `username` (**not** `email`/`userName`), `password`, `scope=openid`. Keep
   `AUTH_CLIENT_ID` in one place. No generated profiles client is involved in login.
2. **Bug instrument the profile gate**: in `resolveProfileAccess`, pass
   `SILENT_HTTP_ERROR` **and** a new `SKIP_AUTH_REDIRECT` context token so the
   `authErrorInterceptor` does not treat the fail-open probe's 401 as a session rejection.
   (`SILENT_HTTP_ERROR` currently only suppresses logging.)
3. **Harden `toFailureOutcome`** (`auth.service.ts:260-279`) — keep `unauthorized_client` /
   `invalid_grant` (`Account is not fully set up`) distinguishable in a dev `console.warn`; do
   not surface to user (security).
4. **Interceptor order** in `app.config.ts:23-25` — confirm `authInterceptor` → `authErrorInterceptor` →
   `apiErrorInterceptor`; assert via a unit test that a Keycloak `/token` POST never carries
   `Authorization` and never hits `authErrorInterceptor`.
5. **Add regression tests** (`auth.service.spec.ts`, `auth.interceptor.spec.ts`): token request
   has no `Authorization`; 400 `unauthorized_client` → `reason:'invalid'`; profile 401 with
   skip context does **not** navigate.

### Files

| File | Change |
|------|--------|
| `core/services/auth.service.ts` | send `SKIP_AUTH_REDIRECT` on profile probe; richer dev warning mapping |
| `core/interceptors/auth-error.interceptor.ts` | early return when `SKIP_AUTH_REDIRECT` set |
| `core/tokens/silent-http-error.token.ts` (sibling) | add `SKIP_AUTH_REDIRECT` injection token |
| `app.config.ts` | verify interceptor order (likely no change) |
| `*.spec.ts` | 3 tests above |

## Bug 2 — Patient search in Create Appointment — **BLOCKED**

### Diagnosis

- The modal's `patient` control is sourced from `store.options().patients`
  (`appointment-create-modal.component.ts:124-129`), which comes from
  `AppointmentCatalogService.loadPatients()` (`appointment-catalog.service.ts:230-242`).
- `loadPatients()` calls `patientsApi.patientsGet()`. The generated method
  (`fn/patients/patients-get.ts`) has an **empty** `PatientsGet$Params` and an
  `Observable<void>` return — it is structurally incapable of a search.
- Root cause of that defect: `openapi/profiles.openapi.json` (uncommitted **working-tree
  edit**) contains a hand-written `"GET /Patients"` entry with no query parameters and a
  bare `{"200":{"description":"OK"}}` response. The real backend must expose a search
  contract (query param + paged DTO); the OpenAPI file was edited by hand instead of
  regenerating from the service Swagger — a direct constitution §II violation already in the
  tree.
- Separately, `loadPatients()` uses `any` (constitution §V violation), swallows **all**
  errors with `catchError(() => of([]))` (hides 401/500 as "no patients"), and
  `readApiEnvelope(payload, (v): v is any => true)` defeats validation.

### Action — hard stop

1. Revert the hand-edited `openapi/profiles.openapi.json` `/Patients` entry and the
   generated `patients-get.ts` / `patients.service.ts` additions (they are wrong, not just
   stale). Do this **only** after `/speckit-tasks` records it, since the same uncommitted
   changes also touch `appointment-catalog.service.ts`.
2. Report to the user: **«Необходимо обновить сгенерированный API-клиент из актуального
   swagger.json микросервиса»** for Profiles, naming the missing capability: *patient
   search by name with pagination*.
3. Wait. No `HttpClient` call, DTO, or service is written by hand.

### Fix plan (resumes only after regeneration)

1. Replace full-list `loadPatients()` with an on-demand search bound to
   `patientControl.valueChanges`:
   `debounceTime(300)` → `distinctUntilChanged()` → `switchMap(query => generatedSearch(query))`
   → `catchError` (surface error, do not fake `[]`) → `toSignal()` (or
   `takeUntilDestroyed`). Convert to signals; remove the eager `patients` member from
   `forkJoin` in `load()`.
2. Validate with a real type guard on the generated paged DTO — no `any`.
3. Autocomplete dropdown shows loading / empty (`@empty`) / error states via `@if`.

### Files (post-unblock)

| File | Change |
|------|--------|
| `api/generated/profiles/**` | **Regenerated** (not hand-edited) |
| `features/appointments/services/appointment-catalog.service.ts` | remove `loadPatients` from eager load; add `searchPatients` with debounce/switchMap |
| `features/appointments/components/appointment-create-modal/*` | wire `patientControl.valueChanges`, `toSignal` results, loading/error UI |
| `appointment-form.store.ts` / `appointment-cascade.ts` | patient options may become async; adjust `CascadeOptions.patients` |
| `*.spec.ts` | debounce, distinct, cancel-stale, error-surface tests |

## Bug 3 — Receptionists tab

### Diagnosis

- Route `receptionists` (`app.routes.ts:36-42`) and `receptionists/:id/profile`
  (`app.routes.ts:44-50`) are both declared with full-path matching — **order is fine**; the
  claimed "route order shadowing" is **not** the defect.
- `roleGuard('Receptionist')` (`core/guards/role.guard.ts:18-25`) redirects to `/` when
  unauthenticated or the role is missing. Because `AuthService.user()` reads roles from JWT
  claims (`realm_access.roles` filtered by `isAuthRole`), if `parseJwtClaims` yields no
  `Receptionist`, the tab **silently bounces to `/`** — presenting as "tab broken".
- `ReceptionistDirectoryStore.fetchAll()` (`receptionist-directory.store.ts:75-99`) wraps the
  *whole* loop in one `try`: a single `readApiEnvelope` throw (`api-envelope.ts:83-85`, e.g.
  `officeAddress` missing/typed as non-string, or `totalCount` not a number) aborts **all
  pages** and sets `rows([])` — the table renders the "No receptionists found" empty state
  instead of an error, so a contract mismatch masquerades as "no data".
- The table template (`receptionist-table.component.html`) handles `isLoading` / `loadError`
  / `rows().length === 0` but has **no `@empty` in `@for`** and calls `displayOffice()` on a
  `string` declared non-null — safe today only because `toRow` copies it verbatim.

### Fix plan

1. **Per-page fault isolation**: move `readApiEnvelope` into its own try/catch per page; on
   contract failure, set a *specific* `loadError` ("Unexpected response from the receptionists
   service") instead of an empty list; keep already-collected rows if any page succeeded.
2. **Null-safe rendering**: make `ReceptionistRow.officeAddress: string | null`; `toRow`
   coerces `undefined` → `null`; `officeLabel(null)` returns `'—'`; add `@empty` in the `@for`
   for defensive safety.
3. **Route/guard**: no route reordering. Instead make the guard's "no permission" redirect
   observable — add a single `console.warn`/toast `'You do not have access to this section.'`
   so a role mismatch is visible rather than a silent bounce. Keep `roleGuard` side-effect
   free by returning the `UrlTree` (no change to signature); log via a small `AccessDenied`
   signal on `NotificationService`.
4. **Contract guards**: extend `isReceptionistProfile` to require `officeAddress` as a
   nullable string (not merely `typeof === 'string'`) so a missing field is tolerated but
   typed; keep the throw for genuinely wrong shapes.

### Files

| File | Change |
|------|--------|
| `features/receptionists/services/receptionist-directory.store.ts` | per-page try/catch, partial-result retention, precise error message |
| `features/receptionists/models/receptionist.model.ts` | `officeAddress: string \| null` |
| `features/receptionists/services/receptionist-contract.guards.ts` | accept `null` officeAddress, normalize |
| `features/receptionists/utils/receptionist-presentation.ts` | `officeLabel` accepts `null` → `'—'` |
| `features/receptionists/components/receptionist-table/receptionist-table.component.html` | `@empty` in `@for`; null-safe office cell |
| `features/receptionists/components/receptionist-table/receptionist-table.component.ts` | `displayOffice(value: string \| null)` |
| `core/guards/role.guard.ts` | warn/toast on access denial (UrlTree preserved) |
| `*.spec.ts` | contract-mismatch on page 2 keeps page 1 rows; null office renders `—` |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `any` in `loadPatients` (pre-existing, constitution §V) | Repaired as part of the Bug 2 unblock (step 2), not relied upon | Leaving it would fail the architectural gate; deleting it alone breaks patient display, so it must be replaced by the regenerated search + type guards |
| `AuthService` calls Keycloak directly (constitution §II) | Documented exception — OIDC endpoints are not backend microservice contracts | A generated client would still not encode the Keycloak password-grant form body |

## Dependencies & Sequencing

1. **Bug 1** — independent; can ship first.
2. **Bug 3** — independent; can ship first.
3. **Bug 2** — **blocked on API regeneration**; after unblocking, depends on Bug 1 (needs a
   valid token to exercise patient search end-to-end).

## Constitution Check (Post-Design)

- Smart/Dumb preserved: patient search lives in the smart modal + catalog service;
  `ReceptionistTableComponent` stays dumb (`input()`/`output()` only). **PASS**
- Signals: patient results via `toSignal()`; receptionists rows already signals. **PASS**
- No `any` introduced; the one existing `any` is removed. **PASS**
- No manual API code: Bug 2 halts. **PASS**
- No `@apply`, mobile-first utilities retained. **PASS**

**Result**: design passes all gates; no unjustified violations.
