# Contract: Appointments API Client

**Feature**: `006-appointment-management` | **Date**: 2026-11-15

This contract defines what the **generated** Angular client must expose. It is derived from read-only inspection of `Backend/AppointmentsAPI` and the Gateway route table. No hand-written HTTP service is permitted.

## 1. Gateway mapping

`Backend/GatewayAPI/ocelot.json`:

| Upstream | Downstream | Swagger |
|---|---|---|
| `/appointments/{everything}` | `http://appointments-api:8080/api/{everything}` | `http://appointments-api:8080/swagger/v1/swagger.json` |

The overlay script strips the downstream `/api` prefix, and the generated `ApiConfiguration.rootUrl` is `${environment.apiUrl}/appointments`.

```ts
// AdminApp/src/app/api/appointments-api.provider.ts
export function provideAppointmentsApiConfiguration(): Provider {
  return provideApiConfiguration(`${environment.apiUrl}/appointments`);
}
```

## 2. Operations used by this feature

All paths are relative to the generated root URL.

| Operation | Method + path | Request | Success response | Used by |
|---|---|---|---|---|
| List appointments | `GET /Appointments/receptionist` | `GetAppointmentsFilterDto` in query | `200 ApiResponseOfIEnumerableOfViewAppointmentListDto` | US 2 |
| Create appointment | `POST /Appointments/{patientId}` | `CreateAppointmentDto` body; `patientId` in path | `200 ApiResponse` | US 1 |
| Approve appointment | `PATCH /Appointments/{id}/approve` | none | `200 ApiResponse` | US 3 |
| Delete appointment | `DELETE /Appointments/{id}` | none | `200 ApiResponse` | US 4 |
| Available slots | `GET /Schedule/available-time-slots` | `doctorId`, `serviceId`, `date` (query) | `200 ApiResponseOfIEnumerableOfString` (`HH:mm`) | US 1 |
| Active doctors | `GET /Doctors` | none | `200 ApiResponseOfIEnumerableOfDoctor` | catalog fallback only |
| Active offices | `GET /Offices` | none | `200 ApiResponseOfIEnumerableOfOffice` | US 1–2 |
| Active services | `GET /Services` | none | `200 ApiResponseOfIEnumerableOfService` | cross-check only |
| Active specializations | `GET /Specializations` | none | `200 ApiResponseOfIEnumerableOfSpecialization` | cross-check only |

### DTO shapes (verified)

```ts
// POST body for creation; the patient id is a path parameter.
interface CreateAppointmentDto {
  doctorId: string;    // guid
  serviceId: string;   // guid
  officeId: string;    // guid
  date: string;        // date-time
  timeSlot: string;    // date-time; seconds are normalized server-side
}

// Query for the list.
interface GetAppointmentsFilterDto {
  date?: string | null;        // date-time
  doctorName?: string | null;  // substring over first OR last name
  serviceName?: string | null; // substring over the service name
  isApproved?: boolean | null; // omit for "All"
  officeId?: string | null;    // guid
}

// One list row.
interface ViewAppointmentListDto {
  id: string;
  startTime: string;          // ISO date-time
  endTime: string;            // ISO date-time
  doctorFullName: string;     // "Surname Name Middle"
  patientFullName: string;    // "Surname Name Middle"
  patientPhoneNumber: string;
  serviceName: string;
  isApproved: boolean;
}

interface Doctor {           // appointments read model — NOT authoritative for status/office
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  specialization: string;
  status: number;            // Status enum: 0 Active, 1 Inactive
}

interface Office { id: string; status: number; address: string; }
interface Service { id: string; name: string; status: number; category: number; }
interface Specialization { id: string; name: string; status: number; }
```

## 3. Profiles and Services clients required by the cascade

| Operation | Method + path (upstream) | Why |
|---|---|---|
| Doctor catalog | `GET /profiles/doctors/doctors?Page=1&PageSize=200` | `DoctorTableRowDto` carries `specialization`, `officeAddress`, `status` — the only source for "At work" and doctor→office (P-3) |
| Patient search | `GET /profiles/patients?search=&page=&pageSize=` **(does not exist yet — P-2)** | Patient combobox and "Invalid patient name" |
| Specialization list | `GET /services/specialization?Page=1&PageSize=100` | Specialization catalog |
| Specialization detail | `GET /services/specialization/{id}` | `services[]` with `status` — specialization↔service mapping (P-5) |
| Office catalog | `GET /appointments/Offices` | Active offices with ids that match `OfficeId` on create/list |

The profiles client is generated from its own swagger (`SwaggerKey: profiles`); the services client already exists. Patient search is the only operation with no backend implementation.

## 4. Envelope and error contract

Every listed endpoint returns:

```json
{ "isSuccess": true, "message": "...", "errors": [], "data": {} }
```

Failure statuses emitted by `AppointmentsController` / `ApiController.HandleFailure`:

| Status | Meaning | Feature behavior |
|---|---|---|
| `400` + "The selected time slot is invalid." | Slot taken or malformed | Keep modal open, return to slot selection, message above the slots, reload slots |
| `400` + "Validation falure" | DTO validation | Keep modal open, show joined `errors[]` |
| `403` + "Your patient account is not active." | Inactive patient | Keep modal open, clear patient field, message |
| `404` | Doctor/office/service/patient/appointment not found | Keep state, notification, offer retry/reload |
| `409` | Doctor/office/service inactive, or already approved | Notification with the server message; refresh catalogs or the list |
| `401` / `403` (auth) | Session/role | Handled by existing `auth-error.interceptor`; feature shows nothing extra |

`readApiEnvelope` throws `ApiContractError` for a payload whose `isSuccess`/`data` shape is unexpected; the feature maps it to a generic error notification and logs the raw payload at `warn` level (no PII beyond what the server already returned).

## 5. Generation checklist (P-1)

- [ ] `AdminApp/scripts/augment-appointments-openapi.mjs` — download from `http://localhost:<gateway>/appointments/swagger/v1/swagger.json` (or a local file), add `ApiResponse` / `ApiResponseOf…` envelope schemas, name `Status` and `ServiceCategory` enum values, strip `/api` from paths, write `openapi/appointments.openapi.json`.
- [ ] `AdminApp/ng-openapi-gen.appointments.json` — `input: openapi/appointments.openapi.json`, `output: src/app/api/generated/appointments`, same options as the services config.
- [ ] `package.json` script `api:appointments` (mirroring `api:services`).
- [ ] `provideAppointmentsApiConfiguration()` registered in `app.config.ts`.
- [ ] Generated models reviewed: `CreateAppointmentDto`, `GetAppointmentsFilterDto`, `ViewAppointmentListDto`, `Doctor`, `Office`, `Service`, `Specialization`, `ApiResponse`, `ApiResponseOf...`.
- [ ] `npm run build` passes with the generated client; no manual edits inside `src/app/api/generated/**`.

Do not start implementation of list/create/approve/cancel tasks until this checklist is complete.
