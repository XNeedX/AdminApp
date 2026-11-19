# Quickstart Validation Guide: Receptionist Management

**Feature**: `009-receptionist-management`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This guide proves the feature end-to-end. It is a validation runbook, not an implementation reference; models and component contracts live in [data-model.md](./data-model.md) and [contracts/](./contracts/).

## Prerequisites

1. The backend stack is running: Profiles API (Swagger at `http://localhost:5154`), Appointments API (Swagger at `http://localhost:5203`), Documents API, Gateway at `http://localhost:5137`, Keycloak at `http://localhost:8080`.
2. A Receptionist account exists and can sign in to the admin app.
3. At least two offices exist in the office catalog.
4. `AdminApp/AdminApp/node_modules` is installed (`npm install`).
5. The Profiles client has been regenerated **after** the backend `ReceptionistProfileDto` exposes `id` (CG-1). Without this, the list cannot navigate or delete and the manual scenarios below will correctly fail.

## Setup and Generation

Run from `AdminApp/AdminApp`:

```powershell
# Regenerate the Profiles client with receptionist response schemas
npm run api:profiles

# Regenerate the Appointments client when the office catalog changes
npm run api:appointments

# New: generate the Documents client for photo upload/delete
npm run api:documents
```

Expected: the scripts write `openapi/*.openapi.json`, regenerate `src/app/api/generated/{profiles,appointments,documents}`, and finish without schema errors. The generated `ReceptionistsService` methods must return the envelope type (not `void`).

> If the backend is not reachable, pass a local swagger file to the augment script (for example `node scripts/augment-profiles-openapi.mjs path/to/swagger.json`) before running `ng-openapi-gen`.

## Run

```powershell
npm start
```

Open the dev server URL, sign in as a Receptionist, and verify the "Receptionists" item appears in the primary navigation.

## Automated Checks

```powershell
npm test
npm run build
```

Expected:
- All feature specs pass (guards, mappers, store, form, table, pages, dialogs).
- No strict-template or `any` violations.
- The production build succeeds.

Suggested focused runs:

```powershell
npx vitest run src/app/features/receptionists
npx vitest run src/app/features/receptionists/services/receptionist-contract.guards.spec.ts
npx vitest run src/app/features/receptionists/components/receptionist-form
```

## Manual Validation Scenarios

### V-01 — Directory (US1)

1. Click "Receptionists" in the primary navigation.
2. Confirm the page shows a table with exactly "Full name" and "Office address" columns.
3. Confirm every row has a profile action and a "Delete" button.
4. Confirm the page has a "Create receptionist" button.

**Expected**: no extra data columns, rows match stored profiles, office addresses are correct, empty database shows an empty state with Create still available.

### V-02 — Create validation (US2, F-1..F-6)

1. Click "Create receptionist".
2. Leave each required field empty and blur it.
3. Enter `not-an-email` and blur.
4. Select a valid office, names, and email, then try a photo that is a PDF or larger than 5 MB.
5. Enter an email that already belongs to a user and submit.

**Expected messages**: "Please, enter the first name", "Please, enter the last name", "Please, enter the email", "You've entered an invalid email", "Please, choose the office", the photo message, and "User with this email already exists". Confirm is disabled for every invalid state, including while a local photo error is present. Accepting a JPEG/PNG/WebP photo shows a preview and removes the photo error.

### V-03 — Create success and cancel (US2, AC-4..AC-11)

1. Fill valid first name, last name, optional middle name, unique email, and office; optionally attach a photo.
2. Click "Confirm".
3. Verify the profile appears in the list and the credentials email arrives at the entered address.
4. Open the dialog again, type values, click "Cancel".
5. Verify the dialog "Do you really want to cancel? Entered data will not be saved." with Yes/No.
6. Choose "No" and verify all values and the photo remain.
7. Click "Cancel" again, choose "Yes", and verify the Receptionists page is shown and no profile was created.

**Expected**: one POST per Confirm click; no duplicate rows on repeated clicks; no password visible anywhere in the UI.

### V-04 — Profile view and navigation (US3)

1. Click a row; verify the profile page opens.
2. Return to the list and click the row's profile icon; verify the same profile opens.
3. Verify photo/placeholder, first name, last name, middle name (or "—"), and office are displayed.
4. Verify an "Edit" button is present and no field is editable.

**Expected**: both entry points reach `/receptionists/:id/profile`; no email is shown; reload keeps the stored values.

### V-05 — Edit and cancel (US4)

1. On the profile page, click "Edit".
2. Verify the fields are pre-filled and editable, email is absent, and buttons are "Save changes" and "Cancel".
3. Clear the first name; blur.
4. Verify "Save changes" is disabled and "Please, enter the first name" appears with a red border.
5. Restore a valid name, change the office and photo, click "Save changes".
6. Verify View mode shows the updated values immediately, without reload, and the list reflects them after navigating back.
7. Re-enter Edit, change values, click "Cancel", choose "No"; verify Edit remains with values.
8. Click "Cancel" again, choose "Yes"; verify View mode shows the stored values and no changes were saved.

**Expected**: exactly one PUT per Save; cancel Yes discards, cancel No preserves; photo replace/remove is persisted.

### V-06 — Delete (US5)

1. On the list, click "Delete" on a row.
2. Verify the dialog "Do you really want to delete? Data will be lost." with Yes/No.
3. Choose "No"; verify the row remains and no request is sent.
4. Click "Delete" again, choose "Yes".
5. Verify the row disappears, reload keeps it absent, and the profile URL now shows "Receptionist not found."
6. Verify the deleted user can no longer sign in and the stored photo is no longer served.

**Expected**: exactly one DELETE per confirmation; on failure the row remains with an error toast and a retry path; deleting the last row shows the empty state with Create available.

### V-07 — Error and contract handling

1. Stop the Profiles API and reload the list.
2. Verify the inline load-error state with "Try again" instead of an empty table.
3. Start the API and retry; verify the table returns.
4. Simulate a malformed profile payload (e.g., missing `id`); verify the guard produces a contract error state rather than a row with broken actions.

**Expected**: no unhandled exceptions, no partial rows, retries work, and the user always has a way back.

## Exit Criteria

- [ ] All V-01..V-07 scenarios pass.
- [ ] SG-1 (id in `ReceptionistProfileDto`) is resolved and the Profiles client regenerated.
- [ ] `ReceptionistsService` returns typed envelopes, not `void`.
- [ ] Documents client is generated and photo upload/delete works through it.
- [ ] `npm test` and `npm run build` pass with no `any`, no manual HTTP, and no `@apply`.

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| List renders but rows have no actions | Generated client still returns `void` or the DTO lacks `id` | Resolve CG-1/CG-2 and regenerate |
| Office dropdown is empty | `OfficesService` call failed or catalog guard rejected the payload | Check the Appointments client and the network response; retry |
| Photo upload method missing | Documents client not generated | Run `npm run api:documents` after adding the overlay/config |
| 409 on a unique email | Email already used case-insensitively | Use a different address; verify the message attaches to the email field |
| Cancel does not prompt | The flow copied the doctor "pristine form" shortcut | Always confirm on Cancel, per this feature's spec |
| Dialog cannot be dismissed with Escape | `disableClose` is expected | Use Yes/No; Escape resolves to No/false |
