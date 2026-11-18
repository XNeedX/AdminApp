# Phase 1 Data Model: Sign In / Sign Out

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

The frontend owns no database. The entities below describe the client-side session model, form model, and the shapes consumed from Keycloak and the Gateway.

---

## 1. `AuthSession`

The persisted authenticated state.

| Field | Type | Notes |
|-------|------|-------|
| `accessToken` | `string` | JWT issued by Keycloak; attached to Gateway calls |
| `refreshToken` | `string` | Used for `grant_type=refresh_token`; revoked on sign-out |
| `expiresAt` | `number` | Epoch milliseconds derived from `expires_in`; used for proactive refresh |

**Storage**: `sessionStorage` key `adminapp.auth.session`, JSON-serialised. Restored on `AuthService` construction and validated with a type guard; invalid/rejected data is discarded silently.

**Lifecycle**:

```text
(absent) --signIn success--> active --proactive refresh--> active
   ^                            |                              |
   |                            +--signOut()------------------+
   |                            +--refresh failure------------+
   |                            +--401 from Gateway-----------+--> cleared --> /sign-in
```

---

## 2. `AuthenticatedUser`

Derived (computed) from the access token — never persisted separately.

| Field | Type | Source claim | Notes |
|-------|------|--------------|-------|
| `accountId` | `string` | `sub` | Used for the profile lookup |
| `email` | `string` | `email` (fallback `preferred_username`) | Shown in the header |
| `roles` | `readonly AuthRole[]` | `realm_access.roles` | Filtered to known application roles |

**`AuthRole`**: `'Doctor' | 'Receptionist'`.

**Rule**: Any account whose roles contain neither `Doctor` nor `Receptionist` is rejected with the generic sign-in message (spec assumption; e.g. `Patient`).

---

## 3. `ProfileStatus`

Matches the backend doctor status vocabulary (`DoctorStatus` enum already present in `features/doctors/models/doctor-form.model.ts`).

| Value | Permits work |
|-------|--------------|
| `At work` | yes |
| `On vacation` | yes |
| `Sick Day` | yes |
| `Sick Leave` | yes |
| `Self-isolation` | yes |
| `Leave without pay` | yes |
| `Inactive` | **no** |
| any other value | **no** (unknown statuses fail closed) |

**Receptionists**: the backend model has no status field. A receptionist profile is treated as permitted once the role check passes. If a status is added to the backend later, the same rule set applies.

---

## 4. `SignInForm` (typed reactive form)

| Control | Type | `updateOn` | Synchronous validators | Async validators |
|---------|------|-----------|------------------------|------------------|
| `email` | `FormControl<string>` | `change` (reveal errors on blur) | required, must contain `@` | account-exists (debounced 300 ms, only when the format is valid) |
| `password` | `FormControl<string>` | `change` (reveal errors on blur) | required, `minLength(6)`, `maxLength(15)` | — |

**Note**: validation runs on every change, but messages are only revealed once the control is `touched` (blurred) or `dirty`. This gives "validation on blur" from the user's perspective while keeping Enter-to-submit working — with `updateOn: 'blur'` the model would still hold the previous value when the user presses Enter inside the field.

### Validation message matrix

| Control | Condition | Border | Message (exact) |
|---------|-----------|--------|-----------------|
| email | empty / whitespace | red | `Please, enter the email` |
| email | non-empty without `@` | red | `You've entered an invalid email` |
| email | well-formed, not registered | red | `User with this email doesn't exist` *(requires the D4 endpoint)* |
| password | empty | red | `Please, enter the password` |
| password | length < 6 or > 15 | red | `Password must be between 6 and 15 characters` *(default wording, spec assumption)* |
| form | sign-in rejected (unknown account, wrong password, `Inactive`, non-permitted status, non-permitted role, `invalid_grant`, `unauthorized_client`) | — | `Either an email or a password is incorrect` |
| form | temporary system failure / network error | — | `Sign-in is temporarily unavailable. Please try again.` *(default wording, spec assumption)* |

**Precedence**: required → format → existence → submit error. The submit error is cleared as soon as the user edits either field.

**Behavioural rules**:
- `Sign in` is disabled while a sign-in request is in flight (prevents double submission).
- `Enter` in either field submits when the form is valid.
- The password input type is bound to a signal: `passwordVisible() ? 'text' : 'password'`; toggling never clears the value.
- The submit error is **not** tied to a specific field (FR-007: never reveal which credential failed).

---

## 5. Auth state machine

```text
anonymous ──submit──> authenticating ──token+allowed profile──> authenticated ──signOut/401/expiry──> anonymous
                          │
                          ├──invalid credential / inactive / forbidden role──> anonymous (generic message)
                          └──network / 5xx───────────────────────────────────> anonymous (temporary-failure message)
```

| State | UI |
|-------|----|
| `anonymous` | `/sign-in` modal card; no protected component instantiated |
| `authenticating` | Form disabled, `Sign in` shows a busy state |
| `authenticated` | Guarded shell + requested page; header shows the user's e-mail and `Sign out` |

---

## 6. `Toast`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Stable key for `@for` tracking |
| `kind` | `'success' \| 'error'` | Drives Tailwind palette |
| `message` | `string` | Verbatim spec text where applicable |
| `timeoutMs` | `number` | Default 4000; cleared on unmount |

---

## 7. External payload shapes (consumed, validated by type guards)

### Keycloak token response
```ts
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: 'Bearer';
}
```
Any other shape → `TemporaryAuthError` (no session created).

### Keycloak error response
```ts
interface TokenErrorResponse {
  error: string;            // e.g. 'invalid_grant', 'unauthorized_client'
  error_description?: string;
}
```
Mapping: `invalid_grant` → generic sign-in message; `unauthorized_client` → configuration error, generic message + console warning.

### Profile lookup (proposed, see contracts)
```ts
interface ProfileStatusResponse {
  id: string;
  email: string;
  status: ProfileStatus | null;   // null for receptionists
}
```

### E-mail existence (proposed, see contracts)
```ts
interface EmailExistsResponse {
  exists: boolean;
}
```

---

## 8. Required type guards

- `isAuthSession(value: unknown): value is AuthSession`
- `isTokenResponse(value: unknown): value is TokenResponse`
- `isProfileStatusResponse(value: unknown): value is ProfileStatusResponse`
- `isEmailExistsResponse(value: unknown): value is EmailExistsResponse`
- `parseJwtClaims(token: string): JwtClaims | null` (base64url payload decode + shape validation; never throws)

All guards live with the auth models; malformed external data is treated as "unavailable", never as trusted.
