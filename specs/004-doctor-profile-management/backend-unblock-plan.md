# Backend Unblock Plan: Doctor Profile Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contract**: [contracts/profile-api.contract.md](./contracts/profile-api.contract.md)

**Status**: Proposal for the backend team. No file under `Backend/` was modified (Constitution: read-only inspection).

This document explains how `ProfilesAPI` is implemented today, why the frontend is blocked at runtime, and the smallest correct backend change that unblocks the AdminApp feature.

---

## 1. How the backend is implemented today

### 1.1 Runtime and build

| Item | Finding |
|---|---|
| Build context | `Backend/ProfilesAPI/` (outer folder) — confirmed by `Backend/Infrastructure/docker-compose.yml` (`PROFILES_API_PATH`) |
| Nested copy | `Backend/ProfilesAPI/ProfilesAPI/` is a second, unused clone with its own `.git`. Do not patch it; patch the outer project |
| Solution | `Backend/ProfilesAPI/ProfilesAPI.slnx` → `Profiles.API`, `Profiles.Application`, `Profiles.Domain`, `Profiles.Infrastructure` |
| Swagger | Live at `http://localhost:5154/swagger/v1/swagger.json`; the Gateway runs on HTTP `http://localhost:5137` |
| Auth | Keycloak JWT; roles are copied from `realm_access.roles` into `ClaimTypes.Role` in `Profiles.API/Extensions/AuthExtensions.cs` |

### 1.2 Doctor data model

`Profiles.Domain/Models/DoctorProfile.cs`:

```csharp
public class DoctorProfile
{
    public Guid Id { get; set; }
    public string? AccountId { get; set; }   // Keycloak sub — currently NULL for all rows
    public string? PhotoPath { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string? MiddleName { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Email { get; set; } = null!;   // unique, enforced at creation
    public string Specialization { get; set; } = null!;
    public int CareerStartYear { get; set; }
    public string OfficeAddress { get; set; } = null!;
    public string Status { get; set; } = "At work";
}
```

Verified in `ProfilesDB.Doctors`: all 14 rows have `AccountId = NULL`, and there is no row for the Keycloak `testdoctor` (`doctor@gmail.com`).

### 1.3 Doctor endpoints (verified against live Swagger)

`Profiles.API/Controllers/DoctorsController.cs` (`api/Doctors`):

| Verb / path | Roles | Returns | Notes |
|---|---|---|---|
| `POST /api/Doctors` | `Receptionist` | `ApiResponse<Guid>` | Creates profile, publishes `IDoctorCreatedEvent`, logs credentials |
| `GET /api/Doctors` | `Patient, Receptionist` | `PagedResult<DoctorCardDto>` | Filters `Status == "At work"` |
| `GET /api/Doctors/{id}` | `Patient, Doctor` | `DoctorDetailsDto` | **No `Id`, no `Status`**; not available to Receptionist |
| `GET /api/Doctors/doctors` | `Receptionist` | `PagedResult<DoctorTableRowDto>` | Includes `Id` and `Status` |
| `PUT /api/Doctors/{id}` | `Doctor, Receptionist` | `ApiResponse` | Requires full `UpdateDoctorDto`; no ownership check |

### 1.4 Existing but unexposed service method

`Profiles.Application/Services/DoctorService.cs` already contains:

```csharp
public async Task<Result<DoctorAdminDto>> GetDoctorProfileForAdminAsync(Guid id)
{
    var doctor = await _doctorRepository.GetByIdAsync(id);
    if (doctor == null) return DoctorErrors.NotFound;
    return Result<DoctorAdminDto>.Success(doctor.ToAdminViewResponse());
}
```

`DoctorAdminDto` carries `Status` but **not `Id`**. No controller action calls this method.

### 1.5 Account linking

- `DoctorService.CreateDoctorAsync` creates the profile and publishes `IDoctorCreatedEvent`.
- The only consumer is `AppointmentsAPI` (`DoctorCreatedConsumer`), which syncs an appointment-side copy.
- **Nothing writes `DoctorProfile.AccountId`.** `TempEmailService` only prints credentials; there is no Keycloak account-creation code in this repository.
- `PatientsController` links accounts explicitly (`POST /api/Patients/{profileId}/link`), but no equivalent exists for doctors.

**Consequence**: `GET /api/Doctors/account/{accountId}` returns `404` for every doctor until `AccountId` is populated.

### 1.6 Gateway

`Backend/GatewayAPI/ocelot.json`, route `/profiles/{everything}`:

```json
"UpstreamHttpMethod": [ "Get", "Post", "Put", "Delete", "Options" ]
```

`PATCH` is missing, but the agreed design does not need it: status changes use the existing `PUT`.

### 1.7 Swagger response schemas and the frontend client

Controller actions return `IActionResult` and have no `[ProducesResponseType]` attributes, so the live Swagger has no response schemas. There is **no OpenAPI generator** configured in `AdminApp`.

Agreed frontend approach: the clients in `src/app/api/` are hand-written and strictly typed (`unknown` + runtime guards, zero `any`). No code generation is required for this feature. Typed Swagger responses remain a nice-to-have for future tooling.

---

## 2. Root causes

| ID | Root cause | Blocks |
|---|---|---|
| **B1** | No doctor self-lookup endpoint; `AccountId` is never populated, so a lookup by `sub` cannot work | US1 (Doctor), US2 |
| **B2** | `GET /api/Doctors/{id}` is `Patient, Doctor` only and returns `DoctorDetailsDto` without `Id`/`Status`; `GetDoctorProfileForAdminAsync` is not exposed | US1 (Receptionist), US3 |
| **B3** | `PUT` needs the full payload, and the table row cannot supply it | US3 (solved by B2: read the full profile first) |
| **B4** | No OpenAPI generation pipeline | Not blocking — the hand-written typed client replaces it |

---

## 3. Proposed solution

### S1 — `GET /api/Doctors/account/{accountId}` + account linking (fixes B1)

**`Profiles.API/Controllers/DoctorsController.cs`** — add:

```csharp
[HttpGet("account/{accountId}")]
[Authorize(Roles = "Doctor")]
[ProducesResponseType(typeof(ApiResponse<DoctorAdminDto>), StatusCodes.Status200OK)]
public async Task<IActionResult> GetDoctorByAccount(string accountId)
{
    var result = await _doctorService.GetDoctorProfileByAccountAsync(accountId);
    return HandleResult(result);
}
```

**`Profiles.Application/Abstractions/IDoctorService.cs`** — add:

```csharp
Task<Result<DoctorAdminDto>> GetDoctorProfileByAccountAsync(string accountId);
```

**`Profiles.Application/Services/DoctorService.cs`** — add:

```csharp
public async Task<Result<DoctorAdminDto>> GetDoctorProfileByAccountAsync(string accountId)
{
    if (string.IsNullOrWhiteSpace(accountId))
        return DoctorErrors.NotFound;

    var doctor = await _doctorRepository
        .Query()
        .FirstOrDefaultAsync(d => d.AccountId == accountId);

    if (doctor is null)
        return DoctorErrors.NotFound;

    return Result<DoctorAdminDto>.Success(doctor.ToAdminViewResponse());
}
```

**Linking (required)**: set `AccountId = sub` when the doctor's Keycloak account is created or first associated, and backfill existing rows. Two workable options:

1. **Preferred** — the account-provisioning flow that creates the Keycloak user writes the returned `sub` into `DoctorProfile.AccountId`.
2. **Operational fallback** — one-off backfill by e-mail:

```sql
UPDATE Doctors
SET AccountId = '<keycloak-sub>'
WHERE Email = '<doctor-email>' AND AccountId IS NULL;
```

For the local stack, `testdoctor` has `sub = 61dd60ed-e624-4ddd-804c-92d659e75eb9` and `email = doctor@gmail.com`, and there is currently **no matching `Doctors` row**. Create/link one before end-to-end testing.

**Why not `/me`**: the agreed decision is to use the identity already available in `AuthService` (`sub`) and a plain account path. No token-derived endpoint is added.

### S2 — Widen `GET /api/Doctors/{id}` for Receptionists (fixes B2, unblocks B3)

**`Profiles.Application/DTOs/DoctorAdminDto.cs`** — add `Guid Id` as the first member:

```csharp
public sealed record DoctorAdminDto(
    Guid Id,
    string? PhotoPath,
    string FirstName,
    string LastName,
    string? MiddleName,
    DateTime DateOfBirth,
    string Specialization,
    string OfficeAddress,
    int CareerStartYear,
    string Status
);
```

`DoctorMapper.ToAdminViewResponse` (Mapperly) maps `Id` automatically; no mapper change is needed.

**`Profiles.API/Controllers/DoctorsController.cs`** — widen the existing action:

```csharp
[HttpGet("{id:guid}")]
[Authorize(Roles = "Patient, Doctor, Receptionist")]
[ProducesResponseType(typeof(ApiResponse<DoctorAdminDto>), StatusCodes.Status200OK)]
public async Task<IActionResult> GetDoctorById(Guid id)
{
    var result = await _doctorService.GetDoctorProfileForAdminAsync(id);
    return HandleResult(result);
}
```

Returning `DoctorAdminDto` gives the client `id` and `status`, which the profile page and the status change both need. If `Patient` must keep the narrower `DoctorDetailsDto`, add a separate Receptionist route; the frontend is written against the widened path because that is the agreed contract.

### S3 — Status change via E2 + E3 (fixes B3, no extra endpoint)

The client:

1. reads the full profile through the widened `GET /api/Doctors/{id}`;
2. replaces only `status`;
3. sends the complete `UpdateDoctorDto` through the existing `PUT /api/Doctors/{id}`.

No `PATCH`, no `UpdateDoctorStatusDto`, no Gateway route change. This preserves every other field and avoids the data corruption risk of reconstructing names from `fullName`.

### S4 — Typed Swagger responses (optional, not blocking)

Adding `[ProducesResponseType(typeof(ApiResponse<DoctorAdminDto>), 200)]` to the doctor actions makes future tooling easier and documents the contract. The current hand-written client does not depend on it.

### S5 — Ownership enforcement for `PUT` (FR-026)

Today any `Doctor` can `PUT /api/Doctors/{any-id}`. Add an ownership check when the caller has the `Doctor` role:

- In `DoctorService.UpdateDoctorAsync`, accept the caller identity (or inject `IHttpContextAccessor`, already registered in `Profiles.Infrastructure`).
- If the role is `Doctor`, require `doctor.AccountId == sub`; otherwise return `DoctorErrors.Forbidden` (`ErrorType.Forbidden`).

This is not a UI blocker (the UI only exposes the own profile), but it closes a real vulnerability and satisfies FR-026.

---

## 4. Unblock sequence

```text
1. Backend: apply S1 + S2 (and S5 for ownership) to Backend/ProfilesAPI (outer project).
2. Backend: link/backfill DoctorProfile.AccountId for existing doctors.
3. Backend: rebuild and start ProfilesAPI + Gateway.
4. Verify Swagger exposes:
     GET /api/Doctors/account/{accountId}
     GET /api/Doctors/{id}          (roles include Receptionist)
     PUT /api/Doctors/{id}          (unchanged)
5. Frontend: no client regeneration; the typed client is already implemented.
6. Frontend: run the quickstart scenarios end to end.
```

### Verification commands

```powershell
# Endpoint presence
$s = Invoke-RestMethod http://localhost:5154/swagger/v1/swagger.json
$s.paths.PSObject.Properties.Name | Select-String 'account'

# Gateway reachability (expect 401 without a token, not 404)
try {
  Invoke-WebRequest http://localhost:5137/profiles/doctors/account/00000000-0000-0000-0000-000000000000 -UseBasicParsing
} catch { $_.Exception.Response.StatusCode.value__ }
```

---

## 5. Alternatives considered

| Alternative | Why rejected |
|---|---|
| `GET /me` derived from the token | Agreed against: the signed-in identity is already available in `AuthService`; use `sub` explicitly |
| Frontend-only: read own profile via `GET /api/Doctors/{id}` | Requires the profile GUID; the token carries only `sub`/e-mail, and `AccountId` is null. No safe way to obtain the id |
| Frontend-only: resolve profile through `GET /api/Doctors?SearchName=email` | Route is `Patient, Receptionist` only; a Doctor gets `403` |
| Receptionist reads via `GET /api/Doctors/doctors` only | `DoctorTableRowDto` lacks split names, `photoPath`, and `careerStartYear`, so the profile cannot be rendered or saved |
| Status change from the table row directly | Requires the full `UpdateDoctorDto`; reconstructing names from `fullName` would corrupt data |
| `PATCH /api/Doctors/{id}/status` | Agreed against: use the existing `PUT` after reading the full profile |
| Keep offline catalog fallbacks | Fabricated specializations/offices would be written to real profiles; removed |

---

## 6. Risks and notes

| Risk | Mitigation |
|---|---|
| Existing doctors have `AccountId = null` | Backfill by e-mail, or write `sub` during account provisioning |
| Keycloak e-mail differs from `DoctorProfile.Email` | `AccountId` is the key; e-mail is only used for the one-off backfill |
| `testdoctor` has no matching `Doctors` row | Create or link a profile for `doctor@gmail.com` before end-to-end testing |
| Widening `GET /{id}` exposes `status` to `Patient` | Accepted by the agreed contract; add a separate route if that becomes a concern |
| Any Doctor can `PUT` another profile | S5 ownership check |
| `GET /api/Patients/account/{accountId}` has no `[Authorize]` | Unrelated security gap found during inspection; recommend fixing separately |

---

## 7. Frontend status

| Work | Status |
|---|---|
| `@angular/cdk` + overlay CSS (T001) | Done |
| `DOCTOR_STATUSES` + `isDoctorStatus` (T002) | Done |
| Profile view/form models + mappers (T003) | Done |
| `catalogMatchValidator` (T004) | Done |
| Typed hand-written API client (T005 replacement) | Done |
| `roleGuard` (T006) | Done |
| `AutocompleteComponent` (T007) | Done |
| Profile view/edit components (T008–T009) | Done |
| `CancelEditDialogComponent` (T010) | Done |
| Profile page, routes, header, Doctors status column (T011–T026) | Done |
| End-to-end runtime | Waiting on S1 + S2 + account linking |

---

## 8. Compromise applied: current endpoints only

To unblock the Receptionist flows without adding endpoints or rebuilding the backend:

1. **Role widening in Keycloak (dev environment only).** The `Patient` realm role was added to
   `testreceptionist`, so the existing `GET /api/Doctors/{id}` (`[Authorize(Roles = "Patient, Doctor")]`)
   now returns `200` for that user. Revert by removing `Patient` from the user's realm role mappings.
   This is environment state, not code: the correct long-term fix is still S2.
2. **Status fallback in the client.** `DoctorDetailsDto` has no `status`, so
   `DoctorService.getDoctorStatus(id)` reads it from `GET /api/Doctors/doctors` (first 500 rows) and
   `ProfilePageComponent` passes it as `fallbackStatus` to `getDoctor`. The Doctors table already
   passes the row status, so it needs no lookup.
3. **Re-login is required** after the role change, otherwise the access token still lacks `Patient`.

Limits of this compromise:

- **Doctor self-profile (`/profile`) still cannot work.** The token carries `sub` but no profile id,
  and no current endpoint maps `sub` → profile. S1 (`GET /api/Doctors/account/{accountId}` plus
  `AccountId` linking) remains required.
- `getDoctorStatus` returns `null` when the doctor is outside the first 500 table rows, and the
  profile page then reports a contract error instead of rendering.
- The `Patient` role is broader than the receptionist needs; it is acceptable only in the local
  environment.

