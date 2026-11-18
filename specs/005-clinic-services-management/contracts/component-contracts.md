# Contract: UI Components (Services feature)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

This contract fixes the public API of every component the feature introduces or changes. It exists so the components can be built and tested independently and so the dumb/smart boundary is unambiguous.

---

## 1. `ServiceFormComponent` — dumb, reusable (Create + Edit)

**Path**: `src/app/features/services/components/service-form/service-form.component.ts`
**Selector**: `app-service-form`
**Standalone**: yes · **Change detection**: `OnPush`
**Dependencies**: `ReactiveFormsModule` only. Must NOT inject API services, router, dialogs, or notifications.

### Inputs

| Input | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `'create' \| 'edit'` | `'create'` | Selects the submit button label: "Confirm" for create, "Save changes" for edit. |
| `initialValue` | `ServiceFormValue \| null` | `null` | Pre-fills the form in edit mode; ignored/empty in create mode. |
| `submitting` | `boolean` | `false` | Disables the footer buttons and the fields while a request is in flight. |

### Outputs

| Output | Payload | When |
|---|---|---|
| `submitted` | `ServiceFormValue` | The user activates "Confirm"/"Save changes" with a valid form. |
| `cancelled` | `void` | The user activates "Cancel". The parent decides whether to show a confirmation dialog. |

### Behavior contract

- Renders exactly: service name (text), price (number), service category (dropdown), status (radio `Active`/`Inactive`).
- Footer: `mode === 'create'` → "Confirm" + "Cancel"; `mode === 'edit'` → "Save changes" + "Cancel".
- Submit is disabled while the form is `INVALID` or `submitting` is `true`.
- Error border and message appear only when the control is `touched`.
- Messages are exactly those in [data-model.md](../data-model.md) §4.
- Status defaults to `Active` when `initialValue` is `null`.
- The component never trims or otherwise mutates values before emitting, except that the emitted `name` is trimmed.

---

## 2. `ServiceInfoComponent` — smart page (View / Edit / Status)

**Path**: `src/app/features/services/pages/service-info/service-info.component.ts`
**Selector**: `app-service-info`
**Route**: `/services/:id` (guarded by `roleGuard('Receptionist')`)
**Standalone**: yes · **Change detection**: `OnPush`

### Injected collaborators

- Generated Services API client (create/read/update/status).
- `ActivatedRoute`, `Router`, `Dialog`, `NotificationService`, `DestroyRef`.

### State (signals)

`service`, `isEditMode`, `isLoading`, `isSaving`, `statusSaving`, `loadError` — see [data-model.md](../data-model.md) §5.

### Behavior contract

- On init, loads the service by route id; a `404` shows "Service not found." and a retry action.
- View mode renders the read-only fields and the "Edit" button (FR-013…FR-016).
- "Edit" sets `isEditMode` to `true` and mounts `ServiceFormComponent` with `mode="edit"` and `initialValue` from the loaded service.
- `submitted` → PUT; success updates `service`, flips `isEditMode` to `false`, shows a success toast; failure keeps Edit mode and shows an error toast (FR-021, FR-025).
- `cancelled` → opens `CancelConfirmDialogComponent` with the edit message; `true` → View mode without saving; `false` → stay in Edit mode with data preserved (FR-022…FR-024).
- View mode status radio → immediate PATCH, optimistic update, rollback + error toast on failure (FR-027, FR-030).
- Repeated submits are ignored while `isSaving` is `true` (FR-026).

### Template composition

`ServiceInfoComponent` (smart) → `ServiceFormComponent` (dumb, edit mode) and the read-only view markup. No business logic in the dumb component.

---

## 3. `ServiceCreateDialogComponent` — smart dialog host (Create)

**Path**: `src/app/features/services/dialogs/service-create-dialog/service-create-dialog.component.ts`
**Opened via**: `Dialog.open<ServiceCreateDialogResult | null, ServiceCreateDialogData>(ServiceCreateDialogComponent, { data: { specializationId }, disableClose: true, ariaLabelledBy, restoreFocus: true })`

### Injected collaborators

- Generated Services API client (create).
- `DialogRef<ServiceCreateDialogResult | null>`, `DIALOG_DATA`, `Dialog`, `NotificationService`.

### Behavior contract

- Hosts `ServiceFormComponent` with `mode="create"` and `initialValue = null`.
- `submitted` → create request with `specializationId` from `DIALOG_DATA`; success closes the dialog with `{ id }`; failure keeps the dialog open with the data preserved and shows an error toast (FR-007, FR-025).
- `cancelled` → opens `CancelConfirmDialogComponent` with "Do you really want to cancel? Entered data will not be saved."; `true` → close with `null` (the caller returns to the previous page); `false` → stay with data (FR-008…FR-010).
- Repeated submits ignored while a request is in flight (FR-026).

---

## 4. `CancelConfirmDialogComponent` — shared dumb dialog

**Path**: `src/app/shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component.ts`
**Opened via**: `Dialog.open<boolean, CancelConfirmDialogData>(...)`

### Inputs via `DIALOG_DATA`

| Field | Type | Default |
|---|---|---|
| `message` | `string` | required |
| `confirmText` | `string` | `"Yes"` |
| `cancelText` | `string` | `"No"` |

### Output

`DialogRef<boolean>`: `true` on "Yes", `false` on "No". `disableClose: true` keeps the dialog open on backdrop click/Escape.

### Messages

- Create: "Do you really want to cancel? Entered data will not be saved."
- Edit: "Do you really want to cancel? Changes will not be saved."

---

## 5. Integration point with the prerequisite specialization page

The specialization page (delivered as the `/services` tab, `ServicesPageComponent`) owns the services list and must:

1. Render an "Add service" action that calls
   `openServiceCreateDialog(dialog, specializationId)` from
   `src/app/features/services/utils/open-service-create-dialog.ts`
   (a thin wrapper over `Dialog.open<ServiceCreateDialogResult | null, ServiceCreateDialogData>`)
   and reload the list when the emitted result is non-null.
2. Make each service row navigate to `/services/:id`.

This feature does not render the service list itself beyond that page's read-only table; the integration contract is the two calls above. See [quickstart.md](../quickstart.md) for the end-to-end validation steps.

**Integration status as delivered (2026-11-15)**: the prerequisite surface is delivered as the Services tab — `src/app/features/services/pages/services-page/` (`ServicesPageComponent`), routed at `/services` behind `roleGuard('Receptionist')` and linked from the header for signed-in Receptionists. It selects a specialization, lists that specialization's services, and therefore owns both entry points:

- "Add service" → `openCreate()` calls `openServiceCreateDialog(dialog, selectedSpecializationId())`, shows the success toast, and reloads the list when the result is non-null (T023).
- Per-row "View" → `openService(id)` navigates to `/services/:id` (T028).

The create entry point is ready as `openServiceCreateDialog(dialog, specializationId): Observable<ServiceCreateDialogResult | null>` (emits `{ id }` on success, `null` on cancel); the view entry point is the lazy route `/services/:id`. Component-level behavior is covered by `service-create-dialog.component.spec.ts` (6 tests), `service-info.component.spec.ts` (20 tests) and `services-page.component.spec.ts` (10 tests); the full suite is 22 files / 159 tests, and `npm run build` is clean.

**Resolved deviations**: the spec's "Specialization info" page arrives as the `/services` tab (specialization selector + service table) rather than a per-specialization detail route. The wiring contract in items 1–2 above is satisfied by that page; no other page is required.

---

## 6. Accessibility contract

- Every input has a `<label for>` and an `aria-describedby` pointing at its error message when invalid.
- The status radio group uses a `<fieldset>`/`<legend>` or `role="radiogroup"` with an accessible name.
- Error messages are rendered with `role="alert"` or `aria-live="polite"` so screen readers announce them.
- The CDK dialogs provide focus trap, initial focus, and focus restoration; `ariaLabelledBy` points at the dialog message.

Verified in T035 (2026-11-12): the form controls carry `aria-required`, `aria-invalid` and `aria-describedby`; the status group in both View and Edit modes is a `<fieldset>` with a `<legend>`; the view-mode status fieldset exposes `aria-busy` plus a `role="status"` "Saving status…" line; loading uses `role="status"` and load errors use `role="alert"`.
