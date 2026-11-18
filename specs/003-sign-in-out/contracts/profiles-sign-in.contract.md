# Contract: Sign-In Support Endpoints (Profiles / Gateway)

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Research**: [../research.md](../research.md) D3, D4

**Status**: **PROPOSED — NOT IMPLEMENTED.** These endpoints do not exist in the current Gateway (`Backend/GatewayAPI/ocelot.json`) or in `ProfilesAPI`. They are prerequisites for **F-1 rule 3** and **AC-4/AC-5**.

**Consumer**: `AuthService` (status check) and the e-mail async validator (existence check).
**Producer**: `ProfilesAPI`, exposed through `GatewayAPI` under the `/profiles` upstream route.

> **Constitution note**: When these endpoints land, the generated API client must be regenerated from the Profiles `swagger.json` and these hand-written calls must be replaced (Missing Contract Protocol). The shapes below are the specification for that regeneration — do not read them as permission to hand-write DTOs permanently.

---

## 0. Why these endpoints are needed

| Requirement | Gap in current backend | Consequence today |
|-------------|------------------------|-------------------|
| F-1 rule 3 — "User with this email doesn't exist" | No unauthenticated e-mail lookup exists; `GET /profiles/doctors` requires the `Patient`/`Receptionist` role | Rule unavailable before sign-in (fail-open) |
| AC-4/AC-5 — reject `Inactive` / non-working profiles | No lookup by account id; `GET /profiles/doctors/{id}` requires `Patient`/`Doctor` and takes a profile GUID, not the Keycloak `sub` | Status cannot be evaluated (fail-open) |

Facts confirmed by read-only inspection:

- `Profiles.Domain.Models.DoctorProfile` has `AccountId`, `Email`, `Status` (default `"At work"`).
- `Profiles.Domain.Models.ReceptionistProfile` has `AccountId`, `Email`, and **no status field**.
- `ProfilesAPI` controllers: `DoctorsController` (`api/doctors`, role-gated), `ReceptionistsController` (role-gated), `PatientsController` (only account-based lookup is `GET api/patients/account/{accountId}`).
- `AuthorizationAPI` exposes only `GET users/me` (claims, no profile status).
- Keycloak user attributes are empty for staff users — status is not in the token.

---

## 1. `GET /profiles/accounts/exists?email={email}` — unauthenticated

Answers F-1 rule 3. Must be usable **before** authentication.

### Request

| Part | Value |
|------|-------|
| Method / path | `GET {apiUrl}/profiles/accounts/exists` |
| Query | `email` — the address exactly as typed, trimmed; client applies `encodeURIComponent` |
| Auth | **none** (anonymous) |
| Casing | case-insensitive match on the server |

### Response `200 OK`

```json
{ "exists": true }
```

| Field | Type | Notes |
|-------|------|-------|
| `exists` | boolean | `true` if a Doctor **or** Receptionist profile owns this e-mail |

- `200` with `{"exists": false}` for an unknown address. Must not be `404`.
- The response must contain **only** the boolean — no names, ids, or statuses (limits disclosure before authentication).
- `400` for a syntactically invalid e-mail. In that case the client keeps the "invalid e-mail" message from its local rule and does not show the existence message.

### Non-functional requirements

| Requirement | Value | Why |
|-------------|-------|-----|
| Anonymous access | required | Called before credentials exist |
| Rate limiting | per-IP, e.g. 10 req/min | Prevent enumeration of the staff directory |
| Latency | < 500 ms p95 | SC-005: feedback < 1 s after blur |
| Caching | `Cache-Control: no-store` | Staleness would produce wrong validation |
| Token usage | **no** token attached | `authInterceptor` must skip this URL explicitly |

### Client behaviour

| HTTP result | UI |
|-------------|-----|
| `200 {"exists": true}` | No error; form may be submitted |
| `200 {"exists": false}` | Red border + `User with this email doesn't exist`; submit blocked |
| `400` | No existence error (local format rule already covers it) |
| `401`/`403` | **Fail-open**: log a warning once, allow submit (the endpoint is misconfigured; do not lock users out) |
| `404` (not implemented yet) | **Fail-open**: log `Sign-in e-mail existence endpoint unavailable`, disable the rule |
| Network/`5xx` | **Fail-open**: allow submit; Keycloak remains the authority on validity |

Debounce: 300 ms, only after the value is non-empty and contains `@`, `updateOn: 'blur'`. At most one in-flight request; a newer value cancels the older (`switchMap`).

---

## 2. `GET /profiles/doctors/account/{accountId}` — authenticated

Answers AC-4/AC-5 for doctors, using the token's `sub` claim (no extra identity lookup required).

### Request

| Part | Value |
|------|-------|
| Method / path | `GET {apiUrl}/profiles/doctors/account/{accountId}` |
| Path param | `accountId` — UUID string from the `sub` claim |
| Auth | Bearer token (the signed-in user's own token) |
| Authorization | The caller's `sub` must equal `accountId`; roles `Doctor` (own profile) or `Receptionist` (any) |

### Response `200 OK`

```json
{
  "id": "3f1c…",
  "accountId": "8a2b…",
  "email": "doctor@example.com",
  "status": "At work"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | Doctor profile id |
| `accountId` | string | Echoes the Keycloak `sub` |
| `email` | string | Profile e-mail |
| `status` | string | One of the existing `DoctorStatus` values: `At work`, `On vacation`, `Sick Day`, `Sick Leave`, `Self-isolation`, `Leave without pay`, `Inactive` |

### Errors

| Status | Meaning | Client behaviour |
|--------|---------|------------------|
| `404` | No doctor profile for this account | Not a doctor → generic sign-in rejection |
| `401` | Token rejected | Session cleared → `/sign-in` |
| `403` | Role/owner mismatch | Generic sign-in rejection |

### Client status rule

Permitted: everything **except** `Inactive` and unrecognised values (unknown statuses fail closed once the endpoint exists).

---

## 3. `GET /profiles/receptionists/account/{accountId}` — authenticated

Answers AC-4/AC-5 for receptionists. Mirrors §2.

### Response `200 OK`

```json
{
  "id": "b71d…",
  "accountId": "8a2b…",
  "email": "reception@example.com",
  "status": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `status` | `string \| null` | `null` while the backend model has no status column; the client treats `null` as **permitted** |

`404` → not a receptionist → generic sign-in rejection. Same `401`/`403` handling as §2.

If a status column is added later, the same permitted/inactive rule set as doctors applies without a client change.

---

## 4. Alternative single endpoint (preferred if convenient for the backend)

```
GET /profiles/me            (authenticated)
→ 200 { "profileType": "Doctor" | "Receptionist", "id": "...", "accountId": "...", "email": "...", "status": "At work" | null }
```

`AuthService` accepts either shape through its type guards; the decision is the backend team's. This variant is preferable because it derives `accountId` from the token instead of trusting a path parameter.

---

## 5. Sign-in sequence using these contracts

```text
1. submit(email, password)
2. POST Keycloak /token (password grant)
   ├─ 4xx ────────────────────────────────────► generic sign-in error
   └─ 200
3. parse claims → roles ∈ {Doctor, Receptionist}?
   └─ no ─────────────────────────────────────► discard token, generic error
4. GET /profiles/{type}/account/{sub}     (or /profiles/me)
   ├─ 200 status permitted ───────────────────► store session, toast, navigate
   ├─ 200 status = Inactive / unknown ────────► logout token, generic error
   ├─ 404 ────────────────────────────────────► logout token, generic error
   └─ 404-because-missing-endpoint / 5xx ─────► fail-open: store session + warn
5. success → "You've signed in successfully" → navigate to `/`
```

---

## 6. Interim behaviour (explicitly NOT spec-compliant)

Until endpoints §1–§3 exist:

| Requirement | Interim behaviour | Risk |
|-------------|-------------------|------|
| F-1 rule 3 | Rule disabled; empty/`@` rules still enforced | Users can submit an unknown e-mail; Keycloak rejects it anyway (`invalid_grant`) |
| AC-4 / AC-5 | Only the role gate is enforced | An `Inactive` doctor can sign in — **spec violation**, must be fixed before production |

The interim path must be observable: log a single `console.warn` per missing endpoint at startup of the first sign-in attempt, and record the gap in the feature's release notes.

---

## 7. Test seams

| Scenario | Mock | Expected |
|----------|------|----------|
| E-mail exists | `GET …/accounts/exists` → `{exists:true}` | no form error |
| E-mail unknown | `{exists:false}` | `User with this email doesn't exist` |
| Existence call `401`/`404`/`500` | error | fail-open, submit allowed |
| Doctor `At work` | profile → status `At work` | signed in |
| Doctor `Inactive` | profile → status `Inactive` | generic error, session not stored |
| Doctor unknown status | status `"Retired"` | generic error (fail closed) |
| Receptionist `status: null` | profile | signed in |
| Profile `404` | error | generic error, session not stored |
| Profile `5xx` | error | fail-open, signed in + warning |
