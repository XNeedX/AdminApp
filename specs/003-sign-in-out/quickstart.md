# Quickstart: Sign In / Sign Out

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [keycloak-auth](./contracts/keycloak-auth.contract.md), [profiles-sign-in](./contracts/profiles-sign-in.contract.md)

Validation guide for the sign-in/sign-out feature. Implementation details live in `tasks.md`; this file only describes how to prove the behaviour end-to-end.

---

## 1. Prerequisites

### Required tooling

| Tool | Version | Check |
|------|---------|-------|
| Node.js | ≥ 20 (npm 11.6 used by the project) | `node -v` |
| npm | ≥ 11 | `npm -v` |
| Angular CLI | via `npx ng` (no global install needed) | `npx ng version` |

Install dependencies once:

```powershell
cd "E:\Innowise Project\Frontend\AdminApp\AdminApp"
npm install
```

### Required running services

| Service | URL | Purpose |
|---------|-----|---------|
| Keycloak (realm `InnoClinic`) | `http://localhost:8080` | Token issuance, refresh, logout |
| Gateway API | `http://localhost:5137` | All application data calls |
| Profiles API | behind the Gateway `/profiles` route | Profile status / e-mail existence (see §2) |
| AdminApp dev server | `http://localhost:4200` | The app under test |

Health checks:

```powershell
# Keycloak realm must answer 200
Invoke-WebRequest http://localhost:8080/realms/InnoClinic/.well-known/openid-configuration -UseBasicParsing | Select-Object StatusCode

# Gateway must answer (401 without a token is a healthy answer)
Invoke-WebRequest http://localhost:5137/services/specialization -UseBasicParsing -SkipHttpErrorCheck | Select-Object StatusCode
```

### Test credentials

Users confirmed to exist in realm `InnoClinic`:

| Username | Realm roles | Use |
|----------|-------------|-----|
| `testdoctor` | `Doctor`, `default-roles-innoclinic` | Happy path |
| `testreceptionist` | `Receptionist` | Happy path (role variant) |
| `testpatient` | `Patient` | Negative: role gate (AC-6 / assumption) |

---

## 2. Blocker check before validating

Two acceptance criteria depend on backend endpoints that **do not exist yet** (see [profiles-sign-in contract](./contracts/profiles-sign-in.contract.md)).

```powershell
# 1. Keycloak must allow the password grant on the client used by AuthService
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8080/realms/InnoClinic/protocol/openid-connect/token" `
  -Body @{ grant_type='password'; client_id='admin-app-client'; username='testdoctor'; password='<password>'; scope='openid' }
# Expected: 200 + access_token.  'unauthorized_client' => directAccessGrantsEnabled is false.

# 2. E-mail existence endpoint (F-1). Expected: 200 {"exists":true}
Invoke-WebRequest "http://localhost:5137/profiles/accounts/exists?email=doctor@example.com" -UseBasicParsing -SkipHttpErrorCheck |
  Select-Object StatusCode, Content
# 404 => rule disabled (fail-open).  F-1 is only fully satisfied with a 200.
```

| Check | Failing result | Impact |
|-------|----------------|--------|
| Password grant disabled | `unauthorized_client` | **All sign-in scenarios fail** — fix realm first |
| `/profiles/accounts/exists` missing | `404` / `401` | Scenarios in §3.2 marked **[BLOCKED]** cannot be validated |
| `/profiles/{type}/account/{id}` missing | `404` / `401` | Scenarios in §3.3 marked **[BLOCKED]** cannot be validated |

---

## 3. Validation scenarios

Run against `npm start` → `http://localhost:4200/sign-in`.

### 3.1 Form validation (F-1, F-2, AC-7)

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open `/sign-in`, click `Sign in` with both fields empty | E-mail shows `Please, enter the email` with a red border; password shows `Please, enter the password` with a red border; no request is sent |
| 2 | Type `not-an-email`, blur | `You've entered an invalid email`, red border |
| 3 | Type `a@b` and blur | No format error (contains `@`) |
| 4 | Type a 5-character password, blur | `Password must be between 6 and 15 characters`, red border |
| 5 | Type a 16-character password, blur | Same length message |
| 6 | Type a 6-character password | No length error (boundary accepted) |
| 7 | Type any e-mail, click the eye icon | Value becomes visible; the typed text is unchanged; icon state toggles |
| 8 | Edit a field after a failed submit | The submit error disappears immediately |
| 9 | Tab through the form | Focus rings are visible; labels are associated with inputs; the eye toggle has an accessible name |

### 3.2 E-mail existence (F-1 rule 3)

| # | Steps | Expected |
|---|-------|----------|
| 10 | Blur a well-formed address that is not registered | `User with this email doesn't exist`, red border, submit blocked — **[BLOCKED]** until `GET /profiles/accounts/exists` exists |
| 11 | Blur `testdoctor`'s e-mail | No existence error |
| 12 | Network tab: slow the API to > 1 s | No duplicate requests while typing (debounced, single in-flight) |
| 13 | Stop the Profiles API (endpoint returns 5xx) | No existence message; submit allowed (fail-open); one warning in the console |

### 3.3 Successful sign-in (AC-1, AC-2, AC-3)

| # | Steps | Expected |
|---|-------|----------|
| 14 | Enter `testdoctor` credentials, click `Sign in` | Toast `You've signed in successfully`; app navigates to `/doctors`; header shows the user's e-mail and `Sign out` |
| 15 | DevTools → Application → Session Storage | `adminapp.auth.session` exists with `accessToken`, `refreshToken`, `expiresAt`; nothing in `localStorage` |
| 16 | DevTools → Network, then a data action | Gateway requests carry `Authorization: Bearer …`; Keycloak `…/token` requests do not |
| 17 | Press `Enter` in the password field with valid data | Signs in (keyboard submit works) |
| 18 | Repeat with `testreceptionist` | Signs in; `/doctors` loads with receptionist permissions |
| 19 | Reload the page while signed in | Still signed in (FR-014); the requested route is preserved |
| 20 | Doctor with status `Inactive` | Generic error, no session stored — **[BLOCKED]** until the profile-status endpoint exists |
| 21 | Doctor with an unknown status value (e.g. `Retired`) | Generic error (fail closed) — **[BLOCKED]** as above |
| 22 | `testpatient` credentials | Generic error; no session stored (role gate) |

### 3.4 Failed sign-in (FR-007)

| # | Steps | Expected |
|---|-------|----------|
| 23 | Correct e-mail, wrong password | `Either an email or a password is incorrect`; no session; form stays on screen |
| 24 | Unknown but well-formed e-mail, any password | **Identical** message and styling to #23 (no disclosure) |
| 25 | Compare #23 and #24 side by side | Same text, same colour, same position — no timing-independent hint in the UI |
| 26 | Stop Keycloak, submit | `Sign-in is temporarily unavailable. Please try again.`; no crash; no session |
| 27 | Double-click `Sign in` | Only one request; the button is disabled while the request is in flight |

### 3.5 Route protection (AC-6, FR-008)

| # | Steps | Expected |
|---|-------|----------|
| 28 | Sign out, then open `/doctors` directly | Redirected to `/sign-in`; no doctor component is instantiated (no flash of protected content) |
| 29 | Open an unknown URL, e.g. `/nope`, while signed out | Redirected to `/sign-in` |
| 30 | Open `/sign-in` while already signed in | Redirected to the app home (`/doctors`) |
| 31 | Open `/sign-in` while signed out | Modal card renders over a dimmed backdrop; no close button; `Escape` and backdrop clicks do nothing (FR-013) |
| 32 | Check the browser history after being redirected from `/doctors` | `Back` does not reveal the protected page |

### 3.6 Sign out (AC-8, AC-9, SC-006)

| # | Steps | Expected |
|---|-------|----------|
| 33 | Click `Sign out` | Returns to `/sign-in` in under 5 s |
| 34 | Session Storage after sign-out | `adminapp.auth.session` is gone |
| 35 | Reload after sign-out | Stays on `/sign-in` |
| 36 | Stop Keycloak, then click `Sign out` | Still redirected to `/sign-in` and the session is cleared (local deletion is unconditional) |
| 37 | Re-open a previously loaded protected route after sign-out | Redirected to `/sign-in` |

### 3.7 Token refresh and expiry

| # | Steps | Expected |
|---|-------|----------|
| 38 | Sign in, leave the tab open until 60 s before expiry | Exactly one `grant_type=refresh_token` request; the session stays valid |
| 39 | After a refresh, inspect `expiresAt` | Extended; `refreshToken` updated if Keycloak returned a new one |
| 40 | Invalidate the refresh token in Keycloak, wait for the refresh | Session cleared, redirect to `/sign-in`, no request loop |
| 41 | Return `401` from a Gateway call with a valid session (e.g. revoke the token server-side) | Session cleared once, redirect to `/sign-in`; the Keycloak host itself is not treated as a Gateway 401 |

### 3.8 Responsiveness and accessibility

| # | Steps | Expected |
|---|-------|----------|
| 42 | Resize to 375 px width | The card fits without horizontal scroll; fields stay usable |
| 43 | Resize to 1440 px | Centered card, readable line lengths |
| 44 | Screen reader on `/sign-in` | Focus starts in the e-mail field; toasts are announced (`role="status"`, `aria-live="polite"`); errors are tied to inputs via `aria-describedby` |

---

## 4. Automated checks

```powershell
cd "E:\Innowise Project\Frontend\AdminApp\AdminApp"

# Unit tests (Vitest + Angular TestBed), single run
npx ng test --watch=false

# Type and template check (development configuration)
npx ng build --configuration development

# Optional: watch mode while implementing
npx ng test
```

Expected test coverage areas (see [research.md](./research.md) D9):

| Area | File under test |
|------|-----------------|
| Sign-in / refresh / sign-out / session restore / role gate | `core/services/auth.service.ts` |
| Guard returns `true` or a `UrlTree` | `core/guards/auth.guard.ts` |
| Bearer header only for Gateway URLs | `core/interceptors/auth.interceptor.ts` |
| `401` clears the session only for Gateway URLs | `core/interceptors/auth-error.interceptor.ts` |
| Required / format / length messages, visibility toggle | `features/auth/components/sign-in-form/` |
| Submit error, success toast, navigation | `features/auth/pages/sign-in-page/` |
| Status gating (permitted, `Inactive`, unknown, receptionist `null`) | `core/services/auth.service.ts` |

Both commands must exit with code `0` before the feature is considered done.

---

## 5. Readiness checklist

- [ ] `npm install` completed without errors
- [ ] Keycloak realm `InnoClinic` reachable and password grant enabled for `AUTH_CLIENT_ID`
- [ ] Gateway reachable at `environment.apiUrl` with CORS allowing the app origin
- [ ] `npx ng test --watch=false` green
- [ ] `npx ng build --configuration development` green
- [ ] Scenarios §3.1–§3.6 pass (excluding `[BLOCKED]` rows, which require the new endpoints)
- [ ] No token, e-mail, or password appears in the console, URLs, or `localStorage`
- [ ] Session is removed on sign-out, refresh failure, and Gateway `401`

---

## 6. Validation log (implementation run — 2026-11-11)

Recorded from the actual environment, not from expectations.

| Check | Result |
|-------|--------|
| `POST /realms/InnoClinic/protocol/openid-connect/token` (`public-client`, `grant_type=password`) | **BLOCKED** — `400 {"error":"unauthorized_client","error_description":"Client not allowed for direct access grants"}` |
| `GET /profiles/accounts/exists?email=…` | **404** (endpoint not implemented) → existence rule disabled, fail-open |
| `GET /profiles/doctors/account/{id}` | **404** → status gate fail-open |
| `GET /profiles/receptionists/account/{id}` | **404** → status gate fail-open |
| `GET /profiles/me` | **404** |
| `npx ng test --watch=false` | **PASS** — 14 files, 85 tests |
| `npx ng build --configuration development` | **PASS** |
| `any` / `console.log` / `localStorage` in new code | **none** |
| `keycloak-angular`, `keycloak-js`, `silent-check-sso.html` | removed |

Scenario coverage: §3.1, §3.3–§3.5 are covered by unit/integration tests (form, guard, interceptors, service, page). Browser-driven rows that require a real token (14, 18, 19, 23–27) cannot pass until `directAccessGrantsEnabled=true` is enabled. Rows 10, 20, 21 stay **[BLOCKED]** until the profile endpoints exist.
