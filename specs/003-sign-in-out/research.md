# Phase 0 Research: Sign In / Sign Out

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-11

All `NEEDS CLARIFICATION` items from Technical Context are resolved below. Two items are **external blockers**, not clarifications: they are recorded here and in plan.md, with exact contracts in [contracts/](./contracts/).

---

## D1. Sign-in transport: Keycloak password grant (ROPC)

**Decision**: `AuthService.signIn()` performs `POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token` with `grant_type=password`, `client_id=public-client`, `username`, `password`, `scope=openid`.

**Evidence (verified against the running environment)**:
- Realm `InnoClinic` responds at `http://localhost:8080/realms/InnoClinic/.well-known/openid-configuration` (HTTP 200).
- Client `public-client` exists: `publicClient=true`, `standardFlowEnabled=true`, `directAccessGrantsEnabled=false`.
- With the grant temporarily enabled and a temporary `Receptionist` user, the token endpoint returned an access token and `GET http://localhost:5137/services/specialization` returned **200**, while the same call without a token returned **401**. The client setting was restored to its original value and the temporary user was deleted afterwards.
- `POST /services/...` and `/offices/...` reject tokens of users without the required realm role with **403**, confirming that authentication (401 → 200/403) is the layer this feature controls.

**Rationale**: The specification requires an in-app modal with e-mail and password (AC-1/AC-2). Keycloak's hosted login page and redirect flow cannot satisfy that. The password grant is the only mechanism that turns typed credentials into a bearer token without backend changes.

**Alternatives considered**:
- *Redirect to Keycloak hosted login* — rejected: violates AC-1/AC-2 (modal with fields).
- *Backend-for-Frontend sign-in endpoint* — rejected: requires `Backend/` changes, which the constitution forbids; recorded as fallback if direct grants cannot be enabled.
- *Password grant on a new dedicated client* — kept as a variant of D1; the plan requires "a client with direct grants enabled" and prefers a dedicated `admin-app-client` if the realm team prefers not to relax `public-client`.

**Prerequisite (blocking)**: `directAccessGrantsEnabled=true` for the chosen client. Without it Keycloak answers `{"error":"unauthorized_client"}`.

**Security note**: OAuth 2.1 deprecates the password grant. For an internal clinic admin application behind a known IdP this is an accepted trade-off, documented in the plan; if the realm team adds a BFF endpoint later, `AuthService` is the single place to swap.

---

## D2. Token attachment: `AuthService` + functional interceptor (replace keycloak-angular)

**Decision**: Remove `provideKeycloak(...)` and `includeBearerTokenInterceptor` from `app.config.ts`. Register `[authInterceptor, authErrorInterceptor, apiErrorInterceptor]` with `provideHttpClient(withInterceptors(...))`. `authInterceptor` reads the access token from `AuthService` and adds `Authorization: Bearer <token>` only for URLs under `environment.apiUrl`.

**Rationale**:
- keycloak-js exposes only redirect-based login (`login()`, `createLoginUrl()`); it has no API to submit credentials.
- keycloak-js session state cannot be seeded after bootstrap in a supported way; `init({ token, refreshToken })` only works at startup, and re-initialising after sign-in/sign-out is not supported.
- Therefore the ROPC token cannot be fed into `includeBearerTokenInterceptor`, and keeping keycloak-angular would leave every Gateway call unauthenticated (the exact 401 bug previously fixed).
- The replacement is small, testable, and keeps Keycloak as the identity provider (same realm, client, `environment.keycloakUrl`).

**Alternatives considered**:
- *Restore the session with keycloak-js on startup and reload the page after sign-in* — rejected: full-page reloads, fragile re-init, poor UX, hard to test.
- *Keep keycloak-angular and add a second parallel interceptor* — rejected: two competing token sources; keycloak-js would still report "not authenticated" and its interceptor would skip requests.

**Consequence**: `keycloak-angular`/`keycloak-js` remain installed but unused by the app after this change; a cleanup task may uninstall them. `keycloak-js` is kept in `package.json` only if the team prefers to retain it for future SSO work.

---

## D3. Profile status check (AC-4/AC-5): BLOCKING contract gap

**Decision**: After a successful token response, `AuthService` resolves the caller's profile through a new Gateway endpoint and evaluates `status` against the allowed set. Until the endpoint exists, no client-side substitute is implemented (only the role check from the token is enforced), and the gap is reported as a blocker.

**Findings from read-only backend inspection**:
- `DoctorProfile` has `Email` and `Status` (`"At work"` by default) — `Profiles.Domain.Models.DoctorProfile`.
- `Receptionist` has `Email` but **no status field** — `Profiles.Domain.Models.ReceptionistProfile`.
- `DoctorsController` exposes `GET api/doctors` (roles `Patient, Receptionist`), `GET api/doctors/doctors` (role `Receptionist`), `GET api/doctors/{id:guid}` (roles `Patient, Doctor`). **No lookup by account id or e-mail for doctors.**
- `ReceptionistsController` exposes list/get by id only, all requiring the `Receptionist` role.
- `PatientsController.GetProfile` (`GET api/patients/account/{accountId}`) is the only account-based lookup — and it is patient-only and unauthenticated.
- The Gateway only routes `/services`, `/appointments`, `/profiles`, `/documents`, `/auth`, `/offices`; `AuthorizationAPI` exposes only `GET users/me` (claims, no profile status).

**Why no client-side workaround exists**: A Doctor token cannot call the Receptionist-only listing endpoints (403), and no endpoint maps `sub`/e-mail → doctor profile. Keycloak stores no status attribute (verified: `testdoctor` has no user attributes, only realm roles).

**Required contract**: [contracts/profiles-sign-in.contract.md](./contracts/profiles-sign-in.contract.md) (proposed `GET /profiles/doctors/account/{accountId}`, `GET /profiles/receptionists/account/{accountId}`). Per the constitution's Missing Contract Protocol, the generated API client must be regenerated once the backend provides it.

**Interim behaviour (must be documented in the UI release notes)**: while the endpoint returns 404/403, sign-in is not blocked by status; the app logs a warning. This deliberately fails open to avoid locking every user out, but it means AC-4/AC-5 are **not** satisfied until the contract lands. The spec requires fail-closed semantics for `Inactive`; the plan schedules that switch as soon as the endpoint is available.

---

## D4. E-mail existence validation (F-1): BLOCKING contract gap

**Decision**: Implement the third on-blur rule through a new unauthenticated Gateway endpoint `GET /profiles/accounts/exists?email=…`. Until it exists, only the empty and missing-`@` rules run; the "User with this email doesn't exist" rule is disabled (fail-open) and the absence is logged.

**Findings**:
- The existing `DoctorService.checkEmailExists(email)` calls `/profiles/doctors?searchName=<email>`, which requires the `Patient`/`Receptionist` role. Before sign-in there is no token, so the call returns 401 and `catchError(() => of(false))` turns every address into "does not exist" — unusable for sign-in.
- It also only searches doctors, not receptionists.
- Keycloak has no public user-existence endpoint (by design), and the token endpoint returns `invalid_grant` for both unknown users and wrong passwords, so existence cannot be inferred.
- `/profiles/patients/confirm` exists but is scoped to patient matching and requires a full `CreatePatientDto`; it is not an existence oracle.

**Required contract**: [contracts/profiles-sign-in.contract.md](./contracts/profiles-sign-in.contract.md).

**Rationale for a dedicated endpoint**: An unauthenticated, rate-limited existence check is the only way to satisfy F-1 before credentials are available. It must return a boolean, not profile data, to limit disclosure.

---

## D5. Functional guard syntax: verified, context7 unavailable

**Decision**: `authGuard: CanActivateFn` using `inject(AuthService)` and `inject(Router)`, returning `true` or a `UrlTree` for `/sign-in`.

**How verified**: The requested `context7` call returned `Monthly quota exceeded. Create a free API key at https://context7.com/dashboard` (the same limit hit earlier in this project). The syntax was therefore verified against the official Angular reference for `CanActivateFn`:

```ts
type CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => MaybeAsync<GuardResult>;
```

Returning `true` continues navigation; returning `false` cancels it; returning a `UrlTree` cancels and starts a new navigation. The installed Angular version is 21.2, for which this signature is unchanged (the reference documents it as stable; returning a `UrlTree` remains the portable redirect mechanism).

**Decision detail**: use `router.createUrlTree(['/sign-in'])` rather than `router.navigate(...)` inside the guard, so the guard stays synchronous and testable without navigation side effects (`RedirectCommand` is available in Angular 21 but adds nothing here).

---

## D6. Session storage, claims, and refresh

**Decision**:
- Persist `{ accessToken, refreshToken, expiresAt }` in `sessionStorage` under `adminapp.auth.session`; restore on service construction.
- Parse the JWT payload for `sub`, `email`, `exp`, and `realm_access.roles` using a type guard; never trust unvalidated JSON.
- Refresh proactively 60 s before `expiresAt` via `grant_type=refresh_token`; reschedule after each refresh; clear the timer with `DestroyRef`.
- On refresh failure (400/401), clear the session and let `authErrorInterceptor`/guard redirect to `/sign-in`.
- Sign-out: `POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/logout` with `client_id` + `refresh_token` (best effort), then clear `sessionStorage` and session signals **regardless of the request outcome**.

**Rationale**: `sessionStorage` satisfies "session persists across reloads" (FR-014) without persisting beyond the browser tab session; it reduces exposure on shared workstations compared with `localStorage`. Clearing locally on logout guarantees AC-1 of User Story 2 even when the network is unavailable (edge case in the spec).

**Alternatives considered**:
- `localStorage` — rejected: survives browser restarts, higher risk on shared clinic workstations, not required by the spec.
- In-memory only — rejected: breaks FR-014 (reload loses the session).
- Silent SSO via keycloak-js — rejected: incompatible with D1/D2.

---

## D7. Routing and "home page"

**Decision**:
- `/sign-in` — standalone route, **not** guarded, rendered as a centered modal card over a dimmed backdrop (no close control, no Escape/backdrop dismissal — FR-013).
- All other routes live under a guarded shell (`path: ''`, `canActivate: [authGuard]`, children: `doctors`, redirect `'' → 'doctors'`).
- After successful sign-in navigate to `/`, which the existing redirect resolves to `/doctors`; this is the application's current home/landing page. No new home screen is introduced (spec: home page content is out of scope).
- `**` → `/` (and therefore the guard applies).

**Rationale**: A guarded shell prevents any protected component from being created before authentication, which is the strongest interpretation of AC-6/FR-008. A route-level page avoids the unguarded-content flash that an app-level overlay would allow, and keeps the modal presentation.

**Alternatives considered**:
- App-level overlay toggled by a signal — rejected: protected components would be instantiated behind the overlay unless additionally guarded; more moving parts.
- CDK Dialog — rejected: adds a dependency for no functional gain; the page is non-dismissible by definition.

---

## D8. Notifications

**Decision**: A tiny `NotificationService` holding a `signal<readonly Toast[]>` with `showSuccess/showError` and auto-dismiss timers; a dumb `ToastContainerComponent` renders them (Tailwind, `role="status"`, `aria-live="polite"`). Sign-in success shows exactly `"You've signed in successfully"`; sign-in rejection shows exactly `"Either an email or a password is incorrect"`.

**Rationale**: The spec requires a notification after sign-in and errors that must read verbatim. A signal-based service is the smallest solution consistent with the constitution and is reusable for future features.

**Alternatives considered**: browser `alert()` (rejected: inaccessible/ugly), third-party toast library (rejected: extra dependency, no need).

---

## D9. Testing strategy

**Decision**: Vitest + Angular TestBed, following the existing specs' style (direct function invocation or `TestBed.runInInjectionContext`), covering:
1. `AuthService`: successful sign-in stores the session and parses role/claims; invalid credentials → generic error; refresh updates expiry; sign-out clears storage even if the logout call fails; restoration from `sessionStorage`.
2. `authGuard`: returns `true` with a valid session; returns a `UrlTree` to `/sign-in` without one.
3. `authInterceptor`: adds the header for Gateway URLs only.
4. `authErrorInterceptor`: 401 from a Gateway URL clears the session; 401 from the Keycloak host does not.
5. `SignInPageComponent`/`SignInFormComponent`: required-field messages, missing-`@` message, password visibility toggle, generic failure message, success notification + navigation.
6. Status gating: allowed statuses pass, `Inactive`/unknown statuses are rejected (mocked profile response).

**Rationale**: These map 1:1 to the acceptance criteria and prevent regressions in the auth flow that previously failed silently.
