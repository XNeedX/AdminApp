# API Contract: Receptionist Management

**Feature**: `009-receptionist-management`
**Plan**: [plan.md](../plan.md)
**Transport rule**: All calls go through generated OpenAPI clients. No `HttpClient` usage, DTOs, or endpoint URLs are hand-written in feature code.

## Generated Clients

| Client | Source API | Gateway base | Used for |
|--------|------------|--------------|----------|
| `ReceptionistsService` | Profiles API | `${environment.apiUrl}/profiles` | List, read, create, update, delete |
| `OfficesService` | Appointments API | `${environment.apiUrl}/appointments` | Office dropdown |
| Generated Documents client (new) | Documents API | `${environment.apiUrl}/documents` | Photo upload/delete |

## Receptionists Endpoints

Paths below are what the generated client calls after the gateway path rewrite. The generated service exposes `ReceptionistsGetPath`, `ReceptionistsPostPath`, `ReceptionistsIdGetPath`, `ReceptionistsIdPutPath`, `ReceptionistsIdDeletePath`.

### `GET /Receptionists?page&pageSize`

**Authorization**: `Receptionist` role (enforced by the backend; the route is also guarded).

**Query parameters**

| Name | Type | Required | Default |
|------|------|----------|---------|
| `page` | integer | no | 1 |
| `pageSize` | integer | no | backend default; the app sends 100 |

**Response 200** — envelope:

```json
{
  "isSuccess": true,
  "message": null,
  "errors": [],
  "data": {
    "data": [
      {
        "id": "00000000-0000-0000-0000-000000000000",
        "photoPath": "string-or-null",
        "firstName": "string",
        "lastName": "string",
        "middleName": "string-or-null",
        "officeAddress": "string"
      }
    ],
    "totalCount": 0
  }
}
```

**Contract note (CG-1, blocking)**: `id` is **not** returned by the current backend `ReceptionistProfileDto`. It is required for row identity, profile navigation, and deletion. The Profiles API DTO must expose it, after which `npm run api:profiles` regenerates the client.

**Client validation**: `readApiEnvelope(payload, isPagedReceptionistRows)`. If `isSuccess !== true`, the envelope message is thrown as `ApiContractError` and rendered as a load error.

### `GET /Receptionists/{id}`

**Response 200** — `ApiResponse<ReceptionistProfileDTO>` with the same profile fields.

**Errors**
- `404`: profile not found → "Receptionist not found." with a back action.
- `401/403`: handled by the global auth interceptors.

### `POST /Receptionists`

**Request body** (`CreateReceptionistRequest`)

```json
{
  "photoPath": "string-or-null",
  "firstName": "string",
  "lastName": "string",
  "middleName": "string-or-null",
  "email": "string",
  "officeAddress": "string"
}
```

**Response 200** — `ApiResponse<Guid>`; the returned id is the new profile id.

**Errors**
- `400`: FluentValidation failures with exact messages:
  - "Please, enter the first name"
  - "Please, enter the last name"
  - "Please, enter the email"
  - "You've entered an invalid email"
  - "Please, choose the office"
- `409`: "User with this email already exists." → email control `emailTaken` error.
- `500`: credentials email delivery or persistence failure; keep the form values and refresh the directory to reveal a possibly created profile.

**Side effects**: account creation, generated password, credentials email (backend-owned; the password is never returned).

### `PUT /Receptionists/{id}`

**Request body** (`UpdateReceptionistDto`): `photoPath`, `firstName`, `lastName`, `middleName`, `officeAddress`. Email is omitted because it is create-only.

**Response 200** — `ApiResponse` acknowledgment.

**Errors**: `400` with name/office messages, `404` not found, `409` if the backend rejects a duplicate (not expected because email is not sent).

### `DELETE /Receptionists/{id}`

**Response 200** — `ApiResponse` acknowledgment.

**Errors**: `404` not found.

**Side effects**: deletes profile, account, and published sync events; the frontend follows with best-effort photo deletion.

## Office Catalog Contract

`OfficesService.officesGet()` returns `ApiResponse<IEnumerable<Office>>`.

The feature requires each item to expose:
- `id: string` — required by the catalog guard.
- `address: string | null` — used as the dropdown label and as the stored `officeAddress`; falls back to `id` when absent.

The shared `isOfficeList` guard from the doctors feature is **not** imported; the receptionist feature keeps a local guard to preserve feature independence.

## Documents Contract (Photo)

**Current state (CG-3)**: the backend exposes the endpoints, but no generated client exists in AdminApp. A generated client must be added before photo persistence is enabled.

| Operation | Backend endpoint | Generated method (after regeneration) | Response |
|-----------|------------------|----------------------------------------|----------|
| Upload | `POST /api/Documents` (multipart `file`) | Generated upload call with the file body | `ApiResponse<Guid>`; the id is stored in `photoPath` |
| Download | `GET /api/Documents/{id}` | Not required in code | Image bytes, rendered via the Gateway URL |
| Delete | `DELETE /api/Documents/{id}` | Generated delete call | `ApiResponse` acknowledgment |

**Display URL**: `${environment.apiUrl}/documents/Documents/${photoPath}`. This is a presentation URL, not an API call wrapper.

**Local rules**: JPEG/PNG/WebP, max 5 MB, one file. The local preview uses `URL.createObjectURL(file)` and is revoked on replace/destroy.

## Required OpenAPI Overlay Changes

`AdminApp/scripts/augment-profiles-openapi.mjs` must add:

```text
ReceptionistProfileDTO
  id            uuid            required
  photoPath     string|null
  firstName     string
  lastName      string
  middleName    string|null
  officeAddress string

PagedResultOfReceptionistProfileDTO
  data          ReceptionistProfileDTO[]
  totalCount    int32

ApiResponseOfReceptionistProfileDTO
ApiResponseOfPagedResultOfReceptionistProfileDTO
ApiResponseOfGuid (already present)
```

and rewrite the responses of:
- `GET /api/Receptionists` → `ApiResponseOfPagedResultOfReceptionistProfileDTO`
- `POST /api/Receptionists` → `ApiResponseOfGuid`
- `GET /api/Receptionists/{id}` → `ApiResponseOfReceptionistProfileDTO`
- `PUT /api/Receptionists/{id}` → `ApiResponse`
- `DELETE /api/Receptionists/{id}` → `ApiResponse`

Then run `npm run api:profiles`.

A new `scripts/augment-documents-openapi.mjs` + `ng-openapi-gen.documents.json` must add `ApiResponseOfGuid` for upload and `ApiResponse` for delete/acknowledgments, rewrite `/api/Documents` paths to `/Documents`, and generate into `src/app/api/generated/documents`.

## Error Handling Contract

| Status | Where | Behavior |
|--------|-------|----------|
| 400 | Form submit | Map validation errors to fields where identifiable; otherwise show the envelope message in the form alert |
| 401 | Any call | Existing `authErrorInterceptor` clears the session and redirects to sign-in |
| 403 | Any call | Existing interceptor surfaces the error; the route guard prevents normal access |
| 404 | Profile load/delete | Inline "Receptionist not found." for the profile; toast and row refresh for delete |
| 409 | Create | `emailTaken` on the email control with exact copy |
| 500 | Any call | Toast/form error with `extractErrorMessage`; values preserved; user can retry |
| Malformed envelope | Any call | `ApiContractError`; rendered as a page/form error, never as partial data |
