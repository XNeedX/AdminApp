# Tasks: Sign In / Sign Out

**Input**: Design documents from `/specs/003-sign-in-out/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included because `research.md` D9 mandates the coverage listed there. Write each test first and confirm it fails before implementing.

**Organization**: Tasks are grouped by user story (US1 = sign in, P1; US2 = sign out, P2) so each can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]` or `[US2]`; setup, foundational, and polish tasks have no story label
- All paths are relative to `AdminApp/` (the Angular project root, i.e. `Frontend/AdminApp/AdminApp/`)

## Path Conventions

- Application code: `src/app/`
- Environments: `src/environments/`
- Static assets: `public/assets/`
- Feature docs: `specs/003-sign-in-out/` (one level above the Angular project)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the external prerequisites and the client configuration inputs before any code is written.

- [X] T001 Verify the Keycloak prerequisite from [quickstart.md](./quickstart.md) §2: realm `InnoClinic` is reachable and the client used by the app has `directAccessGrantsEnabled=true` (`publicClient=true`). If the token endpoint answers `unauthorized_client`, stop and request `directAccessGrantsEnabled=true` on `public-client` or a new `admin-app-client` from the realm administrator; record the chosen client id in `specs/003-sign-in-out/contracts/keycloak-auth.contract.md` §1
- [X] T002 [P] Verify in [quickstart.md](./quickstart.md) §2 whether `GET {apiUrl}/profiles/accounts/exists?email=…` and `GET {apiUrl}/profiles/{doctors|receptionists}/account/{accountId}` answer `200`. Record each result (available / 404) in `specs/003-sign-in-out/quickstart.md` §5; a 404 means the corresponding task below must ship in fail-open mode

**Checkpoint**: Client id known, grant status known, endpoint availability known. No application code changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Session model, notifications, guards' dependencies, and interceptor wiring that every user story relies on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create `src/app/core/models/auth.model.ts` with `AuthSession` (`accessToken: string`, `refreshToken: string`, `expiresAt: number` epoch ms), `AuthRole = 'Doctor' | 'Receptionist'`, `AuthenticatedUser` (`accountId`, `email`, `roles: readonly AuthRole[]`), `ProfileStatus` (the seven backend values `At work`, `On vacation`, `Sick Day`, `Sick Leave`, `Self-isolation`, `Leave without pay`, `Inactive`), `TokenResponse` (`access_token`, optional `refresh_token`, `expires_in`, `token_type: 'Bearer'`), `TokenErrorResponse` (`error`, optional `error_description`), `ProfileStatusResponse` (`id`, `accountId`, `email`, `status: ProfileStatus | null`), `EmailExistsResponse` (`exists: boolean`), plus the type guards `isAuthSession`, `isTokenResponse`, `isProfileStatusResponse`, `isEmailExistsResponse`, and `parseJwtClaims(token: string): JwtClaims | null` (base64url payload decode, never throws). Unknown or malformed external data MUST return `null`/`false`, never be trusted; `any` is forbidden and interfaces MUST NOT use an `I` prefix
- [X] T004 [P] Create `src/app/core/services/notification.service.ts` with a `Toast` interface (`id: string`, `kind: 'success' | 'error'`, `message: string`, `timeoutMs: number` default `4000`), a `signal<readonly Toast[]>`, and `showSuccess(message)`, `showError(message)`, `dismiss(id)`; auto-dismiss timers MUST be cleared on removal and the service must expose no RxJS subscriptions of its own
- [X] T005 [P] Create `src/app/shared/components/toast-container/toast-container.component.ts` and `.html` as a dumb standalone component (`changeDetection: ChangeDetectionStrategy.OnPush`) reading `NotificationService.toasts()`, rendering one element per toast with `role="status"` and `aria-live="polite"`, Tailwind palette (`bg-green-*` for success, `bg-red-*` for error), fixed bottom-right position, mobile-first widths; no business logic and no direct API calls
- [X] T006 Create the `AuthService` skeleton in `src/app/core/services/auth.service.ts` (standalone `@Injectable({ providedIn: 'root' })`): private `session = signal<AuthSession | null>(null)`, `readonly user = computed<AuthenticatedUser | null>(...)`, `readonly isAuthenticated = computed(() => this.session() !== null)`, restore from `sessionStorage` key `adminapp.auth.session` on construction via `isAuthSession` (invalid JSON/shape must be removed silently), `persistSession(session)` and `clearSession()` helpers, and a `DestroyRef`-bound timer handle. Do not add `signIn`/`signOut` yet. `AUTH_CLIENT_ID` and the Keycloak endpoint helpers belong in this file only
- [X] T007 [P] Create `src/app/core/interceptors/auth.interceptor.ts` as a functional `HttpInterceptorFn` that attaches `Authorization: Bearer <accessToken>` only when the request URL matches the Gateway pattern (`buildGatewayUrlPattern(environment.apiUrl)`) and a session exists; it MUST skip `…/profiles/accounts/exists` (anonymous existence check) and MUST NOT touch Keycloak URLs
- [X] T008 [P] Create `src/app/core/interceptors/auth-error.interceptor.ts` as a functional `HttpInterceptorFn` that, on `HttpErrorResponse` with `status === 401` for a Gateway URL only, clears the session via `AuthService` and calls `Router.navigate(['/sign-in'], { replaceUrl: true })`; it MUST pass the error through so downstream formatting is unchanged, and MUST NOT react to 401 responses from the Keycloak host
- [X] T009 Update `src/app/app.config.ts`: remove `provideKeycloak`, `INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG`, `createInterceptorCondition`, `IncludeBearerTokenCondition`, and `includeBearerTokenInterceptor`; register `provideHttpClient(withInterceptors([authInterceptor, authErrorInterceptor, apiErrorInterceptor]))` keeping `buildGatewayUrlPattern` exported (still covered by `src/app/app.config.spec.ts`) and keep `API_BASE_URL`
- [X] T010 Update `src/app/app.ts` and `src/app/app.html` to mount `<app-toast-container>` once at the application root alongside `<router-outlet>`; keep `App` free of business logic

**Checkpoint**: Session model, notifications, and interceptor chain compile; `npx ng build --configuration development` succeeds.

---

## Phase 3: User Story 1 - Sign in to the system (Priority: P1) 🎯 MVP

**Goal**: An unauthenticated Doctor or Receptionist sees a non-dismissible sign-in modal, gets field-level validation on blur, and either lands on the home page with "You've signed in successfully" or sees the generic rejection message. No application screen is reachable without a session.

**Independent Test**: With an empty `sessionStorage`, open `http://localhost:4200/doctors` → redirected to `/sign-in`. Sign in as `testdoctor` → success toast + `/doctors`. Sign in with a wrong password, an unknown e-mail, and `testpatient` → the identical message `Either an email or a password is incorrect` each time, no session stored. Blur each field empty / malformed and confirm the exact messages and red borders.

### Tests for User Story 1

- [X] T011 [P] [US1] Write `src/app/core/guards/auth.guard.spec.ts` using `TestBed.runInInjectionContext`: returns `true` when `AuthService.isAuthenticated()` is true; returns a `UrlTree` whose `toString()` is `/sign-in` when it is false
- [X] T012 [P] [US1] Write `src/app/core/interceptors/auth.interceptor.spec.ts` with `HttpTestingController`: adds `Authorization: Bearer <token>` for a `${environment.apiUrl}/services/specialization` request; adds no header for a `${environment.keycloakUrl}/realms/.../token` request; adds no header when the session is empty; adds no header for `/profiles/accounts/exists`
- [X] T013 [P] [US1] Write `src/app/core/interceptors/auth-error.interceptor.spec.ts`: a 401 from a Gateway URL clears the session and triggers one navigation to `/sign-in`; a 401 from the Keycloak host leaves the session intact and does not navigate; a 403/500 from a Gateway URL leaves the session intact
- [X] T014 [US1] Write `src/app/core/services/auth.service.spec.ts` covering: successful sign-in (`grant_type=password`, `client_id`, `scope=openid`) stores `{accessToken, refreshToken, expiresAt}` in `sessionStorage` under `adminapp.auth.session` and updates the signals; `400 invalid_grant` maps to the generic error and stores nothing; `unauthorized_client` maps to the generic error plus a `console.warn`; a token whose `realm_access.roles` lacks `Doctor` and `Receptionist` (e.g. `Patient`) is discarded; a `Doctor` profile with status `Inactive` or an unknown status is rejected and stores nothing; a `Doctor` profile with `At work` is accepted; a `Receptionist` profile with `status: null` is accepted; a profile endpoint returning `404`/`5xx` fails open (session stored, warning logged); refresh (`grant_type=refresh_token`) updates `expiresAt`; a failed refresh clears the session; a valid session is restored from `sessionStorage` on construction; corrupt stored JSON is discarded
- [X] T015 [P] [US1] Write `src/app/features/auth/components/sign-in-form/sign-in-form.component.spec.ts`: empty e-mail on blur → red border + `Please, enter the email`; value without `@` → `You've entered an invalid email`; empty password on blur → `Please, enter the password`; 5 and 16 character passwords are invalid and 6 is valid with message `Password must be between 6 and 15 characters`; the eye toggle changes the input `type` between `password` and `text` without changing the value; `Enter` emits submit; the button is disabled while `submitting` is true; editing a field clears the submit error
- [X] T016 [P] [US1] Write `src/app/core/validators/account-exists.validator.spec.ts` using a stubbed HTTP client: `{exists:true}` → `null`; `{exists:false}` → `{ accountMissing: true }`; a `401`, `404`, `500`, or network error → `null` (fail-open) and at most one `console.warn`; a value without `@` triggers no request; debounce collapses rapid changes into a single request
- [X] T017 [US1] Write `src/app/features/auth/pages/sign-in-page/sign-in-page.component.spec.ts`: successful submit shows `You've signed in successfully` and navigates to `/`; failed submit shows `Either an email or a password is incorrect` and stays on the page; a temporary failure shows `Sign-in is temporarily unavailable. Please try again.` and keeps the entered e-mail; the modal renders no close control and ignores `Escape` and backdrop clicks

### Implementation for User Story 1

- [X] T018 [US1] Implement `src/app/core/guards/auth.guard.ts` as `export const authGuard: CanActivateFn = (route, state) => …` using `inject(AuthService)` and `inject(Router)`; return `true` when authenticated, otherwise `router.createUrlTree(['/sign-in'])` (synchronous, no `router.navigate` side effect inside the guard)
- [X] T019 [US1] Implement `AuthService.signIn(email, password)` in `src/app/core/services/auth.service.ts`: trim the e-mail and compare case-insensitively; `POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token` with `grant_type=password`, `client_id`, `username`, `password`, `scope=openid` and `Content-Type: application/x-www-form-urlencoded`; validate the response with `isTokenResponse`; discard the token and reject when `realm_access.roles` contains neither `Doctor` nor `Receptionist`; resolve the profile via `GET /profiles/{doctors|receptionists}/account/{sub}` (fall back to `/profiles/me` if present) and reject for `Inactive` or any status outside the seven permitted values, treating a receptionist `status: null` as permitted; treat `404`/`5xx`/network failure of the profile call as fail-open with a single `console.warn`; map `invalid_grant`, `unauthorized_client`, `invalid_client`, `invalid_request`, and role/status rejections to the generic error and `5xx`/network failures to the temporary-failure error; never render `error_description`. Add the proactive refresh (`grant_type=refresh_token` 60 s before `expiresAt`, timer cleared via `DestroyRef`, failure clears the session) in the same file
- [X] T020 [P] [US1] Implement `accountExistsValidator(service, debounceMs = 300)` in `src/app/core/validators/account-exists.validator.ts` following the existing `src/app/core/validators/email-unique.validator.ts` style (`timer` + `switchMap` + `first()`); return `{ accountMissing: true }` only for `200 {exists:false}`; return `null` for non-string/empty values and for every error path (fail-open)
- [X] T021 [P] [US1] Create `src/app/features/auth/models/sign-in-form.model.ts` with the typed `SignInForm` group (`email: FormControl<string>`, `password: FormControl<string>`), both with `updateOn: 'blur'`; synchronous validators: e-mail `required` and a contains-`@` check, password `required`, `minLength(6)`, `maxLength(15)`; export the exact message constants `Please, enter the email`, `You've entered an invalid email`, `User with this email doesn't exist`, `Please, enter the password`, `Password must be between 6 and 15 characters`, `Either an email or a password is incorrect`, `Sign-in is temporarily unavailable. Please try again.`, and `You've signed in successfully`
- [X] T022 [P] [US1] Implement `src/app/features/auth/components/sign-in-form/sign-in-form.component.ts` + `.html` as a dumb standalone `OnPush` component: `FormGroup` input, `submitting` input, `submit` and `emailBlur` outputs, signal-based `passwordVisible`, masked password by default with an accessible eye toggle (`aria-label`, `type="button"`), red borders via Tailwind (`border-red-500`, `focus:ring-red-500`) and error text with `aria-describedby`, `Enter` submits via `(ngSubmit)`, responsive Mobile-First layout; no service injection
- [X] T023 [P] [US1] Implement `src/app/shared/layout/app-header/app-header.component.ts` + `.html` as a dumb standalone `OnPush` component with `email` input, `signOut` output, and Tailwind layout (brand area, user e-mail, `Sign out` button); no navigation or service logic inside
- [X] T024 [US1] Implement `src/app/features/auth/pages/sign-in-page/sign-in-page.component.ts` + `.html` as the smart container: builds the typed form with `accountExistsValidator`, calls `AuthService.signIn`, shows the success toast via `NotificationService` then navigates to `/`, maps failures to the exact generic message while preserving the e-mail value, disables submit while in flight, and renders as a centered card over a dimmed backdrop with **no** close button and no `Escape`/backdrop dismissal
- [X] T025 [US1] Update `src/app/app.routes.ts`: add `{ path: 'sign-in', loadComponent: … }` **outside** the guarded tree, wrap the existing routes in a parent `{ path: '', canActivate: [authGuard], children: [doctors, …] }`, keep `'' → 'doctors'`, and add `{ path: '**', redirectTo: '' }`
- [X] T026 [US1] Update `src/app/app.ts` and `src/app/app.html` to render `<app-header [email]="authService.user()?.email ?? ''">` only when `authService.isAuthenticated()` is true, above `<router-outlet>`; inject `AuthService` as the only service in this shell

**Checkpoint**: US1 is fully functional — guard, modal, validation, sign-in, toast, navigation. Validate with [quickstart.md](./quickstart.md) §3.1, §3.3, §3.4, §3.5 before starting US2.

---

## Phase 4: User Story 2 - Sign out of the system (Priority: P2)

**Goal**: A signed-in user clicks `Sign out`; the access token is removed from the device and the sign-in modal appears again within 5 seconds, even if Keycloak is unreachable. Back navigation and reload do not restore the session.

**Independent Test**: While signed in, click `Sign out` → `/sign-in` appears and `adminapp.auth.session` is gone. Press browser `Back` and reload → still on `/sign-in`. Stop Keycloak, sign in again, click `Sign out` → still redirected and still cleared.

### Tests for User Story 2

- [X] T027 [US2] Extend `src/app/core/services/auth.service.spec.ts` with sign-out cases: posts `grant_type`-less refresh-token logout to `/protocol/openid-connect/logout` with `client_id` and `refresh_token`; clears `sessionStorage` and the signals even when the logout request fails with a network error or `500`; clears the proactive-refresh timer so no refresh fires afterwards; after sign-out `isAuthenticated()` is false and a subsequent restore finds no session
- [X] T028 [P] [US2] Extend `src/app/app.spec.ts` to verify that `App` renders `<app-header>` only while authenticated, that clicking `Sign out` calls `AuthService.signOut()` and navigates to `/sign-in` with `replaceUrl`, and that `<app-toast-container>` is always rendered

### Implementation for User Story 2

- [X] T029 [US2] Implement `AuthService.signOut()` in `src/app/core/services/auth.service.ts`: `POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/logout` with `client_id` and `refresh_token` as a best-effort call (≤ 3 s timeout, response ignored); clear the session, `sessionStorage` entry, signals, and refresh timer **unconditionally** in a finalize step so a network failure, timeout, or `5xx` still ends the local session; never throw to the caller
- [X] T030 [US2] Wire the header output in `src/app/app.ts`/`src/app/app.html`: on `(signOut)` call `AuthService.signOut()` then `Router.navigate(['/sign-in'], { replaceUrl: true })`, so the protected route is replaced in browser history instead of being pushed (FR-016)
- [X] T031 [US2] Verify the post-sign-out guard path in `src/app/core/guards/auth.guard.ts` + `src/app/app.routes.ts`: after sign-out, reloading or entering a protected URL yields the `/sign-in` `UrlTree` with no protected component instantiated, and `/sign-in` while authenticated redirects to `/` (the app home)

**Checkpoint**: US2 works on top of US1 — validate with [quickstart.md](./quickstart.md) §3.6 and §3.7. US1 scenarios must still pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, contract follow-up, and full validation.

- [X] T032 [P] Remove the now-unused Keycloak redirect plumbing: drop `keycloak-angular` and `keycloak-js` from `AdminApp/package.json` (run `npm install` to refresh the lockfile), delete `AdminApp/public/assets/silent-check-sso.html`, and delete any remaining imports of `keycloak-*` under `src/` (grep `keycloak-angular|keycloak-js` must return no hits in `src/`)
- [X] T033 [P] Remove or update dead test/code references left by the interceptor swap: confirm `src/app/app.config.spec.ts` still passes and that `buildGatewayUrlPattern` remains exported and used by `src/app/core/interceptors/auth.interceptor.ts` and `auth-error.interceptor.ts`
- [X] T034 [P] Replace the hand-written existence/status HTTP calls in `src/app/core/services/auth.service.ts` and `src/app/core/validators/account-exists.validator.ts` with the generated Profiles API client **once** `GET /profiles/accounts/exists` and `GET /profiles/{doctors|receptionists}/account/{accountId}` (or `/profiles/me`) exist — per the Missing Contract Protocol in [contracts/profiles-sign-in.contract.md](./contracts/profiles-sign-in.contract.md) §1–§4. If the endpoints are still missing, leave the fail-open behaviour and keep the single startup `console.warn` per missing endpoint
- [X] T035 [P] Accessibility pass on `src/app/features/auth/components/sign-in-form/sign-in-form.component.html` and `src/app/shared/components/toast-container/toast-container.component.html`: every input has an associated `<label>`, errors are linked via `aria-describedby`, the eye toggle has an accessible name and `aria-pressed`, focus rings are visible, toast text is announced (`role="status"`, `aria-live="polite"`), and focus lands in the e-mail field on open
- [X] T036 [P] Security sweep across `src/app/core/` and `src/app/features/auth/`: no `console.log` of tokens, passwords, or full token responses; no token or e-mail in a URL, query string, or `localStorage`; `error_description` is never rendered; the sign-in rejection text is identical for unknown e-mail, wrong password, `Inactive`, unknown status, and non-staff role
- [X] T037 [P] Confirm responsive behaviour in `src/app/features/auth/pages/sign-in-page/sign-in-page.component.html` and `src/app/shared/layout/app-header/app-header.component.html` at 375 px, 768 px, and 1440 px using Mobile-First Tailwind classes (`sm:`, `md:`, `lg:`) with no horizontal scrolling *(validated by static review; visual confirmation needs a runnable sign-in — T001)*
- [X] T038 Run `npx ng test --watch=false` in `AdminApp/` and fix every failure until the suite is green, including the pre-existing 28 tests
- [X] T039 Run `npx ng build --configuration development` in `AdminApp/` and fix every type or template error; then run `npx tsc --noEmit -p tsconfig.app.json` style verification via the build output and confirm zero `any` usages in new files (`grep -rE ":\s*any\b|<any>" src/app/core src/app/features/auth src/app/shared` returns nothing)
- [X] T040 Execute [quickstart.md](./quickstart.md) §3.1–§3.7 end to end and record the outcome of each row; mark rows 20, 21 (status gating) and 10 (e-mail existence) as `[BLOCKED]` while T002 reports `404`, and note the fail-open gap in the feature release notes *(results recorded in [quickstart.md](./quickstart.md) §6; browser-driven rows remain blocked by T001)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T001 gates *running* the app but not writing code
- **Foundational (Phase 2)**: depends on Setup; **BLOCKS both user stories**
- **User Story 1 (Phase 3)**: depends on Phase 2
- **User Story 2 (Phase 4)**: depends on Phase 2 and on T019/T026 from US1 for realistic end-to-end verification, though `signOut()` itself only needs T006
- **Polish (Phase 5)**: depends on both stories

### User Story Dependencies

- **US1 (P1)**: independent after Phase 2 — delivers the MVP
- **US2 (P2)**: after US1 for the full flow; T029 only touches `auth.service.ts` (additive), T030 touches `src/app/app.ts` (created in T026)

### Task-level dependencies

| Task | Depends on |
|------|-----------|
| T003 | — |
| T004, T005 | — |
| T006 | T003 |
| T007, T008 | T003, T006 |
| T009 | T007, T008 |
| T010 | T004, T005 |
| T018 | T006 |
| T019 | T003, T006, T009 |
| T020 | T003 |
| T021 | T003 |
| T022 | T021 |
| T024 | T019, T020, T021, T022 |
| T025 | T018, T024 |
| T026 | T023, T006 |
| T029 | T006 |
| T030 | T026, T029 |

### Within each story

1. Tests written and failing
2. Models / validators
3. Services
4. Components (dumb → smart)
5. Routing / wiring
6. Independent validation

---

## Parallel Execution Examples

### Phase 2 (Foundational)

```text
# All four create separate files:
T003 src/app/core/models/auth.model.ts
T004 src/app/core/services/notification.service.ts
T005 src/app/shared/components/toast-container/*
# then, once T003/T006 exist:
T007 src/app/core/interceptors/auth.interceptor.ts
T008 src/app/core/interceptors/auth-error.interceptor.ts
```

### User Story 1

```text
# Test wave (different spec files):
T011 auth.guard.spec.ts
T012 auth.interceptor.spec.ts
T013 auth-error.interceptor.spec.ts
T015 sign-in-form.component.spec.ts
T016 account-exists.validator.spec.ts

# Implementation wave (different files, after T019):
T020 account-exists.validator.ts
T021 sign-in-form.model.ts
T022 sign-in-form.component.*
T023 app-header.component.*
```

### User Story 2

```text
T028 app.spec.ts can be written in parallel with T027 auth.service.spec.ts (different files);
T029 and T030 must run sequentially (T030 consumes T029).
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 — confirm the grant and endpoint status (T001, T002)
2. Phase 2 — session model, notifications, interceptors, wiring (T003–T010)
3. Phase 3 — guard, `signIn`, validator, form, page, routes (T011–T026)
4. **STOP and validate** with quickstart §3.1, §3.3, §3.4, §3.5
5. Demo: sign in, land on `/doctors`, reject bad credentials, block direct navigation

### Incremental delivery

1. Setup + Foundational → infrastructure ready
2. US1 → validate → deploy (MVP)
3. US2 → validate quickstart §3.6–§3.7 → deploy
4. Polish → dependency cleanup, accessibility, security sweep, full run

### Parallel team strategy

After Phase 2: one developer takes US1 (guard + service + form) while a second prepares US2's specs (T027, T028) and the header presentational component; US2's wiring lands once T026 exists.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- Tests are written first and must fail before the matching implementation task
- Commit after each task or logical group
- `T019` is the largest task; if it grows, split `signIn`, `refresh`, and the profile-status gate into separate commits within the same file
- Blocked rows are explicit, not silent: while `/profiles/accounts/exists` or the status endpoint are missing, F-1 rule 3 and AC-4/AC-5 are **not** satisfied — the gap must be visible in release notes
