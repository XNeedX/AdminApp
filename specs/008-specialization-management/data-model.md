# Phase 1 Data Model: Specialization Management

**Feature**: `008-specialization-management` | **Date**: 2026-11-18

No persistence model is introduced. This document defines the view models, form models, mapping
rules, validation rules and state transitions the frontend implements. All API-shaped types are
imported from `src/app/api/generated/services/models`; no request/response interface is declared by
hand.

---

## 1. View Entities

### SpecializationListRow

Rendered by the list table. Derived from the generated `ViewSpecializationListDto`.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | `string` | `dto.id` | Required; empty/missing payloads are rejected |
| `name` | `string` | `dto.name` | Trimmed for display; required |
| `status` | `SpecializationStatus` | `dto.status` | Numeric enum mapped to `'Active' \| 'Inactive'` |

### SpecializationView

Rendered by detail View mode and used to pre-fill Edit mode. Derived from `ViewSpecializationDto`.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | `string` | `dto.id` | Required |
| `name` | `string` | `dto.name` | Required |
| `status` | `SpecializationStatus` | `dto.status` | Required |
| `services` | `readonly SpecializationServiceRow[]` | `dto.services` | Empty array when absent; each row validated |

### SpecializationServiceRow

One row of the nested services table.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | `string` | `dto.id` | Present for stored services, absent for new rows |
| `name` | `string` | `dto.name` | Required |
| `price` | `number` | `dto.price` | Positive, up to two decimals at input time |
| `status` | `SpecializationStatus` | `dto.status` | Required |
| `category` | `ServiceCategory` | `dto.category` | One of the three categories |

`ServiceCategory` = `'Analyses' | 'Consultations' | 'Diagnostics'`.
`SpecializationStatus` = `'Active' | 'Inactive'` (shared by specializations and their services).

### Form-layer row identity

New rows have no API id. The form model therefore carries an editor-only identity:

```ts
interface EditableServiceRowValue {
  readonly key: string;          // crypto.randomUUID(); template track + removal identity
  readonly id: string | null;    // null for rows added in this session
  readonly name: string;
  readonly price: number | null;
  readonly category: ServiceCategory | '';
  readonly status: SpecializationStatus;
}
```

`key` never leaves the browser and is not sent to the API.

---

## 2. Form Models (typed reactive forms)

### Control interfaces

```ts
interface ServiceRowControls {
  name: FormControl<string>;
  price: FormControl<number | null>;
  category: FormControl<ServiceCategory | ''>;
  status: FormControl<SpecializationStatus>;
}

interface SpecializationFormControls {
  name: FormControl<string>;
  status: FormControl<SpecializationStatus>;
  services: FormArray<FormGroup<ServiceRowControls>>;
}
```

### Defaults and validators

| Control | Default | `nonNullable` | Validators |
|---------|---------|---------------|------------|
| `name` (specialization) | `''` | yes | `required`, `nonBlankValidator`, `maxLength(100)` |
| `status` (specialization) | `'Active'` | yes | `required` |
| `services` (array) | `[]` | n/a | `minLength(1)` array validator + explicit `length === 0` submit guard |
| `services[i].name` | `''` or stored | yes | `required`, `nonBlankValidator`, `maxLength(100)` |
| `services[i].price` | `null` or stored | no | `required`, `positivePriceValidator` |
| `services[i].category` | `''` or stored | yes | `required` |
| `services[i].status` | `'Active'` or stored | yes | `required` |

`nonBlankValidator` and `positivePriceValidator` are the existing validators in
`core/validators/` and are reused unchanged so messages and behaviour match the services module.

### Form value (emitted on submit)

```ts
interface SpecializationFormValue {
  readonly name: string;                                  // trimmed
  readonly status: SpecializationStatus;
  readonly services: readonly ServiceRowFormValue[];
}

interface ServiceRowFormValue {
  readonly id: string | null;                             // null = new row
  readonly name: string;
  readonly price: number;                                 // narrowed after validity check
  readonly category: ServiceCategory;
  readonly status: SpecializationStatus;
}
```

The form emits only when valid; `price` and `category` are narrowed before emission, so consumers
never receive `null` or `''`.

---

## 3. Mapping Rules

### Generated -> UI (inbound)

| Generated | UI | Rule |
|-----------|----|------|
| `Status.Active / Status.Inactive` | `'Active' / 'Inactive'` | Exhaustive `switch`; unknown value throws `Error` and the page shows a contract error |
| `Category.Analyses / Consultations / Diagnostics` | matching string | Exhaustive `switch`; unknown value throws |
| missing `id` / `name` | - | Reject the payload; show "The specialization data returned by the API is incomplete." |
| `services` undefined | `[]` | Render the empty-services state |
| duplicate names | preserved | Names are not unique (spec Assumptions) |

### UI -> Generated (outbound)

| UI | Generated type | Rule |
|----|----------------|------|
| `SpecializationStatus` | `Status` | Exhaustive `switch` before the call |
| `ServiceCategory` | `Category` | Exhaustive `switch` before the call |
| `name` | `CreateSpecializationCommand.name` / `EditSpecializationDto.name` | `trim()` applied once, at the mapper boundary |
| `services[i]` | `CreateServiceCommand` (new) / `EditServiceDto` (existing) | New rows include `specializationId`; existing rows do not |

**Payload constraint (blocking)**: the generated specialization create/edit types currently also
require `price` and `category`. This feature's mappers must not fabricate them; see plan.md gate
G-1.

---

## 4. State Transitions

### List page

```text
idle
  -> loading            (load())
  -> loaded(rows)       (success, sorted by name)
  -> empty              (success, rows.length === 0)
  -> error              (failure; Retry available)

loaded(rows)
  -> statusSaving(rowId)     (radio change != current, no in-flight for that row)
       -> loaded(rows)       (PATCH success; toast)
       -> loaded(previous)   (PATCH failure; error toast; value restored)
  -> navigating(detailId)    (row activation, excluding the status cell)
```

Invariants: at most one in-flight status change per row; selecting the current status is a no-op;
a stale list response never replaces a newer local status.

### Detail page

```text
loading -> notFound | error | view(specialization)

view(s)
  -> edit                    ("Edit")
  -> statusSaving            (radio change)
       -> view(updated)      (PATCH success)
       -> view(previous)     (PATCH failure)

edit
  -> saving                  ("Save changes", form valid)
       -> view(updated)      (all calls succeed; toast)
       -> edit               (any call fails; values kept; retry allowed)
  -> confirmingCancel        ("Cancel")
       -> view(stored)       (dialog "Yes")
       -> edit               (dialog "No")
```

In `edit`, the specialization status is part of the form and is written only by "Save changes"
(not by the immediate PATCH path).

### Create dialog

```text
open(empty form: status Active, services [])
  -> editing                 (Add service / field input)
  -> confirmingCancel        ("Cancel")
       -> closed(null)       (dialog "Yes")
       -> editing            (dialog "No"; values kept)
  -> submitting              ("Confirm", form valid)
       -> closed(createdId)  (specialization + all services saved)
       -> editing(partial)   (failure; values kept; retry continues without duplicates)
```

---

## 5. Validation Rules

| Field | Rule | Message (exact) | Shown when |
|-------|------|-----------------|------------|
| Specialization name | Required, trimmed non-empty, <= 100 chars | `Please, enter the name` (length violations use `The name must not exceed 100 characters`) | On blur and after a blocked submit |
| Specialization status | Required, `Active` or `Inactive` | none (a value is always selected) | - |
| Services table | At least one row | none (`Confirm` / `Save changes` disabled) | Always |
| Service name | Required, non-blank | `Please, enter the name` | On blur and after a blocked submit |
| Service price | Required, > 0, <= 2 decimals | `Please, enter the price` (empty) / `You've entered an invalid price` (invalid) | On blur and after a blocked submit |
| Service category | Required, one of three | `Please, choose the service category` | On blur and after a blocked submit |
| Service status | Required, `Active` or `Inactive` | none | - |

Submit is enabled only when all of the following hold: specialization name valid, services table
non-empty, every row valid, and no save in progress.

---

## 6. Relationship to the Specification Entities

| Spec entity | Frontend representation | Persistence |
|-------------|-------------------------|-------------|
| Specialization | `SpecializationListRow`, `SpecializationView`, specialization part of the form | Services API (read/update only through generated client) |
| Service | `SpecializationServiceRow`, `ServiceRowControls` | Services API; created/updated per row |
| Service category | `ServiceCategory` string union + generated `Category` enum | Enum in payloads |
| Doctor | Not modelled; the cascade is backend-only | - |
| Appointment | Not modelled; untouched by this feature | - |
