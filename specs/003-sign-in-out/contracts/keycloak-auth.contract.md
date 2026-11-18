# Contract: Keycloak Authentication (Sign In / Refresh / Sign Out)

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Research**: [../research.md](../research.md) D1, D2, D6

**Type**: External OIDC/IdP HTTP contract (not a `Backend/` Swagger contract).
**Consumer**: `AdminApp/src/app/core/services/auth.service.ts` only.
**Producer**: Keycloak, realm `InnoClinic`, configured by `environment.keycloakUrl`.

> **Constitution note**: This is the documented exception to the "no hand-written API clients" rule. Keycloak endpoints are not described by any backend `swagger.json`, so no generated client can cover them. All calls are isolated in `AuthService`; no other file may call these URLs.

---

## 1. Prerequisites (blocking, external)

| Setting | Required value | Current value | Owner |
|---------|----------------|---------------|-------|
| `directAccessGrantsEnabled` | `true` | `false` | Realm administrator |
| `standardFlowEnabled` | any | `true` | Realm administrator |
| `publicClient` | `true` (no client secret in the SPA) | `true` | Realm administrator |
| Realm | `InnoClinic` | `InnoClinic` | — |
| CORS: allowed origin | `http://localhost:4200` (dev) / deployed origin | configured | Realm administrator |

Two acceptable configurations:

- **A (preferred for isolation)**: a new client `admin-app-client` with `directAccessGrantsEnabled=true`, `publicClient=true`.
- **B**: enable direct grants on the existing `public-client`.

The client id is a single constant in `AuthService` (`AUTH_CLIENT_ID`); switching A↔B is a one-line change. If the realm answers `unauthorized_client`, the app must surface the generic sign-in message and log a configuration warning — never a raw Keycloak error.

---

## 2. Sign In — Resource Owner Password Credentials grant

```
POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
```

| Form field | Value |
|------------|-------|
| `grant_type` | `password` |
| `client_id` | `AUTH_CLIENT_ID` (`admin-app-client` or `public-client`) |
| `username` | e-mail entered in the form |
| `password` | password entered in the form |
| `scope` | `openid` |

### 2.1 Success response — `200 OK`

```json
{
  "access_token": "<jwt>",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "refresh_token": "<opaque>",
  "token_type": "Bearer",
  "session_state": "<uuid>",
  "scope": "openid profile email"
}
```

Required by the client: `access_token` (string), `expires_in` (number > 0), `refresh_token` (string). `token_type` must be `Bearer` when present.

- `session.expiresAt = Date.now() + expires_in * 1000` (`expires_in` has no safety margin applied beyond the proactive-refresh offset).
- Any missing/invalid required field → treat as temporary failure (no session created).

### 2.2 Error response — `400` / `401`

```json
{ "error": "invalid_grant", "error_description": "Invalid user credentials" }
```

| `error` | Meaning | Client behaviour |
|---------|---------|------------------|
| `invalid_grant` | Unknown e-mail **or** wrong password (indistinguishable by design) | Show `Either an email or a password is incorrect` |
| `unauthorized_client` | Direct grants disabled on the client | Same generic message + `console.warn` configuration hint |
| `invalid_client` | Wrong client id | Same generic message + `console.warn` |
| `invalid_request` | Malformed request (missing username/password) | Same generic message |
| any `5xx` / network error / CORS failure | Infrastructure problem | `Sign-in is temporarily unavailable. Please try again.` |

**Security rule (FR-007)**: the UI must never distinguish "unknown e-mail" from "wrong password". The `error_description` is never rendered.

### 2.3 Banned/inactive Keycloak account

Keycloak answers `400 invalid_grant` with `error_description: "Account is not fully set up"` or `"Account disabled"`. Both map to the generic sign-in message. No special UI.

---

## 3. Refresh — `grant_type=refresh_token`

```
POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
```

| Form field | Value |
|------------|-------|
| `grant_type` | `refresh_token` |
| `client_id` | `AUTH_CLIENT_ID` |
| `refresh_token` | current refresh token |

Success `200` has the same shape as §2.1 (a new `refresh_token` may be returned; when absent, the previous one is retained). `expiresAt` and the proactive-refresh timer are recomputed.

Failure (`400 invalid_grant` = expired/revoked, or `401`) → clear the session and redirect to `/sign-in`; never retry in a loop.

**Trigger**: 60 s before `expiresAt`, and only while a session exists. A guard/interceptor may also force a refresh when a Gateway call returns `401` and a refresh token is still valid.

---

## 4. Sign Out — `POST /logout`

```
POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/logout
Content-Type: application/x-www-form-urlencoded
```

| Form field | Value |
|------------|-------|
| `client_id` | `AUTH_CLIENT_ID` |
| `refresh_token` | current refresh token |

Response `204` (or any status) → ignored. **Local session state is cleared unconditionally**, in a `finalize`-style step, even on network failure/timeout (spec edge case: "system serves no purpose, tokens must be deleted"). The request uses a short timeout (≤ 3 s) so sign-out never feels stuck (SC-006: < 5 s).

---

## 5. Claims consumed from the access token

Decoded client-side. Signature validation is intentionally **not** performed by the SPA (the Gateway validates it); the payload is used for display and routing only, never as an authorization decision for backend data.

| Claim | Type | Use | Required |
|-------|------|-----|----------|
| `sub` | string | `AuthenticatedUser.accountId`; profile-status lookup | yes |
| `email` | string | Header display; fallback existence of identity | no (fallback `preferred_username`) |
| `preferred_username` | string | Display fallback | no |
| `exp` | number (seconds) | Cross-check against `expires_in` | no |
| `realm_access.roles` | string[] | Application role gate (`Doctor`, `Receptionist`) | yes for access |

**Role gate**: roles must include at least one of `Doctor`, `Receptionist`. Otherwise the attempt is rejected with the generic sign-in message (spec assumption: only staff use the admin app). Unknown roles are ignored.

Malformed/missing required claims → session is discarded, generic failure shown.

---

## 6. Token storage contract

| Key | Storage | Value |
|-----|---------|-------|
| `adminapp.auth.session` | `sessionStorage` | `{"accessToken":"…","refreshToken":"…","expiresAt":1699999999999}` |

- Restored on `AuthService` construction via `isAuthSession()` type guard; invalid JSON/shape is removed.
- A restored session whose `expiresAt` is in the past is discarded unless a refresh succeeds.
- Removed on sign-out, on refresh failure, and on `401` from a Gateway URL.
- Never written to `localStorage`; never placed in a URL, query string, or log.

---

## 7. Test seams

`AuthService` must accept an injectable HTTP layer so the contract above is testable with `HttpTestingController`:

| Scenario | Expected request | Expected outcome |
|----------|------------------|------------------|
| Valid credentials, staff role | `POST …/token`, `grant_type=password` | session stored, signals updated, `true` |
| Wrong password | `POST …/token` → `400 invalid_grant` | no session, generic message |
| `unauthorized_client` | `POST …/token` → `400` | no session, generic message + warning |
| Unknown role (`Patient`) | `POST …/token` → `200` | session cleared, generic message |
| Refresh before expiry | `POST …/token`, `grant_type=refresh_token` | new `expiresAt`, timer rescheduled |
| Refresh failure | `POST …/token` → `400` | session cleared |
| Sign out, network error | `POST …/logout` fails | session still cleared |
