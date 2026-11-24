# Phase 1 — Data Model: Bugfix Iteration 1

Only models **touched or introduced by the fixes** are listed. Generated DTOs remain
authoritative and are never edited by hand.

## Bug 1 — Auth

### `AuthSession` *(existing, unchanged shape)*

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `accessToken` | `string` | Keycloak `access_token` | Validated by `isTokenResponse` |
| `refreshToken` | `string` | Keycloak `refresh_token` | `''` if absent; refresh skipped |
| `expiresAt` | `number` | `Date.now() + expires_in * 1000` | Drives `scheduleRefresh` |

Persistence: `sessionStorage[AUTH_SESSION_STORAGE_KEY]`, validated by `isAuthSession` on restore.

### `SignInOutcome` *(existing, unchanged)*

```ts
type SignInOutcome = { success: true } | { success: false; reason: 'invalid' | 'unavailable' };
```

| `reason` | Trigger |
|----------|---------|
| `invalid` | Non-2xx 400/401 from Keycloak **or** profile status not permitted **or** no permitted role |
| `unavailable` | Network error, timeout, 5xx, unexpected payload |

### New: `SKIP_AUTH_REDIRECT` context token

```ts
// core/tokens/skip-auth-redirect.token.ts
export const SKIP_AUTH_REDIRECT = new HttpContextToken<boolean>(() => false);
```

**Rule**: when `true`, `authErrorInterceptor` must not clear the session or navigate on 401.
**Used by**: `AuthService.resolveProfileAccess` (fail-open probe).

### `AuthUser` *(computed view, derived — not stored)*

| Field | Type | Derivation |
|-------|------|-----------|
| `accountId` | `string` | JWT `sub` |
| `email` | `string \| undefined` | JWT `email` |
| `roles` | `readonly AuthRole[]` | JWT `realm_access.roles` filtered by `isAuthRole` |

`AuthRole = 'Doctor' | 'Receptionist'` (from `core/models/auth.model.ts`).

## Bug 2 — Patient search *(model: BLOCKED)*

### `PatientOption` *(existing; consumer of phantom API)*

| Field | Type | Validation |
|-------|------|-----------|
| `id` | `string` | non-empty |
| `fullName` | `string` | non-empty |

**Current source**: `GET /Patients` → generated `patientsGet()` → returns `void`. The mapping in `loadPatients()` fabricates rows from `void`/`any`, so `patientOptions` is effectively always empty.

### Target: `PatientSearchQuery` *(introduced after regeneration)*

| Field | Type | Constraint |
|-------|------|-----------|
| `term` | `string` | trimmed; empty term → no request |
| `page` | `number` | ≥ 1 |
| `pageSize` | `number` | fixed (e.g. 20) |

### Target: `PatientSearchResult` *(introduced after regeneration)*

Narrowed from the generated paged DTO via a runtime type guard:

```ts
interface PatientSearchResult {
  readonly items: readonly PatientOption[]; // id + fullName validated
  readonly totalCount: number;              // finite, ≥ items.length
}
```

### Target: `PatientSearchState` *(signal view, displayed by the combobox)*

```ts
interface PatientSearchState {
  readonly items: readonly PatientOption[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly term: string;
}
```

Initial value `{ items: [], loading: false, error: null, term: '' }` via `toSignal(..., { initialValue })`.

**State transitions**

```text
idle ──term change──► debouncing (300ms) ──distinct, non-empty──► loading
loading ──success──► results(items, totalCount)
loading ──error──► failed(error)          [stays retryable; term kept]
loading ──newer term──► cancelled → loading (switchMap)
term cleared ──► idle (items cleared)
```

## Bug 3 — Receptionists

### `ReceptionistProfile` *(narrowed read model; guard-adjusted)*

| Field | Type | Guard rule |
|-------|------|-----------|
| `id` | `string` | required, non-empty |
| `firstName` | `string` | required, non-empty |
| `lastName` | `string` | required, non-empty |
| `middleName` | `string \| null` | optional → normalized `null` |
| `officeAddress` | `string \| null` | **nullable** (was `string`) — a missing address must not reject the row |
| `photoPath` | `string \| null` | optional → normalized `null` |

### `ReceptionistRow` *(changed)*

| Field | Type | Change |
|-------|------|--------|
| `id` | `string` | — |
| `fullName` | `string` | — |
| `officeAddress` | **`string \| null`** | **was `string`** |
| `photoPath` | `string \| null` | — |

### `PagedReceptionistRows` *(unchanged shape, stricter consumption)*

| Field | Type | Rule |
|-------|------|------|
| `data` | `readonly ReceptionistProfile[]` | every item validated |
| `totalCount` | `number` | finite, ≥ 0; drives paging loop |

**Paging rule change**: evaluation **per page** — a contract failure on page *N* retains pages
`1..N-1` and produces a *specific* `loadError`, never a silent empty table.

## Relationship map

```text
AuthSession ─(parseJwtClaims)─► AuthUser.roles ─(roleGuard)─► route /receptionists
GET /Receptionists ─(isPagedReceptionistRows, per page)─► ReceptionistProfile ─(toRow)─► ReceptionistRow
GET /Patients (search, regenerated) ─(guard)─► PatientSearchResult ─► ComboboxOptions ─► AppointmentFormStore.catalogs.patients
```
