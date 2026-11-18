# Contract: Services API (consumed by AdminApp)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

**Verified against**: `http://localhost:5095/swagger/v1/swagger.json` and the Services API source (read-only inspection) on 2026-11-12.

---

## 1. Transport

| Item | Value |
|---|---|
| Gateway base URL | `http://localhost:5137` (`environment.apiUrl`) |
| Gateway route | `/services/{everything}` → downstream `/api/{everything}` |
| Generated client base path | `${environment.apiUrl}/services` |
| Auth | Bearer token from `AuthService`, added by the existing `authInterceptor` |
| Roles | All Service endpoints require `Receptionist` |
| Envelope | `{ isSuccess: boolean, message: string \| null, errors: string[], data: T \| null }` |

The Gateway route for `/services` already allows `Get, Post, Put, Patch, Delete, Options`, so no Gateway change is required.

---

## 2. Operations

### 2.1 Create service

| | |
|---|---|
| Method / path | `POST /api/Service` |
| Body | `CreateServiceCommand` |
| Success | `201 Created` with `ApiResponse<Guid>` — `data` is the new service id |
| Failure | `400` validation envelope; `403` for a non-Receptionist |

Request model:

```ts
interface CreateServiceCommand {
  name: string;
  price: number;                 // double
  status: number;                // 0 = Active, 1 = Inactive
  category: number;              // 0 = Analyses, 1 = Consultations, 2 = Diagnostics
  specializationId: string;      // uuid
}
```

### 2.2 Read service

| | |
|---|---|
| Method / path | `GET /api/Service/{id}` |
| Success | `200` with `ApiResponse<ViewServiceDTO>` |
| Failure | `404` when the service does not exist; `403` for a non-Receptionist |

Response model (from the application DTO; not yet in Swagger — see §5):

```ts
interface ViewServiceDTO {
  id: string;                    // uuid
  name: string;
  price: number;                 // decimal
  category: number;              // 0..2
  status: number;                // 0..1
  specializationId: string;      // uuid
}
```

### 2.3 Update service

| | |
|---|---|
| Method / path | `PUT /api/Service/{id}` |
| Body | `EditServiceDTO` |
| Success | `204 No Content` |
| Failure | `400` validation envelope; `404`; `403` |

```ts
interface EditServiceDTO {
  name: string;
  price: number;
  category: number;
  status: number;
}
```

### 2.4 Change service status

| | |
|---|---|
| Method / path | `PATCH /api/Service/{id}/status` |
| Body | `EditStatusDTO` |
| Success | `204 No Content` |
| Failure | `400`; `404`; `403` |

```ts
interface EditStatusDTO {
  status: number;                // 0 = Active, 1 = Inactive
}
```

This is the operation used for the immediate status change in View mode (User Story 4).

---

## 3. Validation contract

The backend validator (`CreateServiceCommandValidator` / `EditServiceCommandValidator`) returns `400` with `errors: string[]`:

| Rule | Message |
|---|---|
| Name empty | "Please, enter the name" |
| Price empty | "Please, enter the price" |
| Price `<= 0` | "You've entered an invalid price" |
| Category not in enum | "Please, choose the service category" |
| Status not in enum | "Invalid status" |
| Specialization id empty | "Specialization ID is required" |

These messages match the spec, so the UI can display backend messages as-is if a request is rejected.

---

## 4. Enum mapping

The API serializes enums as integers (no `JsonStringEnumConverter`).

| `Category` | Value | `Status` | Value |
|---|---|---|---|
| `Analyses` | `0` | `Active` | `0` |
| `Consultations` | `1` | `Inactive` | `1` |
| `Diagnostics` | `2` | | |

The generated client will expose these as numeric enums or numeric unions. The UI maps them at the boundary (see [data-model.md](../data-model.md) §3).

---

## 5. Contract gaps and prerequisites

**Verification (task T001, 2026-11-12)**: re-checked the live definition at `http://localhost:5095/swagger/v1/swagger.json`. Confirmed:

- `GET /api/Service/{id}` declares `200 OK` with **no** content schema.
- `POST /api/Service` declares `200 OK` with **no** content schema (runtime returns `201` with `ApiResponse<Guid>`).
- `PUT /api/Service/{id}` and `PATCH /api/Service/{id}/status` declare `200 OK` (runtime returns `204`).
- `Category` and `Status` are integer enums without names.

These gaps are owned by the backend team. Per Constitution Principle II ("Missing Contract Protocol"), API-dependent implementation should not start until they are resolved.

**Interim bridge (tasks T002–T004, extended for the `/services` page)**: `AdminApp/scripts/augment-services-openapi.mjs` downloads the live definition and writes `AdminApp/openapi/services.openapi.json` with the response schemas above, the `x-enumNames` labels, the Specialization read models used by the `/services` tab (`ViewSpecializationListDTO`, `PagedResultOfViewSpecializationListDTO`, `ViewSpecializationServiceDTO`, `ViewSpecializationDTO` + envelopes), and Gateway-shaped paths (`/api/*` → `/*`). `ng-openapi-gen` generates the typed client from that overlay. The overlay is a temporary spec augmentation, not a hand-written HTTP client; task T037 removes it once G1–G3 are closed.

**Status after implementation (T040, 2026-11-12)**:

| # | Status | Notes |
|---|---|---|
| G1 | **Open** | Backend still returns `IActionResult` without `[ProducesResponseType]`; bridged by the overlay. |
| G2 | **Open** | Enums still serialize as integers; labels are restored through `x-enumNames` in the overlay and `service.model.ts` mappers. |
| G3 | **Open** | `POST` still documents `200` while returning `201`; the overlay documents `201`. |
| G4 | **Closed** | `ng-openapi-gen` 1.1.0 + `ng-openapi-gen.json` + `npm run api:services` generate `src/app/api/generated/services/`. |
| G5 | **Open (optional)** | Backend validators do not enforce name length or price precision; the UI enforces both. |

T037 stays open while G1–G3 remain. UI-only tasks are complete; the generated client is typed through the overlay and the build/tests are green.

**Re-verification (2026-11-15)**: the first attempt found `http://localhost:5095/swagger/v1/swagger.json` unreachable. In a follow-up check the API was up and the gaps were re-confirmed **still open**: `GET /api/Service/{id}`, `POST /api/Service`, `PUT`, `PATCH` and both Specialization reads still declare responses without content schemas; `Status`/`Category` are still integer enums without `x-enumNames`; `POST` still documents `200` while returning `201`. The overlay therefore stays in place and T037 remains open.

| # | Gap | Impact | Required change |
|---|---|---|---|
| G1 | Service actions return `IActionResult` with no `[ProducesResponseType]`, so Swagger has no response schemas | The generated client cannot type `ViewServiceDTO`, `ApiResponse<Guid>`, or the validation envelope | Add `[ProducesResponseType(typeof(ApiResponse<ViewServiceDTO>), 200)]`, `[ProducesResponseType(typeof(ApiResponse<Guid>), 201)]`, and the `400/404` variants |
| G2 | `Category`/`Status` are bare integer enums without names | Generated types lose the business labels; mapping is manual | Add `JsonStringEnumConverter` (preferred) or `x-enumNames`/XML docs so names survive generation |
| G3 | `POST` returns `201` at runtime but Swagger documents `200` | Generated client may treat the response incorrectly | Document `201` explicitly |
| G4 | No OpenAPI generator is configured in `AdminApp` | No generated client exists to consume | Add `ng-openapi-gen` + a generation script (see [plan.md](../plan.md) Phase 1) |
| G5 | No maximum name length or price precision rule in the backend validators | UI-only limits may be bypassed by other clients | Optional: mirror `maxLength(100)` and 2-decimal precision in the backend validator |

G1–G3 remain owned by the backend team. The AdminApp implementation is complete against the overlay bridge; once the backend closes G1–G3, run task T037 to regenerate the client from the live definition and drop the overlay.

---

## 6. Generated client conventions

- Generator: `ng-openapi-gen` 1.1.0 (dev dependency, run via `npm run api:services`).
- Input: `openapi/services.openapi.json`, produced by `scripts/augment-services-openapi.mjs` from the live Services API definition (or from the Gateway aggregate once it exposes the Services definition).
- Output: `src/app/api/generated/services/`.
- Config: `ng-openapi-gen.json` — `enumStyle: "pascal"`, `services: true`, `promises: false` (RxJS Observables), `module: false`, `indexFile: true`.
- Base path: `provideServicesApi()` in `src/app/api/services-api.provider.ts` sets `ApiConfiguration.rootUrl` to `${environment.apiUrl}/services`.
- Generated artifacts (task T004): `ServiceService` with
  - `servicePost({ body: CreateServiceCommand }): Observable<ApiResponseOfGuid>`
  - `serviceIdGet({ id }): Observable<ApiResponseOfViewServiceDto>`
  - `serviceIdPut({ id, body: EditServiceDto }): Observable<void>`
  - `serviceIdStatusPatch({ id, body: EditStatusDto }): Observable<void>`
- Generated model names: `ViewServiceDto`, `CreateServiceCommand`, `EditServiceDto`, `EditStatusDto`, `ApiResponseOfGuid`, `ApiResponseOfViewServiceDto`, `ApiResponse`, `Category`, `Status`, plus the Specialization read models `ViewSpecializationListDto`, `PagedResultOfViewSpecializationListDto`, `ViewSpecializationServiceDto`, `ViewSpecializationDto` and their `ApiResponseOf*` envelopes. Every generated field is optional, so mappers validate before building the UI models.
- Specialization operations used by the `/services` page (task T023/T028): `SpecializationService`
  - `specializationGet({ Page, PageSize }): Observable<ApiResponseOfPagedResultOfViewSpecializationListDto>`
  - `specializationIdGet({ id }): Observable<ApiResponseOfViewSpecializationDto>`
  - The live definition also yields `specializationPost`, `specializationIdPut` and `specializationIdStatusPatch`; AdminApp does not use them and they stay `void` because those actions have no response schema (gap G1).
- The generated `ServiceService` is injected by `ServiceInfoComponent` and `ServiceCreateDialogComponent`; `ServicesPageComponent` injects the generated `SpecializationService`. No feature-level HTTP wrapper is written.
- The generated models are used only inside `features/services/models/service.model.ts`; components use the UI models from [data-model.md](../data-model.md).
