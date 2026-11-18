# Phase 1 Data Model: Clinic Services Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature has no local persistence. The models below describe the client-side representation, the form model, and the boundary mapping to the Services API. The backend owns storage.

---

## 1. Domain entities (as consumed by the UI)

### Service

The billable service managed by the feature.

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | `string` (GUID) | yes (read-only) | Assigned by the backend on creation; never edited. |
| `name` | `string` | yes | Non-empty after trimming; maximum 100 characters (UI rule, see Assumptions). |
| `price` | `number` | yes | Finite, `> 0`, at most 2 fractional digits. |
| `category` | `ServiceCategory` | yes | One of `Analyses`, `Consultations`, `Diagnostics`. |
| `status` | `ServiceStatus` | yes | One of `Active`, `Inactive`; defaults to `Active` on creation. |
| `specializationId` | `string` (GUID) | yes | Inherited from the specialization page; not user-editable in this feature. |

Relationship: **Specialization 1 — N Service**. Each service belongs to exactly one specialization. The specialization's own name, price, and status are managed outside this feature.

### ServiceStatus

Business labels mapped from the numeric API enum.

| Business value | API value | Patient visibility |
|---|---|---|
| `Active` | `0` | Visible in patient-facing catalogs. |
| `Inactive` | `1` | Hidden from patient-facing catalogs; still visible to clinic staff. |

State transitions:

```text
        set Active                 set Inactive
Inactive ──────────► Active   Active ──────────► Inactive
   ▲                    │          ▲                │
   └────────────────────┘          └────────────────┘
     (immediate PATCH in View mode, or PUT via Edit form)
```

Both transitions are allowed at any time. There is no deletion and no other state.

### ServiceCategory

| Business value | API value |
|---|---|
| `Analyses` | `0` |
| `Consultations` | `1` |
| `Diagnostics` | `2` |

The dropdown has no default selection on creation; the user must choose one.

---

## 2. Client-side models

### `ServiceView`

Read model rendered in View mode and used to pre-fill Edit mode.

```ts
interface ServiceView {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly category: ServiceCategory;
  readonly status: ServiceStatus;
  readonly specializationId: string;
}
```

### `ServiceFormValue`

Value produced by `ServiceFormComponent` on submit.

```ts
interface ServiceFormValue {
  readonly name: string;          // trimmed
  readonly price: number;
  readonly category: ServiceCategory;
  readonly status: ServiceStatus;
}
```

### `ServiceFormControls`

Typed reactive form shape owned by `ServiceFormComponent`.

```ts
interface ServiceFormControls {
  name: FormControl<string>;
  price: FormControl<number | null>;
  category: FormControl<ServiceCategory | ''>;
  status: FormControl<ServiceStatus>;
}
```

### `ServiceCreateDialogData` / `ServiceCreateDialogResult`

```ts
interface ServiceCreateDialogData {
  readonly specializationId: string;
}

// DialogRef<ServiceCreateDialogResult | null>
interface ServiceCreateDialogResult {
  readonly id: string;
}
```

### `CancelConfirmDialogData`

```ts
interface CancelConfirmDialogData {
  readonly message: string;
  readonly confirmText?: string; // default "Yes"
  readonly cancelText?: string;  // default "No"
}
```

### `SpecializationOption`

Selector entry for the `/services` page (specialization-context page).

```ts
interface SpecializationOption {
  readonly id: string;
  readonly name: string;
}
```

### `ServiceListRow`

Read-only row rendered by the `/services` page's service table.

```ts
interface ServiceListRow {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly category: ServiceCategory;
  readonly status: ServiceStatus;
}
```

---

## 3. API boundary mapping

The generated client uses the numeric enum types and the request models from the Services API definition. Mapping happens in `features/services/models/service.model.ts`; components never see raw numeric values or generated request objects.

| UI model | API type (generated) | Mapping |
|---|---|---|
| `ServiceView` | `ViewServiceDTO` | `id`, `name`, `price`, `specializationId` copied; `category`/`status` converted from number via exhaustive switches. |
| `ServiceFormValue` (create) | `CreateServiceCommand` | `name.trim()`, `price`, `category` → number, `status` → number, `specializationId` from dialog data. |
| `ServiceFormValue` (edit) | `EditServiceDTO` | `name.trim()`, `price`, `category` → number, `status` → number. |
| status change | `EditStatusDTO` | `{ status: number }`. |
| `SpecializationOption[]` | `ViewSpecializationListDTO[]` | `id`/`name` copied (`requireText`); status ignored. |
| `SpecializationOption` | `ViewSpecializationDTO` | Header of the selected specialization (`id`/`name`). |
| `ServiceListRow[]` | `ViewSpecializationServiceDTO[]` | `id`, `name`, `price` copied; `category`/`status` converted from number via the exhaustive switches. |

Conversion rules:

- `toServiceStatus(value: number): ServiceStatus` — `0 → Active`, `1 → Inactive`, anything else throws (defensive, never silently defaults).
- `toServiceCategory(value: number): ServiceCategory` — `0 → Analyses`, `1 → Consultations`, `2 → Diagnostics`, anything else throws.
- `fromServiceStatus(value: ServiceStatus): number` and `fromServiceCategory(value: ServiceCategory): number` — exhaustive inverse maps.
- `toServiceView(dto: ViewServiceDTO): ServiceView`.
- `toCreateServiceRequest(value: ServiceFormValue, specializationId: string): CreateServiceCommand`.
- `toUpdateServiceRequest(value: ServiceFormValue): EditServiceDTO`.
- `toEditStatusRequest(value: ServiceStatus): EditStatusDTO`.
- `toSpecializationOptions(dtos: readonly ViewSpecializationListDTO[]): readonly SpecializationOption[]`.
- `toSpecializationHeader(dto: ViewSpecializationDTO): SpecializationOption`.
- `toServiceListRows(dtos: readonly ViewSpecializationServiceDTO[]): readonly ServiceListRow[]`.

Incomplete payloads (missing id/name/price/enum) throw instead of rendering partial rows; the `/services` page turns that into an inline error state.

No `any` is used; unknown response shapes are handled by the generated client's typed response, and the mappers accept the generated types directly.

---

## 4. Validation rules

Validation runs in `ServiceFormComponent`; messages appear only when the control is `touched` (blur), as required by F-1…F-3.

| Field | Empty message | Invalid message | Validator |
|---|---|---|---|
| Name | "Please, enter the name" | (max length only) | `required` + `maxLength(100)` |
| Price (empty) | "Please, enter the price" | — | `required` |
| Price (invalid) | — | "You've entered an invalid price" | `positivePriceValidator` (`<= 0`, `NaN`, `Infinity`, `> 2` decimals) |
| Category | "Please, choose the service category" | — | `required` |
| Status | — | — | `required`, always has a value (default `Active`) |

Submit-button rules:

- Create mode: "Confirm" is enabled only when the form is `VALID` and no request is in flight.
- Edit mode: "Save changes" follows the same rule.
- Both buttons are disabled while `submitting` is `true` (prevents duplicate submissions, FR-026).

---

## 5. Derived state in `ServiceInfoComponent`

| Signal | Type | Purpose |
|---|---|---|
| `service` | `ServiceView \| null` | Loaded service; `null` while loading or after a load error. |
| `isEditMode` | `boolean` | Switches between View and Edit. |
| `isLoading` | `boolean` | Initial load state. |
| `isSaving` | `boolean` | "Save changes" in flight; disables the form. |
| `statusSaving` | `boolean` | Immediate status change in flight; disables the status radios. |
| `loadError` | `string \| null` | Load failure message. |

Derived in the template: the read-only block (fields + status group + "Edit") renders only while `isEditMode()` is `false` and `service()` is non-null; `ServiceFormComponent` replaces it in Edit mode. The status group is disabled through `statusControl.disable()` while `statusSaving()` is `true`.

---

## 6. State ownership summary

| State | Owner | Lifetime |
|---|---|---|
| Form values and validation | `ServiceFormComponent` (dumb) | While the form is mounted. |
| Loaded service, View/Edit mode, saving flags | `ServiceInfoComponent` (smart) | Page lifetime. |
| Create dialog form and submit state | `ServiceCreateDialogComponent` (smart host) | Dialog lifetime. |
| Cancel confirmation result | `CancelConfirmDialogComponent` via `DialogRef<boolean>` | Dialog lifetime. |
| Service catalog (list) | `ServicesPageComponent` (`/services`, in this feature) | Page lifetime. |
