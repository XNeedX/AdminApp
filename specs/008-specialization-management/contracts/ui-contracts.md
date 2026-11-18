# Contract: UI Composition (routes, components, dialogs, services)

**Feature**: `008-specialization-management` | **Date**: 2026-11-18

This is the internal contract between the module's smart and dumb pieces. It fixes names, inputs,
outputs and message strings so implementation and tests cannot drift from the specification.

---

## 1. Routes

| Path | Component | Guard | Purpose |
|------|-----------|-------|---------|
| `/specializations` | `SpecializationsPageComponent` | `authGuard` + `roleGuard('Receptionist')` | List + create entry point |
| `/specializations/:id` | `SpecializationInfoComponent` | `authGuard` + `roleGuard('Receptionist')` | Detail, View/Edit, immediate status |

Both are lazy `loadComponent` entries inside the existing authenticated `''` route children.
`app.ts` adds `{ label: 'Specializations', path: '/specializations' }` to `navItems` for
Receptionists only, after `Services`.

Navigation contract:

- Row activation (anywhere except the status cell) -> `router.navigate(['/specializations', id])`.
- Back action on detail -> `/specializations`.
- Successful creation -> dialog closes, list reloads/refreshes and shows a success toast.

---

## 2. Component I/O Contracts

### `SpecializationTableComponent` (dumb)

Selector `app-specialization-table`.

| Kind | Name | Type | Notes |
|------|------|------|-------|
| input | `rows` | `readonly SpecializationListRow[]` | Required |
| input | `statusSavingId` | `string \| null` | Disables that row's radios |
| output | `open` | `string` (id) | Row activation |
| output | `statusChange` | `{ id: string; status: SpecializationStatus }` | Radio change |

Must not inject services, router or dialogs. Renders `<table>` with columns
`Specialization Name` and `Status`, status as an Active/Inactive radio pair, and sets
`stopPropagation` on the status cell so a radio change never triggers `open`.

### `SpecializationFormComponent` (dumb)

Selector `app-specialization-form`.

| Kind | Name | Type | Notes |
|------|------|------|-------|
| input | `mode` | `'create' \| 'edit'` | Label/behaviour switch |
| input | `initialValue` | `SpecializationView \| null` | Pre-fills rows in edit mode |
| input | `submitting` | `boolean` | Disables the whole form |
| output | `submitted` | `SpecializationFormValue` | Only emitted when valid |
| output | `cancelled` | `void` | Opens confirmation in the parent |

Owns the typed `FormGroup<SpecializationFormControls>` including the `FormArray`. Exposes
`canSubmit` (valid **and** `services.length > 0` **and** not submitting). Provides
`addService()` and `discardRow(index)`; `discardRow` is only offered for rows whose `id === null`.
Renders the services table with columns `Service Name`, `Price`, `Status`, `Service Category`.

### `SpecializationsPageComponent` (smart)

| Kind | Name | Type | Notes |
|------|------|------|-------|
| state | `rows` | `signal<readonly SpecializationListRow[]>` | Sorted by name |
| state | `isLoading`, `isEmpty`, `loadError` | signals | Distinct states (FR-008) |
| state | `statusSavingId` | `signal<string \| null>` | In-flight guard |
| action | `load()` / `retry()` | method | `specializationGet` |
| action | `onStatusChange({ id, status })` | method | Optimistic PATCH + rollback |
| action | `onOpen(id)` | method | Router navigation |
| action | `onCreate()` | method | Opens the create dialog |

Injects `SpecializationService`, `Dialog`, `Router`, `NotificationService`, `DestroyRef`.

### `SpecializationInfoComponent` (smart)

| Kind | Name | Type | Notes |
|------|------|------|-------|
| state | `specialization` | `signal<SpecializationView \| null>` | Loaded record |
| state | `isEditMode` | `signal<boolean>` | View/Edit switch |
| state | `isLoading`, `isSaving`, `statusSaving`, `loadError` | signals | States |
| state | `statusControl` | `FormControl<SpecializationStatus>` | View-mode immediate status |
| action | `load()`, `retry()` | method | `specializationIdGet` |
| action | `enterEdit()` | method | `isEditMode.set(true)` |
| action | `onSubmitted(value)` | method | Writer save -> View mode |
| action | `onCancelled()` | method | CDK confirm -> View mode |
| action | `changeStatus(next)` | method | Optimistic PATCH + rollback |

Injects `SpecializationService`, `SpecializationWriterService`, `ActivatedRoute`, `Dialog`,
`NotificationService`, `DestroyRef`.

### `SpecializationCreateDialogComponent` (smart, hosted by CDK)

| Kind | Name | Type | Notes |
|------|------|------|-------|
| data | `SpecializationCreateDialogData` | `{}` | Reserved for future context |
| result | `SpecializationCreateDialogResult` | `{ id: string } \| null` | `null` = cancelled |
| state | `submitting` | `signal<boolean>` | Disables Confirm |
| state | `partialNotice` | `signal<string \| null>` | Shown after a partial failure |

Uses `DIALOG_DATA`, `DialogRef`, `SpecializationWriterService`, `Dialog`, `NotificationService`.

### `SpecializationWriterService` (application service, `providedIn: 'root'`)

Composes generated client calls only. Contract:

```ts
create(value: SpecializationFormValue, state: WriteSessionState): Observable<WriteSessionState>;
update(
  id: string,
  value: SpecializationFormValue,
  state: WriteSessionState
): Observable<WriteSessionState>;

interface WriteSessionState {
  readonly specializationId: string | null;   // set once the specialization exists
  readonly createdServiceIds: readonly string[]; // row keys already created, in order
}
```

Rules:

- `create` performs `specializationPost` only while `specializationId === null`; afterwards it
  updates the existing record on retry.
- `update` performs `specializationIdPut`, then `serviceIdPut` for rows with an `id`, then
  `servicePost` for rows without one, skipping rows already present in `createdServiceIds`.
- The returned state is used by the caller on retry. No transport or DTO type is declared here.

---

## 3. Dialog Contracts

All confirmations use `@angular/cdk/dialog` with the shared
`CancelConfirmDialogComponent` (`disableClose: true`, `restoreFocus: true`).

| Trigger | Message (exact) | Yes | No |
|---------|-----------------|-----|----|
| Create dialog "Cancel" | `Do you really want to cancel? Entered data will not be saved.` | Close dialog, return to list, save nothing | Close dialog only; form values preserved |
| Detail Edit mode "Cancel" | `Do you really want to cancel? Changes will not be saved.` | Leave Edit mode, show stored values | Close dialog only; edits preserved |

No confirmation is shown for status changes (spec Assumptions).

---

## 4. User-Facing Strings

| Purpose | Exact text |
|---------|------------|
| Empty name (specialization or service) | `Please, enter the name` |
| Empty price | `Please, enter the price` |
| Invalid price | `You've entered an invalid price` |
| Missing category | `Please, choose the service category` |
| Create success | `Specialization created successfully` |
| Update success | `Specialization updated successfully` |
| Status success | `Specialization status updated successfully` |
| Status failure fallback | `Could not update the specialization status. Please try again.` |
| Create/update failure fallback | `Could not save the specialization. Please try again.` |
| Not found | `Specialization not found.` |
| Empty list | `No specializations yet.` |
| Empty services | `This specialization has no services yet.` |
| Incomplete payload | `The specialization data returned by the API is incomplete.` |

---

## 5. Accessibility Contract

- Each status radio group has a unique `name` per row and an accessible group label.
- Invalid controls set `aria-invalid="true"` and reference their message with `aria-describedby`.
- The services table has `scope="col"` headers; the table scrolls horizontally on small screens.
- Row activation is keyboard reachable; status radios are independently keyboard operable.
- Dialog focus is trapped and restored by CDK; Escape resolves to "No" (`disableClose` keeps the
  dialog open on backdrop click, and both buttons remain available).
