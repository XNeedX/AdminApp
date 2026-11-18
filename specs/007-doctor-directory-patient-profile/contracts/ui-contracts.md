# UI Contracts — Doctor Directory and Patient Profile

**Feature**: `007-doctor-directory-patient-profile` | **Date**: 2026-11-17

Contracts below are the boundary the implementation must honour. They are written as signatures and
behavioural rules, not implementations.

## 1. Routes

| Path | Component | Guard | Story |
|------|-----------|-------|-------|
| `/doctors` | `DoctorsPageComponent` | `authGuard` + `roleGuard('Receptionist')` | US1, US4 |
| `/doctors/:id/profile` | `ProfilePageComponent` | `roleGuard('Receptionist')` | US3 |
| `/profile` | `ProfilePageComponent` | `roleGuard('Doctor')` | US3 |
| `/my-schedule` | `MySchedulePageComponent` | `roleGuard('Doctor')` | US2 (precondition) |
| `/patients/:id/profile` | `PatientProfilePageComponent` | `roleGuard('Doctor')` + `patientProfileGuard` | US2 |

`app.config.ts` gains no new provider: the generated API configurations already exist and cover Profiles
and Appointments.

## 2. Component boundaries

### 2.1 `DoctorFormComponent` — dumb (create + edit)

```ts
mode = input.required<'create' | 'edit'>()
form = input.required<FormGroup<DoctorFormGroup>>()
specializations = input<readonly AutocompleteOption[]>([])
offices = input<readonly AutocompleteOption[]>([])
photoPreview = input<string | null>(null)
photoError = input<string | null>(null)
isSubmitting = input<boolean>(false)
canSubmit = input<boolean>(false)

submitted = output<void>()
cancelled = output<void>()
photoSelected = output<File>()
specializationSelected = output<AutocompleteOption>()
officeSelected = output<AutocompleteOption>()
```

Rules: no `inject()`, no HTTP, no routing; every message is derived from `form()`; `mode === 'edit'`
renders email read-only and labels the primary action `Save changes`, `mode === 'create'` labels it
`Confirm`; cancel is disabled while `isSubmitting`.

### 2.2 `DoctorCreateDialogComponent` — smart host (US1)

Owns the form instance, catalogs (via `DoctorCatalogStore`), photo upload and submission; opens in a CDK
dialog from `DoctorsPageComponent`. Dialog closes with
`{ readonly created: DoctorCreatedSummary | null }`.

- valid + `Confirm` → upload photo (if any) → `POST /Doctors` → close with `created`.
- invalid → `markAllAsTouched()`, no request, `Confirm` stays disabled.
- `Cancel` → if form dirty, open the cancel dialog; `Yes` closes with `created: null`, `No` returns.

### 2.3 `DoctorFiltersComponent` — dumb (US4)

```ts
state = input.required<DoctorFilterState>()
nameOptions = input<readonly AutocompleteOption[]>([])
specializationOptions = input<readonly AutocompleteOption[]>([])
officeOptions = input<readonly AutocompleteOption[]>([])

filterChange = output<DoctorFilterState>()   // complete replacement state
```

Renders: name combobox (`app-app-combobox`, type-to-filter), specialization `<select>`, office
`<select>`, and a `Clear filters` button. It never mutates `state`; it emits a new object. Selects list
`All` as the empty value. If the current value is absent from the narrowed list, it renders a disabled
option showing that value until the store resets it (no silent value loss).

### 2.4 `DoctorTableComponent` — dumb (US4)

```ts
rows = input.required<readonly DoctorDirectoryEntry[]>()
isLoading = input<boolean>(false)
loadError = input<string | null>(null)
canChangeStatus = input<boolean>(false)

statusChange = output<{ readonly id: string; readonly status: DoctorStatus }>()
profileRequested = output<string>()
retryRequested = output<void>()
```

Columns in order: full name (button opening the profile), specialization, status, date of birth, office.
Status is a `<select>` with the seven values, `disabled` while that row is saving, labelled for screen
readers (`Status for <full name>`). Empty state, loading state and retryable error state are rendered by
this component (FR-025, FR-028). Long values wrap rather than truncate (edge case).

### 2.5 `ProfilePageComponent` — smart (US3)

Composes `ProfileViewComponent` (existing) and `DoctorFormComponent`. It owns: profile load, catalogs,
edit mode, photo preview, save and cancel. It renders `DoctorFormComponent` only in edit mode.

### 2.6 `PatientProfilePageComponent` — smart (US2)

Composes `AppTabsComponent`, `PatientPersonalInfoComponent` and `PatientResultsComponent`. It resolves
the patient id from the route, loads profile and results, and exposes `retry`.

### 2.7 `MySchedulePageComponent` — smart (US2 precondition)

Renders one date's `DoctorScheduleEntry[]` with a date picker (default today), loading/error states, and
the patient link rule: approved rows render a button that navigates to
`/patients/:patientId/profile`; non-approved rows render plain text with
`aria-disabled="true"` and no navigation handler.

## 3. Dialog contracts (CDK `Dialog`)

| Dialog | Data | Result | Copy |
|--------|------|--------|------|
| `DoctorCreateDialogComponent` | none | `{ created: DoctorCreatedSummary \| null }` | — |
| `CancelConfirmDialogComponent` (create) | `{ message: 'Do you really want to cancel? Entered data will not be saved.', confirmText: 'Yes', cancelText: 'No' }` | `boolean` | verbatim in spec FR-007 |
| `CancelConfirmDialogComponent` (edit) | `{ message: 'Do you really want to cancel? Changes will not be saved.', confirmText: 'Yes', cancelText: 'No' }` | `boolean` | verbatim in spec FR-035 |

All three use `disableClose: true`, `restoreFocus: true` and `ariaLabelledBy` pointing at the message.
Escape resolves to `false` (keep data), never to "discard".

## 4. Tab contract (`AppTabsComponent`)

```ts
tabs = input.required<readonly { id: string; label: string }[]>()
activeId = input.required<string>()
activeChange = output<string>()
```

Accessibility: `role="tablist"` on the strip, each tab `role="tab"` with `aria-selected`,
`aria-controls` and roving `tabindex`; panels are provided by the consumer with `role="tabpanel"` and
`aria-labelledby`. Keyboard: `ArrowLeft`/`ArrowRight` move and activate, `Home`/`End` jump to the ends.
Patient profile tabs are `[{ id: 'personal', label: 'Personal information' }, { id: 'results', label:
'Appointment results' }]` with `personal` active by default (FR-041).

## 5. Filter-state contract

- One immutable `DoctorFilterState` object crosses the smart/dumb boundary per change.
- The store is the only writer of `specialization`/`officeAddress` after a cascade reset.
- `Clear filters` emits the empty state (`''` for all four fields).
- Selecting a doctor in the name combobox sets `selectedDoctorId` and `nameQuery` to that full name;
  clearing the combobox clears both.
- No filter change triggers a network request; all filtering is derived in memory.

## 6. Copy constants (single source per string)

| Constant | Value |
|----------|-------|
| `CANCEL_CREATE_MESSAGE` | `Do you really want to cancel? Entered data will not be saved.` |
| `CANCEL_EDIT_MESSAGE` | `Do you really want to cancel? Changes will not be saved.` |
| `EMAIL_TAKEN_MESSAGE` | `User with this email already exists` |
| `INVALID_EMAIL_MESSAGE` | `You've entered an invalid email` |
| `INVALID_SPECIALIZATION_MESSAGE` | `Invalid specialization name` |
| field-required messages | see data-model.md §4 |
