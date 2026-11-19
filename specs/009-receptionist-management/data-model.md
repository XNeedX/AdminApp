# Data Model: Receptionist Management

**Feature**: `009-receptionist-management`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Entity Overview

| Entity | Source | Purpose |
|--------|--------|---------|
| Receptionist profile (`ReceptionistProfile`) | `GET /Receptionists/{id}` | Read model rendered in View mode and pre-filled for Edit |
| Receptionist directory row (`ReceptionistRow`) | `GET /Receptionists?page&pageSize` | Lightweight row for the table and deletion |
| Office (`OfficeOption`) | `GET /Offices` (generated Appointments client) | Dropdown choices and address labels |
| Photo file (`File`) | Local selection | Optional image uploaded through Documents API |
| Credential email | Backend side effect of create | Not modeled in the UI; generated password never exposed |

## ReceptionistProfile

Validated from `unknown` by `isReceptionistProfile` after `readApiEnvelope`.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `string` (uuid) | **Required.** **Blocked by CG-1**: the current backend DTO does not expose it. The profile page can use the route id, but list rows cannot. |
| `photoPath` | `string \| null` | Optional. Stores the Documents API file id returned by upload; `null` means no photo. |
| `firstName` | `string` | Required, trimmed, non-blank. |
| `lastName` | `string` | Required, trimmed, non-blank. |
| `middleName` | `string \| null` | Optional, trimmed; empty becomes `null`. |
| `officeAddress` | `string` | Required by form validation. Rendered as the stored address; blank legacy values display "Not assigned". |
| `email` | not returned | Create-only. The list/read DTOs do not expose it, and the edit UI does not render it. |

**Derived values**

- `fullName = [firstName, lastName, middleName].filter(nonEmpty).join(' ')` — middle name omitted when absent.
- `initials = firstName[0] + lastName[0]` — avatar fallback.
- `photoUrl = photoPath === null ? null : <gatewayBase>/documents/Documents/{photoPath}` — resolved presentation URL.

**Guard behavior**: `isReceptionistProfile` requires non-empty `id`, `firstName`, and `lastName`, and requires `officeAddress` to be a string (blank is allowed for legacy rows and rendered as "Not assigned"); accepts `null`/missing `photoPath` and `middleName`; rejects any other shape. On failure the page shows an inline contract error instead of rendering partial data.

## ReceptionistRow

| Field | Type | Rules |
|-------|------|-------|
| `id` | `string` (uuid) | Required, unique, used for `track` and all row actions. |
| `fullName` | `string` | Derived from the three name fields. |
| `officeAddress` | `string` | Displayed verbatim; explicit "Not assigned" indicator when blank. |
| `photoPath` | `string \| null` | Optional; used for a compact avatar if the design includes one. |

**Guard behavior**: `isPagedReceptionistRows` narrows `{ data, totalCount }`; every item must satisfy `isReceptionistProfile` (or a dedicated row guard). Rows failing the guard are not rendered; an entirely invalid payload raises `ApiContractError` and renders the load-error state.

## OfficeOption

| Field | Type | Rules |
|-------|------|-------|
| `id` | `string` | Required by the catalog guard. |
| `label` | `string` | Office address; falls back to the id if the backend omits the address. |

Loaded once by `ReceptionistCatalogStore` through the generated `OfficesService`, sorted with `Intl.Collator`, cached for the application lifetime.

## Form Model (`ReceptionistFormGroup`)

Host-owned `NonNullableFormBuilder` group; the dumb form only renders it.

| Control | Type | Create validators | Edit validators |
|---------|------|-------------------|-----------------|
| `photo` | `File \| null` | none (optional) | none (optional) |
| `firstName` | `string` | `required`, `nonBlank`, `maxLength(100)` | `required`, `nonBlank`, `maxLength(100)` |
| `lastName` | `string` | `required`, `nonBlank`, `maxLength(100)` | `required`, `nonBlank`, `maxLength(100)` |
| `middleName` | `string \| null` | `maxLength(100)` | `maxLength(100)` |
| `email` | `string` | `required`, `email`, `maxLength(256)`; server `emailTaken` | no validators; not rendered |
| `officeText` | `string` | `required` | `required` |
| `officeId` | `string` | `required` (hidden companion to the select) | `required` |

**Validation matrix**

| Control / condition | Error key | Message | Applies |
|---------------------|-----------|---------|---------|
| `firstName` empty/blank | `required` | "Please, enter the first name" | Create + Edit |
| `lastName` empty/blank | `required` | "Please, enter the last name" | Create + Edit |
| `email` empty/blank | `required` | "Please, enter the email" | Create only |
| `email` malformed | `email` | "You've entered an invalid email" | Create only |
| `email` duplicate (HTTP 409) | `emailTaken` | "User with this email already exists" | Create only |
| `officeText`/`officeId` empty | `required` | "Please, choose the office" | Create + Edit |
| `firstName`/`lastName` > 100 chars | `maxlength` | "{Field} must be 100 characters or fewer" (proposed; FR-057 defines the rule, not the copy) | Create + Edit |
| `middleName` > 100 chars | `maxlength` | "Middle name must be 100 characters or fewer" (proposed) | Create + Edit |
| `email` > 256 chars | `maxlength` | "Email must be 256 characters or fewer" (proposed) | Create only |
| photo wrong type/size | local `photoError` | "Choose a JPEG, PNG or WebP image up to 5 MB" | Create + Edit |

**Submit enablement**: `canSubmit = form.status === 'VALID' && !isSubmitting() && !photoError()`. The form status is bridged with `toSignal`.

## Photo Rules

| Rule | Value |
|------|-------|
| Optional | Yes; profile can be created/edited without a photo |
| Accepted types | `image/jpeg`, `image/png`, `image/webp` |
| Max size | 5 MB |
| Preview | Local object URL for a newly selected file; current photo URL in Edit mode |
| Replace | New upload replaces the stored id after a successful profile save |
| Remove | Form control set to `null`; stored photo deleted after a successful save |
| Object URL cleanup | Revoked in `DestroyRef.onDestroy` and when the selection changes |
| Upload failure | Profile save aborts, values and selection preserved, inline/toast error shown |

## State Model (Profile Page)

```text
                 Edit clicked
   +---------+  ------------->  +--------+
   |  View   |                  |  Edit  |
   +---------+  <-------------  +--------+
        ^          Save success       |
        |                             |
        |        Cancel -> Yes        |
        +-----------------------------+
                    Cancel -> No (stay)
```

| State | Signals | UI |
|-------|---------|----|
| Loading | `isLoading=true`, `profile=null` | Skeleton/status message, no Edit |
| View | `isEditMode=false`, `profile!=null` | Profile view + Edit |
| Edit | `isEditMode=true` | Shared form + Save changes/Cancel |
| Saving | `isEditMode=true`, `isSaving=true` | Buttons disabled, spinner, values locked |
| Error | `loadError!=null` or `formError!=null` | Inline error; retry or back action |
| Empty/not found | `loadError="Receptionist not found."` | Back to `/receptionists` |

## Directory State Model

| State | Signals | UI |
|-------|---------|----|
| Loading | `isLoading=true` | "Loading receptionists…" |
| Loaded | `rows.length > 0` | Table with two columns and row actions |
| Empty | `rows.length === 0`, no error | Empty state + Create receptionist |
| Error | `loadError != null` | Error state + Try again |
| Deleting row | `deletingId != null` | Row Delete disabled for that row; other rows stay usable |

## Dialog Payloads

| Dialog | Data | Result |
|--------|------|--------|
| Create cancel | `{ title: 'Cancel', message: 'Do you really want to cancel? Entered data will not be saved.', confirmText: 'Yes', cancelText: 'No' }` | `true` → close dialog and return to `/receptionists`; `false` → stay |
| Edit cancel | `{ title: 'Cancel', message: 'Do you really want to cancel? Changes will not be saved.', confirmText: 'Yes', cancelText: 'No' }` | `true` → reset form, View mode; `false` → stay in Edit |
| Delete | `{ title: 'Delete receptionist', message: 'Do you really want to delete? Data will be lost.', confirmText: 'Yes', cancelText: 'No' }` | `true` → DELETE; `false` → close |

All dialogs use `AppDialogService.confirm`, which opens `AppConfirmDialogComponent` through CDK `Dialog`, traps focus, restores focus, and resolves `false` on Escape.

**Create dialog result**

```text
ReceptionistCreatedSummary = {
  id: string;
  fullName: string;
  officeAddress: string;
}

ReceptionistCreateDialogResult = {
  created: ReceptionistCreatedSummary | null;
}
```

`created=null` covers Cancel/Yes and dialog dismissal; a non-null summary is used only for the list refresh and success toast. The page may ignore the summary and reload the directory instead, so the result is not a second source of truth.

## Request / Response Mapping

| Operation | Generated call | Body | Response handling |
|-----------|----------------|------|-------------------|
| List | `receptionistsGet({ page, pageSize })` | — | `readApiEnvelope(payload, isPagedReceptionistRows)` |
| Read | `receptionistsIdGet({ id })` | — | `readApiEnvelope(payload, isReceptionistProfile)` |
| Create | `receptionistsPost({ body })` | `CreateReceptionistRequest` | `readApiEnvelope(payload, isProfileId)` → returned id |
| Update | `receptionistsIdPut({ id, body })` | `UpdateReceptionistDto` | `readApiAcknowledgment(payload)` |
| Delete | `receptionistsIdDelete({ id })` | — | `readApiAcknowledgment(payload)` |
| Offices | `officesGet()` | — | `readApiEnvelope(payload, isOfficeList)` |
| Photo upload | Generated Documents upload | `multipart/form-data` file | `readApiEnvelope(payload, isFileId)` |
| Photo delete | Generated Documents delete | — | `readApiAcknowledgment(payload)` |

**Create body mapping**: trim names/email; blank middle name → `null`; `photoPath` from upload or `null`; `officeAddress` from the selected option label.

**Update body mapping**: same as create minus email; `photoPath` is the existing or newly uploaded id, or `null` when removed.

## Contract Guards

- `isReceptionistProfile(value: unknown): value is ReceptionistProfile`
- `isPagedReceptionistRows(value: unknown): value is PagedReceptionistRows`
- `isProfileId(value: unknown): value is string`
- `isOfficeList(value: unknown): value is readonly OfficeOption[]`
- `isFileId(value: unknown): value is string`

Guards never throw, never use `any`, and reject partial objects. `ApiContractError` is raised by `readApiEnvelope` when a successful envelope contains an unexpected payload.

## Constraints and Invariants

1. Every rendered row has a non-empty `id`; otherwise the list is a contract error, not a partially interactive table.
2. `isEditMode=false` and `profile=null` never coexist after loading completes.
3. Email has no validators in Edit mode and is never sent in the update body.
4. A save or delete never runs twice concurrently (`isSaving`/`deletingId` guards).
5. Cancel with Yes always discards local changes; stored data is untouched.
6. Delete with Yes removes the row only after a successful acknowledgment; on failure the row remains.
7. Generate password and credentials email are backend responsibilities; the UI never receives or displays a password.
