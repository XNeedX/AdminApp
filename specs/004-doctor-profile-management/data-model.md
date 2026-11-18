# Data Model: Doctor Profile Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **API contract**: [contracts/profile-api.contract.md](./contracts/profile-api.contract.md)

All shapes below are client-side view models. The transport types are owned by the strictly typed hand-written clients in `src/app/api/`: every response is treated as `unknown` and narrowed by runtime guards, with zero `any`. The interfaces here describe how the UI stores and maps those validated values.

---

## 1. Entities

### 1.1 DoctorProfile (read model)

The profile displayed in View mode and used to pre-fill Edit mode.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` (GUID) | yes | Doctor profile id |
| `photoPath` | `string \| null` | no | Storage path returned by the Documents API |
| `firstName` | `string` | yes | |
| `lastName` | `string` | yes | |
| `middleName` | `string \| null` | no | |
| `dateOfBirth` | `string` (`yyyy-MM-dd`) | yes | Never later than today |
| `specialization` | `string` | yes | Display name from the specialization catalog |
| `officeAddress` | `string` | yes | Display label of the office (`fullAddress`, falling back to `officeNumber`) |
| `careerStartYear` | `number` | yes | Never later than the current year |
| `status` | `DoctorStatus` | yes | One of the seven values |

Matches the backend `DoctorAdminDto` (`PhotoPath`, `FirstName`, `LastName`, `MiddleName`, `DateOfBirth`, `Specialization`, `OfficeAddress`, `CareerStartYear`, `Status`) plus the required `Id`, which the current DTO omits. `DoctorDetailsDto` is insufficient because it omits both `Id` and `Status`.

### 1.2 DoctorStatus

```ts
export enum DoctorStatus {
  AtWork = 'At work',
  OnVacation = 'On vacation',
  SickDay = 'Sick Day',
  SickLeave = 'Sick Leave',
  SelfIsolation = 'Self-isolation',
  LeaveWithoutPay = 'Leave without pay',
  Inactive = 'Inactive',
}

export const DOCTOR_STATUSES: readonly DoctorStatus[] = [
  DoctorStatus.AtWork,
  DoctorStatus.OnVacation,
  DoctorStatus.SickDay,
  DoctorStatus.SickLeave,
  DoctorStatus.SelfIsolation,
  DoctorStatus.LeaveWithoutPay,
  DoctorStatus.Inactive,
];
```

`DoctorStatus` already exists in `features/doctors/models/doctor-form.model.ts`. Add the exported `DOCTOR_STATUSES` array there and reuse it in the create form, the profile form, and the Doctors page status select — one vocabulary, no duplication.

Type guard:

```ts
export function isDoctorStatus(value: string): value is DoctorStatus {
  return (DOCTOR_STATUSES as readonly string[]).includes(value);
}
```

### 1.3 Catalog option

```ts
export interface AutocompleteOption {
  readonly id: string;
  readonly label: string;
}
```

The canonical type lives in `shared/components/autocomplete/autocomplete.model.ts`; `features/profile/models/profile.model.ts` re-exports it so feature code can import everything profile-related from one place.

Mapping:
- Specialization: `{ id: specialization.id, label: specialization.name }`.
- Office: `{ id: office.id, label: office.fullAddress ?? office.officeNumber ?? office.id }`.

### 1.4 DoctorTableRow (Receptionist list)

From the backend table contract (`DoctorTableRowDto`):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Profile id |
| `fullName` | `string` | Display only |
| `specialization` | `string` | |
| `status` | `DoctorStatus` | Editable via the row select |
| `dateOfBirth` | `string` | |
| `officeAddress` | `string` | |

### 1.5 ProfileEditSession (transient)

Not persisted. Lives in `ProfilePageComponent` while `isEditMode()` is `true`.

| Field | Type | Notes |
|---|---|---|
| `form` | `FormGroup<DoctorProfileForm>` | Typed reactive form |
| `photoPreview` | `string \| null` | Object URL for a newly selected file |
| `isSaving` | `boolean` | Save in flight |
| `existingPhotoPath` | `string \| null` | Preserved unless a new file is uploaded |

---

## 2. Typed form model

```ts
export interface DoctorProfileForm {
  photo: FormControl<File | null>;
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  middleName: FormControl<string | null>;
  dateOfBirth: FormControl<string>;              // yyyy-MM-dd
  specializationText: FormControl<string>;       // visible input
  specializationId: FormControl<string>;         // hidden, set only by optionSelected
  officeText: FormControl<string>;               // visible input
  officeId: FormControl<string>;                 // hidden, set only by optionSelected
  careerStartYear: FormControl<number | null>;
  status: FormControl<DoctorStatus>;
}
```

Construction rules:
- `photo`: `null`, no validators.
- `firstName`, `lastName`: `''`, `nonNullable: true`, `Validators.required`.
- `middleName`: `''`, optional.
- `dateOfBirth`: `''`, `nonNullable: true`, `[Validators.required, maxDateValidator(() => new Date())]`.
- `specializationText`: `''`, `nonNullable: true`, `[Validators.required, catalogMatchValidator(() => this.specializationOptions())]`.
- `specializationId`: `''`, `nonNullable: true`, `Validators.required`.
- `officeText`: `''`, `nonNullable: true`, `[Validators.required, catalogMatchValidator(() => this.officeOptions())]`.
- `officeId`: `''`, `nonNullable: true`, `Validators.required`.
- `careerStartYear`: `null`, `[Validators.required, maxYearValidator(() => new Date().getFullYear())]`.
- `status`: profile status (or `DoctorStatus.AtWork` when creating), `nonNullable: true`, `Validators.required`.

`catalogMatchValidator` is a small custom validator:

```ts
export function catalogMatchValidator(
  options: () => readonly AutocompleteOption[]
): ValidatorFn {
  return (control) => {
    const text = typeof control.value === 'string' ? control.value.trim() : '';
    if (text.length === 0) {
      return null; // `required` reports the empty case
    }
    const exists = options().some(
      (option) => option.label.trim().toLowerCase() === text.toLowerCase()
    );
    return exists ? null : { invalidCatalogValue: true };
  };
}
```

---

## 3. Validation matrix

| Field | Control | Rule | Error key | Message | Trigger |
|---|---|---|---|---|---|
| F-1 Photo | `photo` | Optional | — | Inline file-type/size error only | On file selection |
| F-2 First name | `firstName` | Non-empty | `required` | `Please, enter the first name` | Blur / save attempt |
| F-3 Last name | `lastName` | Non-empty | `required` | `Please, enter the last name` | Blur / save attempt |
| F-4 Middle name | `middleName` | Optional | — | — | — |
| F-5 Date of birth | `dateOfBirth` | Non-empty | `required` | `Please, select the date` | Blur / save attempt |
| F-5 Date of birth | `dateOfBirth` | `<= today` | `futureDate` | `Date cannot be in the future` | On value change |
| F-6 Specialization | `specializationText` | Non-empty | `required` | `Please, choose the specialisation` | Blur / save attempt |
| F-6 Specialization | `specializationText` | Matches a catalog label | `invalidCatalogValue` | `Invalid specialization name` | Blur / value change |
| F-6 Specialization | `specializationId` | A catalog option was selected | `required` | `Invalid specialization name` | Blur / save attempt |
| F-7 Office | `officeText` | Non-empty | `required` | `Please, choose the office` | Blur / save attempt |
| F-7 Office | `officeText` / `officeId` | Matches a catalog entry and a selection exists | `invalidCatalogValue` / `required` | `Please, choose the office` | Blur / save attempt |
| F-8 Career start year | `careerStartYear` | Non-empty | `required` | `Please, select the year` | Blur / save attempt |
| F-8 Career start year | `careerStartYear` | `<= current year` | `futureYear` | `Year cannot be in the future` | On value change |
| F-9 Status | `status` | One of the seven values | `required` | — (dropdown cannot be empty) | On change |

Error display rule: show the message only when `control.invalid && control.touched`. `AutocompleteComponent` calls `onTouched()` on blur, so the combobox messages appear at the required moment. The "Save changes" button uses the aggregate `canSave()` computed, not per-field touched state.

Error precedence for the autocomplete fields:
1. `required` → empty message.
2. `invalidCatalogValue` or missing `*Id` → invalid/selection message.

---

## 4. State transitions

### 4.1 Page modes

| Current state | Event | Next state | Side effects |
|---|---|---|---|
| Loading | Profile loaded | View | `profile.set(dto)`, catalogs loaded |
| Loading | Load failed | Error | `loadError.set(message)`, retry available |
| View | `Edit` clicked | Edit | `form.reset(toFormValue(profile))`, `isEditMode.set(true)` |
| Edit | Form invalid | Edit | `canSave()` is `false`; save click marks all touched |
| Edit | `Save changes` with valid form | Saving | `isSaving.set(true)`; upload photo if needed; call update |
| Saving | Update success | View | `profile.set(updated)`, `isEditMode.set(false)`, success toast |
| Saving | Update failure | Edit | `isSaving.set(false)`, values preserved, error toast |
| Edit | `Cancel` clicked | Edit + dialog | CDK dialog opens; form untouched |
| Dialog | `Yes` | View | `isEditMode.set(false)`, `form.reset(toFormValue(profile))` |
| Dialog | `No` | Edit | Dialog closes; form values preserved |
| Edit | Route change / reload | Unloaded | Unsaved changes discarded (no prompt; spec assumption) |

### 4.2 Doctors page status

| Current state | Event | Next state | Side effects |
|---|---|---|---|
| Idle | Select changes to a valid new status | Saving | Row updated optimistically; select disabled for that row |
| Saving | Request success | Idle | Success toast; new status kept |
| Saving | Request failure | Idle | Row reverted to previous status; error toast; select enabled |
| Saving | Select changes to the same status | Idle | No request |

---

## 5. Mapping rules

### 5.1 `DoctorProfile → DoctorProfileFormValue`

| Form control | Source | Notes |
|---|---|---|
| `photo` | `null` | A new file is only set by the user |
| `firstName` | `profile.firstName` | |
| `lastName` | `profile.lastName` | |
| `middleName` | `profile.middleName ?? ''` | |
| `dateOfBirth` | `profile.dateOfBirth.slice(0, 10)` | Normalize to `yyyy-MM-dd` |
| `specializationText` | `profile.specialization` | Stored even if no longer in the catalog |
| `specializationId` | matching catalog id or `''` | Case-insensitive label match; empty → form invalid |
| `officeText` | `profile.officeAddress` | |
| `officeId` | matching catalog id or `''` | Match against `fullAddress`/`officeNumber`; empty → form invalid |
| `careerStartYear` | `profile.careerStartYear` | |
| `status` | `profile.status` | |

Edge case: if the stored specialization/office is missing from the current catalog, the text is still shown, the id stays empty, the form is invalid, and the user must pick a current value before saving (spec edge case).

### 5.2 `DoctorProfileFormValue → UpdateDoctorDto`

| DTO field | Source | Notes |
|---|---|---|
| `photoPath` | new upload id, else `existingPhotoPath`, else `null` | Never `null` when an existing photo is unchanged |
| `firstName` | `firstName.trim()` | |
| `lastName` | `lastName.trim()` | |
| `middleName` | `middleName?.trim() || null` | |
| `dateOfBirth` | `dateOfBirth` | `yyyy-MM-dd` |
| `specialization` | selected specialization option label | Backend expects the name, not the id |
| `officeAddress` | selected office option label | Backend expects the address, not the id |
| `careerStartYear` | `Number(careerStartYear)` | |
| `status` | `status` | |

`UpdateDoctorDto` does not contain `email`; e-mail changes are out of scope.

Because E3 returns `data: null`, the page updates the `profile` signal from the submitted payload plus the resolved `photoPath` and the selected option labels. If a future backend version returns the updated profile, prefer that response.

### 5.3 Status-only update

There is no status-only endpoint. The Doctors page composes the update:

1. `GET /profiles/doctors/{id}` (E2) to read the full profile.
2. Build `UpdateDoctorDto` from that profile, replacing only `status`.
3. `PUT /profiles/doctors/{id}` (E3) with the complete payload.

The client applies the new status optimistically, disables the row select while the request is in flight, keeps the new status on `200`, and rolls back to the previous status with an error toast on failure.

---

## 6. API response envelopes (for client mapping)

The Profiles API wraps results as:

```json
{
  "isSuccess": true,
  "message": "Profile updated successfully",
  "errors": [],
  "data": { }
}
```

Paged results put the page object in `data` (`PagedResult<T>` → `{ data: T[], totalCount }`). The hand-written clients unwrap the envelope with `readEnvelope` and return typed models to the UI. Malformed payloads throw a descriptive `Error` instead of returning partial data.

---

## 7. Relationships

```text
AuthSession (Keycloak sub = accountId)
        │ 1
        │
        ▼
DoctorProfile (id, AccountId, Status, ...)
        │ 1
        ├──────────► Specialization (by display name)
        ├──────────► Office (by display address)
        └──────────► Photo (Documents API storage path)

DoctorTableRow (Receptionist list projection of DoctorProfile)
```

- One authenticated Doctor has exactly one `DoctorProfile`.
- A Receptionist may read and update many `DoctorProfile` records.
- `Specialization` and `Office` are referenced by display value in the profile payload, not by foreign key, so the UI must resolve them against the live catalogs.
