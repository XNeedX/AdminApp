# Contract: Doctor Profile Management API

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

**Consumer**: `ProfilePageComponent`, `DoctorsPageComponent` through the strictly typed hand-written clients in `src/app/api/`.
**Producer**: Profiles API and Documents API, exposed through the Gateway (`/profiles/*`, `/documents/*`).

> **Client note**: `AdminApp` has no OpenAPI generator. The clients are hand-written and strictly typed: every payload is treated as `unknown` and narrowed with runtime guards. No `any`, no unchecked casts. If an endpoint changes shape, the guards fail loudly instead of silently corrupting the UI.

---

## 0. Endpoint summary

| # | Capability | Method / path (through Gateway) | Status | Roles |
|---|---|---|---|---|
| E1 | Current doctor's own profile | `GET /profiles/doctors/account/{accountId}` | **PROPOSED** | `Doctor` (own) |
| E2 | Full doctor profile by id | `GET /profiles/doctors/{id}` | **EXISTS — roles/response must be widened** | `Patient`, `Doctor`, **`Receptionist`** |
| E3 | Update doctor profile | `PUT /profiles/doctors/{id}` | **EXISTS** | `Doctor`, `Receptionist` |
| E4 | Status change | `GET E2` + `PUT E3` | **Composed client-side** | `Receptionist` |
| E5 | Doctors table | `GET /profiles/doctors/doctors` | **EXISTS** | `Receptionist` |
| E6 | Offices catalog | `GET /offices/offices?Page=&PageSize=` | **EXISTS** | authenticated staff |
| E7 | Specializations catalog | `GET /services/specialization?Page=&PageSize=` | **EXISTS** | authenticated staff |
| E8 | Photo upload | `POST /documents/documents` (multipart) | **EXISTS** | authenticated staff |

Facts confirmed by read-only inspection of `Backend/ProfilesAPI`:

- `DoctorProfile` has `AccountId`, `Email`, `Status` (default `"At work"`), `PhotoPath`, names, `DateOfBirth`, `Specialization`, `OfficeAddress`, `CareerStartYear`.
- `DoctorsController` (`api/doctors`):
  - `POST` — `Receptionist`.
  - `GET` — `Patient, Receptionist`; filters `Status == "At work"`.
  - `GET {id:guid}` — `Patient, Doctor`; returns `DoctorDetailsDto` (**no `Id`, no `Status`**).
  - `GET doctors` — `Receptionist`; returns `DoctorTableRowDto` (includes `Id` and `Status`).
  - `PUT {id:guid}` — `Doctor, Receptionist`; body `UpdateDoctorDto` (includes `Status`).
- `DoctorService.GetDoctorProfileForAdminAsync` returns `DoctorAdminDto` (includes `Status`) but no controller action exposes it. `DoctorAdminDto` also omits `Id`.
- `DoctorProfile.AccountId` is currently `NULL` for every seeded doctor, and no provisioning code writes the Keycloak `sub` back. E1 therefore also requires an account-link/backfill step.
- The Gateway `/profiles/{everything}` route allows `Get, Post, Put, Delete, Options`. No `PATCH` is needed because E4 uses `PUT`.
- The Gateway HTTP port is `http://localhost:5137` (`environment.apiUrl` already points there).
- Controller actions return `IActionResult` without `[ProducesResponseType]`; this does not block the hand-written client.

---

## 1. E1 — Current doctor's own profile (PROPOSED)

Needed by US2 (Doctor views own profile) and US1 (Doctor edits own profile).

### Request

| Part | Value |
|---|---|
| Method / path | `GET {apiUrl}/profiles/doctors/account/{accountId}` |
| Path param | `accountId` = Keycloak `sub` from the access token (`AuthService.user().accountId`) |
| Auth | Bearer token |
| Authorization | `Doctor`; the profile must belong to the caller |

There is no `GET /me`. The client already knows the signed-in identity from the access token, so it sends `sub` explicitly.

**Backend prerequisite**: `DoctorProfile.AccountId` must be populated for the signed-in doctor. The agreed linking rule is `AccountId = Keycloak sub`, backfilled for existing rows (see [backend-unblock-plan.md](../backend-unblock-plan.md) S1). Without the link the endpoint returns `404`.

### Response `200 OK`

```json
{
  "isSuccess": true,
  "message": null,
  "errors": [],
  "data": {
    "id": "3f1c2a9e-6b1d-4f0e-9a77-1c2d3e4f5a6b",
    "photoPath": "documents/2026/11/photo-123.png",
    "firstName": "James",
    "lastName": "Wilson",
    "middleName": "Andrew",
    "dateOfBirth": "1980-04-12T00:00:00Z",
    "specialization": "Cardiology",
    "officeAddress": "Main Wing, Room 101",
    "careerStartYear": 2005,
    "status": "At work"
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string (GUID) | Doctor profile id used by E3. Required. |
| `photoPath` | string \| null | Storage path |
| `firstName`, `lastName` | string | Required |
| `middleName` | string \| null | Optional |
| `dateOfBirth` | ISO date-time | Client normalizes to `yyyy-MM-dd` |
| `specialization` | string | Display name |
| `officeAddress` | string | Display address |
| `careerStartYear` | number | |
| `status` | string | One of the seven statuses. Required. |

The response shape is `DoctorAdminDto` with `Id` added. `DoctorDetailsDto` is **not** sufficient because it omits `id` and `status`.

### Errors

| Status | Meaning | Client behaviour |
|---|---|---|
| `401` | Token rejected | Global interceptor clears session → `/sign-in` |
| `403` | Not a Doctor / not the owner | Redirect to `/`; no profile data shown |
| `404` | No doctor profile linked to the account | Show "Profile not found" state with a retry action |
| `5xx` | Profiles API unavailable | Show load error with retry; keep the app usable |

---

## 2. E2 — Full doctor profile by id (EXISTS, widened)

Needed by the Receptionist profile page and by the status change (E4).

### Required changes

- Add `Receptionist` to `[Authorize(Roles = ...)]` on `GET /api/Doctors/{id:guid}`.
- Return a DTO that includes **`id`** and **`status`** (`DoctorAdminDto` with `Id` is the natural choice).
- Keep `Patient` and `Doctor` access as today.

| Part | Value |
|---|---|
| Method / path | `GET {apiUrl}/profiles/doctors/{id}` |
| Path param | `id` — doctor profile GUID from the table row |
| Auth | Bearer token |
| Authorization | `Patient`, `Doctor`, **`Receptionist`** |
| Response | `200` with `ApiResponse<DoctorAdminDto>` (same shape as E1) |

If `DoctorDetailsDto` must stay for `Patient`, add a separate Receptionist route; the frontend expects the widened path because that is the agreed contract.

### Errors

Same as E1, plus `404` when the doctor id does not exist.

---

## 3. E3 — Update doctor profile (EXISTS)

Used by the Edit form's "Save changes" and by the status change.

### Request

| Part | Value |
|---|---|
| Method / path | `PUT {apiUrl}/profiles/doctors/{id}` |
| Auth | Bearer token |
| Authorization | `Doctor`, `Receptionist` |
| Body | `UpdateDoctorDto` (full payload — no partial updates) |

```json
{
  "photoPath": "documents/2026/11/photo-123.png",
  "firstName": "James",
  "lastName": "Wilson",
  "middleName": "Andrew",
  "dateOfBirth": "1980-04-12",
  "specialization": "Cardiology",
  "officeAddress": "Main Wing, Room 101",
  "careerStartYear": 2005,
  "status": "At work"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `photoPath` | string \| null | no | Send the existing path when the photo is unchanged |
| `firstName` | string | yes | |
| `lastName` | string | yes | |
| `middleName` | string \| null | no | |
| `dateOfBirth` | date | yes | `<= today` |
| `specialization` | string | yes | Display name |
| `officeAddress` | string | yes | Display address |
| `careerStartYear` | number | yes | `<= current year` |
| `status` | string | yes | One of the seven statuses |

### Response `200 OK`

```json
{
  "isSuccess": true,
  "message": "Profile updated successfully",
  "errors": [],
  "data": null
}
```

### Errors

| Status | Meaning | Client behaviour |
|---|---|---|
| `400` | FluentValidation failure | Show the returned messages; keep Edit mode |
| `401` | Token rejected | Global sign-out |
| `403` | Wrong role / not allowed | Show an error toast; keep Edit mode |
| `404` | Doctor not found | Show "Profile not found"; leave Edit mode only if reloading |
| `5xx` | Unavailable | Error toast; keep all values; allow retry |

---

## 4. E4 — Status change (composed from E2 + E3)

Needed by US3: the Receptionist changes a doctor's status from the "Doctors" page.

There is **no** status-only endpoint and **no** `PATCH`. The client composes the operation:

1. `GET /profiles/doctors/{id}` (E2) with the Receptionist token to read the full profile.
2. Build `UpdateDoctorDto` from that profile, replacing only `status`.
3. `PUT /profiles/doctors/{id}` (E3) with the complete payload.

This preserves names, photo, specialization, office, and career start year. It is the agreed approach because `DoctorTableRowDto` lacks the fields required by `UpdateDoctorDto`.

Client behaviour: optimistic row update, select disabled for that row, success toast on `200`, rollback plus error toast on failure.

---

## 5. E5 — Doctors table (EXISTS)

| Part | Value |
|---|---|
| Method / path | `GET {apiUrl}/profiles/doctors/doctors?Page=1&PageSize=50` |
| Auth | Bearer token |
| Authorization | `Receptionist` |
| Response | `ApiResponse<PagedResult<DoctorTableRowDto>>` |

```json
{
  "isSuccess": true,
  "message": null,
  "errors": [],
  "data": {
    "data": [
      {
        "id": "3f1c2a9e-6b1d-4f0e-9a77-1c2d3e4f5a6b",
        "fullName": "James Andrew Wilson",
        "specialization": "Cardiology",
        "status": "At work",
        "dateOfBirth": "1980-04-12T00:00:00Z",
        "officeAddress": "Main Wing, Room 101"
      }
    ],
    "totalCount": 1
  }
}
```

`PagedResult<T>` serializes as `{ data: T[], totalCount: number }` (property names are case-insensitive on the wire).

The page renders `fullName`, `specialization`, `officeAddress`, `dateOfBirth`, and the editable `status`.

---

## 6. E6 / E7 — Catalogs (EXISTS)

### Offices

| Part | Value |
|---|---|
| Method / path | `GET {apiUrl}/offices/offices?Page=1&PageSize=50` |
| Response item | `{ id, officeNumber, fullAddress, registryPhoneNumber, status }` |

The Office autocomplete label is `fullAddress ?? officeNumber ?? id`. The value sent in `UpdateDoctorDto.officeAddress` is the selected label, matching the create flow.

### Specializations

| Part | Value |
|---|---|
| Method / path | `GET {apiUrl}/services/specialization?Page=1&PageSize=50` |
| Response item | `{ id, name, status }` |

The Specialization autocomplete label is `name`. The value sent in `UpdateDoctorDto.specialization` is the selected name.

Both catalogs must come from the real API. The previous offline fallbacks were removed: a failed catalog request surfaces an error and keeps "Save changes" disabled.

---

## 7. E8 — Photo upload (EXISTS)

| Part | Value |
|---|---|
| Method / path | `POST {apiUrl}/documents/documents` |
| Body | `multipart/form-data` with `file` |
| Response | The stored file id/path (string, or a wrapped `value`/`data`/`id`) |

The page stores the returned id/path and sends it as `photoPath` in E3. If the upload fails, the profile update is not attempted and the user sees a toast error.

---

## 8. Client methods (`src/app/api/`)

The hand-written clients expose exactly these typed operations:

| Client | Method | Operation |
|---|---|---|
| `DoctorService` | `getMyProfile(accountId)` | E1 |
| `DoctorService` | `getDoctor(id, fallbackStatus?)` | E2 (fallback only for the table status path) |
| `DoctorService` | `updateDoctor(id, body)` | E3 |
| `DoctorService` | `getDoctorsForTable(filter)` | E5 |
| `DoctorService` | `createDoctor(body)` | `POST /profiles/doctors` (existing create flow) |
| `DoctorService` | `uploadPhoto(file)` | E8 |
| `DoctorService` | `checkEmailExists(email)` | existing create-flow check |
| `OfficeService` | `getOffices(page, pageSize)` | E6 |
| `SpecializationService` | `getSpecializations(page, pageSize)` | E7 |

Every response is parsed from `unknown` through guards (`readEnvelope`, `asRecord`, `isDoctorStatus`, `toDoctorProfile`, `toDoctorTableRow`). Malformed payloads throw a descriptive `Error` instead of returning partial data.

---

## 9. Error-handling matrix (client-wide)

| HTTP | Global behaviour | Local behaviour |
|---|---|---|
| `400` | `apiErrorInterceptor` extracts messages | Keep Edit mode; show the message; do not clear values |
| `401` | `authErrorInterceptor` clears the session and redirects to `/sign-in` | — |
| `403` | `apiErrorInterceptor` shows an error toast | Revert optimistic status; keep Edit mode |
| `404` | `apiErrorInterceptor` may show a generic message | Profile page shows "Profile not found"; status change rolls back |
| `5xx` / network | `apiErrorInterceptor` shows a neutral message | Keep all values; allow retry; revert optimistic status |

---

## 10. Test seams

| Scenario | Mock | Expected |
|---|---|---|
| Own profile loads | E1 → `DoctorAdminDto` | View mode renders all fields |
| Profile missing | E1 → `404` | "Profile not found" + retry |
| Save success | E3 → `200` | View mode with updated values; success toast |
| Save validation error | E3 → `400` with messages | Edit mode preserved; messages shown |
| Save network failure | E3 → `500` | Edit mode preserved; retry enabled |
| Catalog empty / failed | E6/E7 → error | Edit mode shows a catalog warning; save disabled |
| Status success | E2 + E3 → `200` | New status kept; success toast |
| Status failure | E2/E3 → `500` | Previous status restored; error toast |
| Unauthorized role | Guard | Redirect to `/` |
| Unauthenticated | Guard | Redirect to `/sign-in` |
