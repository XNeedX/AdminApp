# Data Model: Appointment Management

**Feature**: `006-appointment-management` | **Date**: 2026-11-15 | **Plan**: [plan.md](./plan.md)

All types are TypeScript interfaces/type aliases used by the AdminApp. They intentionally avoid `any`, `I` prefixes, and duplication of generated API models: generated DTOs are narrowed into these view models at the feature boundary.

## 1. Catalogs

```ts
/** A patient selectable for a new appointment. */
export interface PatientOption {
  readonly id: string;
  readonly fullName: string;      // "Surname Name Middle"
  readonly phoneNumber: string;
}

/** An active medical specialization. */
export interface SpecializationOption {
  readonly id: string;
  readonly name: string;
}

/** An active service, linked to exactly one specialization. */
export interface ServiceOption {
  readonly id: string;
  readonly name: string;
  readonly specializationId: string;
}

/** An active doctor, derived from the ProfilesAPI receptionist table. */
export interface DoctorOption {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly middleName: string | null;
  readonly fullName: string;            // "Surname Name Middle"
  readonly specializationId: string;
  readonly specializationName: string;
  readonly officeId: string | null;     // resolved from officeAddress
  readonly officeAddress: string | null;
  readonly status: DoctorStatus;        // only "At work" entries are kept
}

/** An active office. */
export interface OfficeOption {
  readonly id: string;
  readonly address: string;
  readonly displayName: string;
}

export interface AppointmentCatalogs {
  readonly patients: readonly PatientOption[];
  readonly specializations: readonly SpecializationOption[];
  readonly services: readonly ServiceOption[];
  readonly doctors: readonly DoctorOption[];
  readonly offices: readonly OfficeOption[];
}
```

`DoctorStatus` is reused from `features/doctors/models/doctor-form.model.ts`; no new status vocabulary is introduced.

## 2. Form model

```ts
export interface AppointmentFormGroup {
  patientId: FormControl<string>;
  patientText: FormControl<string>;          // visible combobox text
  specializationId: FormControl<string>;
  specializationText: FormControl<string>;
  doctorId: FormControl<string>;
  doctorText: FormControl<string>;
  serviceId: FormControl<string>;
  serviceText: FormControl<string>;
  officeId: FormControl<string>;
  date: FormControl<string>;                 // yyyy-MM-dd, '' when unset
  timeSlot: FormControl<string>;             // HH:mm, '' when unset
}

export type AppointmentFormField =
  | 'patient'
  | 'specialization'
  | 'doctor'
  | 'service'
  | 'office'
  | 'date'
  | 'timeSlot';

/** Normalized snapshot consumed by the cascade reducer. */
export interface AppointmentFormValue {
  readonly patientId: string;
  readonly specializationId: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly officeId: string;
  readonly date: string;
  readonly timeSlot: string;
}
```

The `*Text` controls are display-only mirrors; the `*Id` controls are the source of truth. Text without a resolved id is invalid (see validation table).

## 3. Cascade engine types

```ts
export interface CascadeInput {
  readonly value: AppointmentFormValue;
  readonly catalogs: AppointmentCatalogs;
  readonly lastEditedField: AppointmentFormField | null;
  readonly availableDoctors: ReadonlySet<string> | null; // null = not yet resolved
}

export interface CascadePlan {
  /** Options that each combobox may currently offer (already filtered + active only). */
  readonly options: {
    readonly patients: readonly PatientOption[];
    readonly specializations: readonly SpecializationOption[];
    readonly doctors: readonly DoctorOption[];
    readonly services: readonly ServiceOption[];
    readonly offices: readonly OfficeOption[];
  };
  /** Values the store must write, in reducer order. Never targets `lastEditedField`. */
  readonly autoFill: readonly CascadeWrite[];
  /** Values the store must clear because they became incompatible. */
  readonly clear: readonly CascadeWrite[];
  readonly dateEnabled: boolean;             // specializationId && serviceId
  readonly slotsEnabled: boolean;            // dateEnabled && date !== ''
  readonly dateVisible: boolean;
  readonly isComplete: boolean;              // every required value present and consistent
}

export interface CascadeWrite {
  readonly field: AppointmentFormField;
  readonly value: string;
}
```

Full rule matrix: [contracts/appointment-cascade.md](./contracts/appointment-cascade.md).

## 4. List and filter model

```ts
export type AppointmentStatusFilter = 'all' | 'approved' | 'notApproved';

export interface AppointmentFilterState {
  readonly date: string;                     // yyyy-MM-dd, defaults to today
  readonly doctorId: string;                 // '' = any
  readonly serviceId: string;                // '' = any
  readonly status: AppointmentStatusFilter;  // defaults to 'all'
  readonly officeId: string;                 // '' = any
  readonly hasGenerated: boolean;
}

/** One table row, already sorted and display-ready. */
export interface AppointmentRow {
  readonly id: string;
  readonly startTime: string;     // ISO from API
  readonly endTime: string;       // ISO from API
  readonly timeRangeLabel: string; // "11:00 - 11:20"
  readonly doctorFullName: string;
  readonly patientFullName: string;
  readonly patientPhoneNumber: string;
  readonly serviceName: string;
  readonly isApproved: boolean;
  readonly officeId: string | null;
  readonly isApproving: boolean;
  readonly isDeleting: boolean;
}
```

`officeId` is not returned by `ViewAppointmentListDTO`; it is filled from the current filter context when known (`null` otherwise) and is never used for rendering. It exists only to support future per-row actions that need it.

## 5. API mapping

| Generated DTO | Feature model | Transformation |
|---|---|---|
| `ViewAppointmentListDto` | `AppointmentRow` | `timeRangeLabel` from `StartTime`/`EndTime` in clinic local time; `isApproved` copied |
| `CreateAppointmentDto` (`DoctorId`, `ServiceId`, `OfficeId`, `Date`, `TimeSlot`) | submit payload | patient id goes in the path parameter, not the body |
| `GetAppointmentsFilterDto` | `AppointmentFilterState` | `status: all → IsApproved: undefined`; `DoctorName` = doctor surname; `ServiceName` = exact service name; `OfficeId` only when set |
| `DoctorTableRowDto` (Profiles) | `DoctorOption` | keep `status === 'At work'`; resolve `officeId` by normalized address |
| `ViewSpecializationDto.services[]` | `ServiceOption[]` | keep `status === Active`; attach the parent specialization id |
| `Office` (appointments) | `OfficeOption` | active only; `displayName = address` |

Envelope shape returned by every appointments endpoint:

```ts
export interface ApiEnvelope<T> {
  readonly isSuccess: boolean;
  readonly message: string | null;
  readonly errors: readonly string[];
  readonly data: T | null;
}
```

The narrowing helper `readApiEnvelope<T>(payload: unknown, guard: (v: unknown) => v is T)` accepts `unknown`, validates the envelope, and throws a typed `ApiContractError` when the payload does not match. No `any`, no casts to DTOs.

## 6. Validation rules

| Field | Control validators | Blur behavior | Message |
|---|---|---|---|
| Patient | `required`, `catalogMatchValidator(patientOptions)` on text | mark touched | empty → "Please, choose the patient"; text without a selected patient → "Invalid patient name" |
| Specialization | `required` | mark touched | "Please, choose the specialization" |
| Doctor | `required` | mark touched | "Please, choose the doctor" |
| Service | `required` | mark touched | "Please, choose the service" |
| Office | `required` | mark touched | "Please, choose the office" |
| Date | `required` on the control; disabled by cascade until specialization + service | mark touched | "Please, choose the date" |
| Time slot | `required`; disabled until date selected | mark touched | "Please, choose the time slot" |

Only the patient messages are fixed by the spec; the others follow the existing project wording pattern and are confirmed in [contracts/ui-contracts.md](./contracts/ui-contracts.md).

**Confirm is enabled** when: `form.valid` **and** `cascade.dateEnabled` **and** `date !== ''` **and** `timeSlot !== ''` **and** `cascade.isComplete` **and** no catalog value is stale (all selected ids still exist in the current option sets) **and** no submit is in flight.

## 7. State transitions

### Appointment

```text
(none) ──create──▶ Not Approved ──approve──▶ Approved
                        │                        │
                        └────────cancel──────────┘
                                   │
                                   ▼
                              (deleted)
```

- Creation always yields `Not Approved` (spec assumption).
- Approval is idempotent from the UI: the button is disabled once approved; a second request is never sent.
- Cancellation deletes permanently from both statuses; there is no undo.
- No other transitions exist; `Reschedule` does not change state in this feature.

### UI operation state

| Operation | Optimistic update | On error |
|---|---|---|
| Create | none (modal stays open until success) | keep modal + values, notification, retry enabled |
| Approve | `isApproved = true`, highlight, disable button | revert flag + highlight, notification |
| Cancel | none until success (dialog stays open) | keep row, notification, dialog closed |
| List load | keep current rows, show loading | keep previous rows, notification, `Generate` retry |

## 8. Sorting contract

```ts
export type AppointmentSortKey = 'startTime' | 'doctorSurname' | 'doctorName' | 'serviceName';

// Ascending, applied strictly in this order:
// 1. startTime (instant)
// 2. doctor surname
// 3. doctor first name
// 4. service name
```

Comparison uses one shared `Intl.Collator(undefined, { sensitivity: 'base' })`. Doctor surname/first name are derived by splitting `doctorFullName` (`"Surname Name Middle"`), not by re-fetching data. Ties beyond the fourth key preserve the server order (stable sort).

## 9. Derived data and caching

| Derived value | Source | Cache scope |
|---|---|---|
| Filtered specializations | `catalogs.specializations` + office/doctor constraints | per form instance |
| Filtered doctors | `catalogs.doctors` + specialization/office/service/slot constraints | per form instance |
| Filtered services | `specializationId → services[]` map | singleton catalog service |
| Filtered offices | `catalogs.offices` + doctor constraints | per form instance |
| Available slots | schedule endpoint | key `doctorId|serviceId|date`, 30 s TTL |
| Doctor availability set | schedule endpoint per candidate | key `doctorId|serviceId|date|slot` |
| Patient options | ProfilesAPI search (P-2) | per query, debounced 250 ms |
