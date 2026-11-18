# Implementation Plan: Sign In / Sign Out

**Branch**: `003-sign-in-out` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-sign-in-out/spec.md`

## Summary

Deliver an in-application sign-in modal (e-mail + password) and sign-out for Doctor and Receptionist users, with route protection, reactive-form validation (including async e-mail existence), profile-status authorization, and Keycloak-based sessions.

Technical approach: `AuthService` (in `core/services/`) performs the Keycloak **Resource Owner Password Credentials** flow against the realm token endpoint (verified working against the running realm once direct access grants are enabled), keeps the session in `sessionStorage`, and exposes it as signals. A functional `authInterceptor` attaches the bearer token to Gateway calls and replaces keycloak-angular's `includeBearerTokenInterceptor` (keycloak-js cannot ingest a ROPC-issued token). A functional `authGuard` protects all application routes and redirects to a `/sign-in` route rendered as a modal-style page. Two Gateway contracts are **missing today** and block AC-4/AC-5 and F-1: profile status by account and unauthenticated e-mail existence (see [research.md](./research.md) D3/D4 and [contracts](./contracts/)).

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21.2 (standalone APIs, signals), Node/npm 11.6

**Primary Dependencies**: `@angular/common/http`, `@angular/forms` (Reactive Forms), `@angular/router`, RxJS 7.8, Tailwind CSS 4, `keycloak-js` 26 (OIDC endpoint semantics only), Vitest 4 via `@angular/build:unit-test`

**Storage**: Browser `sessionStorage` for the auth session (access token, refresh token, expiry); no server-side storage introduced

**Testing**: `npx ng test --watch=false` (Vitest + Angular TestBed), plus `npx ng build --configuration development` for type/template checking

**Target Platform**: SPA in modern browsers (AdminApp has no SSR entry point); Keycloak realm `InnoClinic` at `environment.keycloakUrl`, Gateway at `environment.apiUrl`

**Project Type**: Frontend web application (single Angular project at `AdminApp/`)

**Performance Goals**: Sign-in completes in < 30 s end-to-end (SC-001); field validation feedback < 1 s after blur (SC-005); sign-out < 5 s (SC-006)

**Constraints**: No backend source modifications; no generated API client exists for auth; `public-client` currently has `directAccessGrantsEnabled=false`; Gateway CORS allows `http://localhost:4200` only; no `any` types; no new overlay dependency (no `@angular/cdk` installed)

**Scale/Scope**: Internal clinic admin/staff application; ~5 new frontend files + 3 modified; no high-load requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Standalone & Smart/Dumb | All new components standalone, `OnPush`, smart/dumb split, no logic in constructors | PASS (planned: `SignInPageComponent` smart + `SignInFormComponent` dumb + `AppHeaderComponent` dumb + toast dumb) |
| II. Automated Backend API Integration | No hand-written backend HTTP services/DTOs; missing contracts must pause work and request regeneration | **EXCEPTION** for Keycloak OIDC endpoints (external IdP, not covered by backend Swagger) — see Complexity Tracking. Profile status/existence endpoints are **missing** → blocking prerequisite, not hand-written |
| II. Centralized Error Interception | 401/403/500 handled in functional interceptors | PASS (`authErrorInterceptor` + existing `apiErrorInterceptor`) |
| III. Signal-first Reactivity | Signals for local/session state, RxJS for async, `takeUntilDestroyed`, no leaked subscriptions | PASS (session + password visibility as signals; `toSignal` where templates consume streams) |
| IV. Tailwind & Accessible Overlays | Utility-first Tailwind, no `@apply`; complex overlays via CDK | PASS with note: sign-in is a **route-level page styled as a modal card**, not a dialog primitive — no CDK/overlay dependency needed (justified in Complexity Tracking) |
| V. Strict TypeScript | No `any`, type guards for external data, naming rules | PASS (JWT claims and API payloads validated by type guards) |
| Scope boundaries | Changes confined to `Frontend/AdminApp/`; Backend read-only | PASS |

**Gate result: PASS with two tracked justifications** (see Complexity Tracking). Phase 0 has unresolved *external* blockers (missing backend contracts) that do not block design, only delivery of AC-4/AC-5 and F-1.

## Project Structure

### Documentation (this feature)

```text
specs/003-sign-in-out/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── keycloak-auth.contract.md
│   └── profiles-sign-in.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
AdminApp/src/app/
├── app.config.ts                         # MODIFIED: drop provideKeycloak/includeBearerTokenInterceptor;
│                                         #   register [authInterceptor, authErrorInterceptor, apiErrorInterceptor]
├── app.routes.ts                         # MODIFIED: /sign-in route, guarded shell with children
├── app.ts / app.html                     # MODIFIED: toast container + shell usage
├── core/
│   ├── services/
│   │   ├── auth.service.ts               # ADDED: signIn/signOut/refresh/session signals, Keycloak token calls
│   │   └── notification.service.ts       # ADDED: signal-based toast queue
│   ├── guards/
│   │   └── auth.guard.ts                 # ADDED: functional CanActivateFn
│   ├── interceptors/
│   │   ├── auth.interceptor.ts           # ADDED: bearer attachment for Gateway URLs
│   │   └── auth-error.interceptor.ts     # ADDED: 401 on Gateway → clear session + redirect
│   ├── models/
│   │   └── auth.model.ts                 # ADDED: AuthSession, AuthenticatedUser, AuthRole, ProfileStatus
│   └── tokens/api-base-url.token.ts      # unchanged
├── shared/
│   ├── components/toast-container/       # ADDED: dumb toast renderer
│   └── layout/app-header/                # ADDED: dumb header with sign-out output
└── features/auth/
    ├── models/sign-in-form.model.ts      # ADDED: typed form group + validation messages
    ├── components/sign-in-form/          # ADDED: dumb reactive form, Tailwind error styling
    └── pages/sign-in-page/               # ADDED: smart page (modal card), wires AuthService
```

**Structure Decision**: Single Angular project; auth stays in `core/` (session, guard, interceptors per constitution folder responsibilities), while the sign-in UI lives in `features/auth/` — a new domain feature folder. The shared toast and header are dumb presentational components.

## Phase 0: Research (summary)

All decisions and evidence are in [research.md](./research.md). Highlights:

- **D1 – Sign-in transport**: Keycloak password grant (`POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token`). Empirically verified against the running realm: with the grant temporarily enabled, a token for a `Receptionist` user returned **200** from `/services/specialization` (401 without a token). **Prerequisite**: `directAccessGrantsEnabled=true` on the client (`public-client` currently `false`), or a dedicated `admin-app-client`.
- **D2 – Token attachment**: replace `includeBearerTokenInterceptor` with `AuthService` + functional `authInterceptor`; keycloak-js cannot accept ROPC-issued tokens, and re-initialising keycloak-js after sign-in is unsupported.
- **D3 – Profile status (AC-4/AC-5)**: **blocking gap** — no endpoint exposes a doctor/receptionist profile by account or e-mail; `Receptionist` has no status field at all.
- **D4 – E-mail existence (F-1)**: **blocking gap** — no unauthenticated existence endpoint; the existing `DoctorService.checkEmailExists` requires a role and therefore always fails during sign-in.
- **D5 – Guard syntax**: context7 quota was exhausted, so the syntax was verified against the official Angular reference (`CanActivateFn = (route, state) => MaybeAsync<GuardResult>`), compatible with the installed Angular 21.
- **D6 – Session storage/refresh**: `sessionStorage`, JWT claim parsing, refresh-token grant, proactive refresh.
- **D7 – Routing**: `/sign-in` page (modal presentation), guarded shell for all other routes, home = `/` → `/doctors`.

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md) — entities, validation rules, auth state transitions, storage schema.
- [contracts/keycloak-auth.contract.md](./contracts/keycloak-auth.contract.md) — token/refresh/logout endpoints, required client settings, claims used.
- [contracts/profiles-sign-in.contract.md](./contracts/profiles-sign-in.contract.md) — **required new Gateway endpoints** for e-mail existence and profile status, plus fallback behaviour until they exist.
- [quickstart.md](./quickstart.md) — prerequisites, commands, and AC-by-AC validation scenarios.

## Post-Design Constitution Re-check

| Principle | Re-check | Status |
|-----------|----------|--------|
| I. Standalone & Smart/Dumb | Components listed above; `SignInFormComponent` has inputs/outputs only | PASS |
| II. API Integration | Keycloak calls isolated in `AuthService` (documented exception); profile calls depend on regenerated client | PASS (with prerequisite) |
| III. Signals | `AuthService` session signals, `NotificationService` signal queue, signal-driven password visibility | PASS |
| IV. Tailwind | Error borders (`border-red-500`), spacing, responsive card; no `@apply` | PASS |
| V. Type safety | JWT payload and API responses validated via type guards; no `any` | PASS |
| Error handling | 401 on Gateway clears session and redirects; sign-in failures mapped to the generic message | PASS |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Hand-written Keycloak OIDC client calls in `AuthService` | The IdP token/refresh/logout endpoints are external OIDC endpoints, not `Backend/` Swagger contracts; no generated client can cover them | Waiting for a generated client is impossible — Swagger only describes internal microservices; a backend BFF would require forbidden `Backend/` changes |
| Replacing `provideKeycloak` + `includeBearerTokenInterceptor` with `AuthService` + `authInterceptor` | keycloak-js exposes only redirect-based login and cannot ingest a token obtained through the password grant; its session state cannot be replaced at runtime | Keeping keycloak-angular requires redirecting to the hosted Keycloak page, which violates AC-1/AC-2 (in-app modal with e-mail/password) |
| Route-level sign-in page styled as a modal instead of a CDK dialog | Avoids a new dependency and unguarded-content flash; a full-page guarded shell cannot render protected content behind the modal | A CDK overlay would add `@angular/cdk`, which the plan/spec does not require; a non-dismissible overlay is equivalent to a page |
| Two hard external prerequisites (profile-status and e-mail-existence endpoints) | Required by AC-4/AC-5 and F-1; the current Gateway exposes neither | Client-side workarounds are impossible: Keycloak returns `invalid_grant` for both unknown users and wrong passwords, and profile endpoints require roles the signing-in user does not hold |

## Open Blockers (external)

1. **Keycloak client setting**: `directAccessGrantsEnabled=true` for `public-client` (or a new client) in realm `InnoClinic`. Without it, sign-in returns `unauthorized_client`.
2. **Gateway contract – profile status**: `GET /profiles/doctors/account/{accountId}` and `GET /profiles/receptionists/account/{accountId}` (or a single `/profiles/me`). Without it, AC-4/AC-5 cannot be enforced.
3. **Gateway contract – e-mail existence**: unauthenticated `GET /profiles/accounts/exists?email=…`. Without it, F-1's third rule cannot be implemented and must be omitted (fail-open) with a logged warning.

Frontend work that does not depend on these blockers (form, guard, session, interceptors, routing, sign-out) can proceed immediately.
