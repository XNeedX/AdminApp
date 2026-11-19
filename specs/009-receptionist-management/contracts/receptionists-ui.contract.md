# UI Contract: Receptionist Management

**Feature**: `009-receptionist-management`
**Plan**: [plan.md](../plan.md)
**Spec**: [spec.md](../spec.md)

## Routes

| Route | Component | Guards | Purpose |
|-------|-----------|--------|---------|
| `/receptionists` | `ReceptionistsPageComponent` (lazy) | `authGuard`, `roleGuard('Receptionist')` | Directory, create entry point, delete |
| `/receptionists/:id/profile` | `ReceptionistProfilePageComponent` (lazy) | `authGuard`, `roleGuard('Receptionist')` | Read-only profile + in-place edit |

Both routes are children of the existing authenticated shell in `app.routes.ts`. The header receives an additional nav item `{ label: 'Receptionists', path: '/receptionists' }` when the user has the `Receptionist` role.

## Component Contracts

### `ReceptionistFormComponent` (dumb)

Standalone, `OnPush`, imports `ReactiveFormsModule`, injects nothing.

| Member | Kind | Type | Notes |
|--------|------|------|-------|
| `form` | input (required) | `FormGroup<ReceptionistFormGroup>` | Host-owned |
| `isEditMode` | input | `boolean` (default `false`) | When `true`, the email field is not rendered |
| `offices` | input | `readonly OfficeOption[]` | Dropdown options |
| `photoPreview` | input | `string \| null` | Current or locally selected image URL |
| `photoError` | input | `string \| null` | Local file validation message |
| `formError` | input | `string \| null` | Server/form-level error alert |
| `isSubmitting` | input | `boolean` | Disables both buttons |
| `canSubmit` | input | `boolean` | Enables the primary button |
| `submitted` | output | `void` | Host submits |
| `cancelled` | output | `void` | Host opens or skips confirmation |
| `photoSelected` | output | `File` | Host validates and previews |
| `officeSelected` | output | `OfficeOption` | Host fills `officeId` + `officeText` |
| `photoCleared` | output | `void` | Removes the selected photo |

**Rendering rules**
- Mode labels: primary is `Confirm` when `isEditMode=false`, `Save changes` when `true`. Secondary is always `Cancel`.
- Email block is wrapped in `@if (!isEditMode())` and is never rendered in edit mode.
- Required fields show a red asterisk; errors show a red border plus the exact inline message on blur/touched.
- The office control is a native `<select>` bound to `officeText`, with an empty "Select an office" option; selecting emits `officeSelected`.
- The photo uploader shows the preview, an optional file input (`accept="image/jpeg,image/png,image/webp"`), a Remove action when a photo exists, and the inline `photoError`.
- Footer uses `flex-col-reverse` on mobile and right-aligned buttons from `sm:` upward.
- All inputs are labelled, errors are linked with `aria-describedby`, invalid inputs set `aria-invalid`, and the submit button reflects `aria-busy` while submitting.

### `ReceptionistTableComponent` (dumb)

| Member | Kind | Type |
|--------|------|------|
| `rows` | input (required) | `readonly ReceptionistRow[]` |
| `isLoading` | input | `boolean` |
| `loadError` | input | `string \| null` |
| `deletingId` | input | `string \| null` |
| `profileRequested` | output | `string` (id) |
| `deleteRequested` | output | `ReceptionistRow` |
| `retryRequested` | output | `void` |

**Rendering rules**
- Exactly two data columns: `Full name`, `Office address`, plus an unlabeled actions column.
- Full name is a button that emits `profileRequested(row.id)`; the row itself is also activatable for the same intent.
- Each row actions cell contains a profile icon button (`aria-label="Open profile of {fullName}"`) and a `Delete` button (`aria-label="Delete {fullName}"`). The Delete button calls `stopPropagation` so it never opens the profile.
- `Delete` is disabled only for the row whose `id === deletingId`; other rows remain usable.
- Loading, error + `Try again`, and empty state ("No receptionists found" + hint) replace the table body; the page-level Create action stays outside this component.
- Long names/addresses wrap with `break-words`; the table scrolls horizontally on narrow screens.

### `ReceptionistProfileViewComponent` (dumb)

| Member | Kind | Type |
|--------|------|------|
| `profile` | input (required) | `ReceptionistProfile \| null` |
| `edit` | output | `void` |

Renders the photo (or initials placeholder), first name, last name, middle name (`—` when absent), office, and an `Edit` button. No email field (create-only). No services or state.

### `ReceptionistCreateDialogComponent` (smart host)

Opened with `Dialog.open<ReceptionistCreateDialogResult>(ReceptionistCreateDialogComponent, { disableClose: true, restoreFocus: true, ariaLabel: 'Create receptionist', width: 'min(48rem, calc(100vw - 2rem))', maxHeight: '90vh' })`.

| Member | Type | Notes |
|--------|------|-------|
| `form` | `FormGroup<ReceptionistFormGroup>` | Built in the host with create validators |
| `isEditMode` | `false` (constant) | Keeps email visible |
| `isSubmitting` | `signal<boolean>` | Prevents duplicate POST |
| `serverError` | `signal<string \| null>` | Form-level alert |
| `photoPreview` / `photoError` | `signal<string \| null>` | Local preview and file validation |
| `offices` | from `ReceptionistCatalogStore` | Loaded in `ngOnInit` |
| `result` | `ReceptionistCreateDialogResult` | `{ created: ReceptionistCreatedSummary \| null }` |

**Flow**
1. Host loads offices once.
2. User fills the form; CanSubmit requires `VALID`, no photo error, not submitting.
3. Submit uploads the photo (if any), then POSTs; success closes with `{ created: { id, fullName, officeAddress } }`.
4. Cancel always opens the create-cancel confirmation; Yes closes with `{ created: null }`, No stays.
5. On 409, sets `emailTaken` and keeps values; on other failures, shows the message and preserves values.

### `ReceptionistsPageComponent` (smart)

| Member | Kind | Type |
|--------|------|------|
| `rows` | computed | `ReceptionistRow[]` |
| `isLoading` / `loadError` | signal | load state |
| `deletingId` | signal | `string \| null` |
| `openCreateDialog()` | method | Opens the CDK create dialog |
| `openProfile(id)` | method | `router.navigate(['/receptionists', id, 'profile'])` |
| `requestDelete(row)` | method | CDK confirm → store delete |

**Behavior**
- `ngOnInit` calls `directory.loadAll()`.
- Dialog result with `created !== null` shows a success toast and reloads or upserts the row.
- Delete: exact dialog copy; Yes calls `directory.delete(row.id)`; success removes the row and shows a toast; failure keeps the row and shows an error toast; No closes with no change.
- The page header contains the title and the `Create receptionist` button; the button remains in empty and error states.

### `ReceptionistProfilePageComponent` (smart)

| Member | Kind | Type |
|--------|------|------|
| `profile` | signal | `ReceptionistProfile \| null` |
| `isEditMode` | signal | `boolean` (starts `false`) |
| `isLoading` / `isSaving` / `loadError` / `formError` | signal | state |
| `form` | `FormGroup<ReceptionistFormGroup>` | Edit form |
| `canSubmit` | computed | `VALID && !isSaving() && !photoError()` |
| `enterEdit()` | method | Reset form from profile, set `isEditMode(true)` |
| `save()` | method | PUT, update signals, View mode |
| `cancelEdit()` | method | CDK confirm, then reset/View on Yes |
| `backToList()` | method | Navigate to `/receptionists` |

**View ↔ Edit contract**
- View mode renders `ReceptionistProfileViewComponent` and no form.
- Edit mode renders `ReceptionistFormComponent` with `isEditMode=true`; email is absent.
- `enterEdit` pre-fills photo (existing URL), names, middle name, and office.
- Save success: profile signal is updated with trimmed values, `isEditMode(false)`, success toast; no manual reload required.
- Save failure: stay in Edit, keep values and photo, show `formError` and an error toast.
- Cancel → Yes: reset form to stored values, clear errors, `isEditMode(false)`; stored data untouched.
- Cancel → No: dialog closes, Edit stays with all values.
- Load 404: "Receptionist not found." plus a back action. Other load failures: error message plus retry.

## Copy Contract (must not be reworded)

| Context | Exact copy |
|---------|-----------|
| Create cancel message | "Do you really want to cancel? Entered data will not be saved." |
| Edit cancel message | "Do you really want to cancel? Changes will not be saved." |
| Delete message | "Do you really want to delete? Data will be lost." |
| Confirm button | "Yes" |
| Decline button | "No" |
| Create primary | "Confirm" |
| Edit primary | "Save changes" |
| Secondary | "Cancel" |
| Page create action | "Create receptionist" |
| Profile action | "Edit" |
| First name required | "Please, enter the first name" |
| Last name required | "Please, enter the last name" |
| Email required | "Please, enter the email" |
| Email invalid | "You've entered an invalid email" |
| Email duplicate | "User with this email already exists" |
| Office required | "Please, choose the office" |
| Photo invalid | "Choose a JPEG, PNG or WebP image up to 5 MB" |
| Name too long (proposed) | "{Field} must be 100 characters or fewer" |
| Email too long (proposed) | "Email must be 256 characters or fewer" |
| No offices available (proposed copy) | "Create an office before adding a receptionist." |
| Table headers | "Full name", "Office address" |

Copy constants live in `models/receptionist-form.model.ts` (validation/messages) and `models/receptionist-dialog.model.ts` (dialog payloads) so tests and templates share one source.

## Acceptance Mapping

| Spec | UI surface | Contract |
|------|------------|----------|
| US1 / AC-1..4 | `/receptionists` header + table | Two columns, Delete per row, Create on page |
| US1 / AC-5..8 | Table states | Full name composition, empty state, reload |
| US2 / AC-1..2 | Create dialog + form | Fields and buttons exactly as specified |
| US2 / AC-3, F-2..F-6 | Form validity | `canSubmit` and validation matrix in [data-model.md](../data-model.md) |
| US2 / AC-4..8 | Create submit | Generated POST, credentials email side effect, list refresh |
| US2 / AC-9..11 | Create cancel | CDK confirmation with exact copy |
| US3 / AC-1..10 | List row + profile page | Row/profile-icon navigation, read-only fields, Edit |
| US4 / AC-1..16 | Profile View↔Edit | Signals, shared form, Save/Cancel flows |
| US5 / AC-1..8 | Table Delete | CDK confirmation, delete, row removal, error handling |

## Accessibility Contract

- Confirmation dialogs trap focus, restore focus to the trigger, and resolve `false` when Escape is pressed inside the dialog; the create dialog uses `disableClose` and requires an explicit Cancel or successful submit.
- Table row actions are real buttons with accessible names; the table has a `<caption class="sr-only">` describing the two columns.
- Form errors are announced through `role="alert"` alerts and referenced by `aria-describedby`.
- The submitting state sets `aria-busy` and disables both footer buttons.
- Focus order follows photo → first name → last name → middle name → email (create only) → office → Cancel → primary.
- Color is never the only signal: errors include text, and the delete confirmation includes an explicit consequence.

## Navigation and Abandonment

- Leaving through the menu, browser back, or reload discards unsaved values without a prompt; only the explicit "Cancel" action opens the confirmation dialog.
- The create dialog uses `disableClose`, so Escape and backdrop clicks do not dismiss it; the user must choose Cancel → Yes or complete the form.
- The profile page's back action returns to `/receptionists` without discarding anything in View mode; in Edit mode, leaving through navigation is treated the same as the spec's general abandonment rule (no prompt).
