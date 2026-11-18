# Quickstart Validation: Specialization Management

**Feature**: `008-specialization-management` | **Date**: 2026-11-18

Use this guide to prove the feature works end to end after implementation. It contains commands and
expected outcomes, not implementation code.

---

## 1. Prerequisites

- Node.js and npm 11+ (project pins `npm@11.6.0`).
- The Services API and Gateway reachable at the URLs configured in the AdminApp environment.
- A seeded Receptionist account (`roleGuard('Receptionist')` protects both routes).
- At least one specialization with one or more services, and one without services, for the empty
  state checks.

## 2. Setup

```powershell
cd AdminApp
npm ci
```

If the backend contract was updated for gates G-1/G-2 (see `plan.md`), regenerate the client first:

```powershell
npm run api:services
```

Do not hand-edit anything under `src/app/api/generated/`.

## 3. Run

```powershell
npm start          # dev server
npm test           # Vitest suites
npm run build      # production build must succeed with strict templates
```

Expected: the build passes with no `any`, no template type errors, and no new warnings.

---

## 4. Manual Validation Scenarios

### V1 - List (US1)

1. Sign in as a Receptionist and click "Specializations" in the header.
2. Expect a table with exactly two columns: "Specialization Name" and "Status", both Active and
   Inactive specializations listed, sorted alphabetically.
3. Each row's Status cell shows an Active/Inactive radio pair with the stored value selected.
4. "Create specialization" is visible.
5. Click a row (not its radios) -> the detail page opens.
6. Stop the API and reload -> a retryable error state appears; restart and press Retry -> the list
   loads.

### V2 - Create (US2)

1. Click "Create specialization". Expect a dialog with Name, an Active/Inactive pair ("Active"
   selected), an empty services table with columns "Service Name", "Price", "Status",
   "Service Category", plus "Add service", "Confirm", "Cancel".
2. Confirm "Confirm" is disabled while the name is empty and while the table has no rows.
3. Click "Add service" -> one editable row appears with empty name/price, no category, status
   "Active". Click "Add service" again -> a second row appears.
4. Leave Name empty and focus away -> red border + `Please, enter the name`.
5. Leave a service name empty, price empty, price `0`, price `-5`, price `abc`, and category
   unselected -> the four exact messages from `contracts/ui-contracts.md` appear, and "Confirm"
   stays disabled.
6. Enter a valid name and one complete service row -> "Confirm" enables. Click it -> success toast,
   dialog closes, the new specialization is in the list.
7. Reopen, add a row, click "Cancel" -> `Do you really want to cancel? Entered data will not be
   saved.` Choose "No" -> form intact. Choose "Cancel" then "Yes" -> list shown, nothing saved.
8. Double-click "Confirm" on a valid form -> exactly one specialization exists afterwards.
9. Force an API failure (stop the API) and submit -> the form stays open with all values and an
   error appears; restart and retry -> no duplicate specialization or services.

### V3 - Detail view (US3)

1. Open a specialization from the list. Expect name, status and a services table with
   "Service Name", "Price", "Status", "Service Category", including Inactive services.
2. Expect an "Edit" button; no field is editable and no "Add service" is shown.
3. Open a specialization with no services -> empty-services message, "Edit" still available.
4. Navigate to `/specializations/<random-uuid>` -> `Specialization not found.` with a way back.

### V4 - Edit (US4)

1. Click "Edit". Expect the name to become editable, rows editable, "Add service" visible, and
   "Save changes" + "Cancel" in place of "Edit".
2. Clear the name -> "Save changes" disabled; blur shows `Please, enter the name`.
3. Add a row and discard it -> the stored services are unchanged.
4. Change name and a service price, click "Save changes" -> success toast, View mode shows the new
   values, and a reload preserves them.
5. Enter Edit, change values, click "Cancel" -> `Do you really want to cancel? Changes will not be
   saved.` "No" keeps edits; "Yes" returns to View mode with stored values.
6. In Edit mode change the specialization status, then "Cancel" -> "Yes" -> status is unchanged
   (staged change discarded).
7. In Edit mode change the status and "Save changes" -> the staged status persists.

### V5 - Status and cascade (US5)

1. Change a specialization to "Inactive" from the list -> no dialog, status updates immediately,
   success toast; reload keeps "Inactive".
2. Open a related doctor and a related service -> both show "Inactive" (depends on backend gate
   G-4; if they remain Active, record the backend gap, the UI is behaving correctly).
3. Change the specialization back to "Active" -> doctors and services stay "Inactive".
4. Stop the API, change a status -> the radio reverts, an error toast appears, and no dependent
   record changes.
5. Select the already-selected status -> no request, no toast, no error.

### V6 - Access, keyboard, responsiveness (cross-cutting)

1. Sign in as a Doctor or Patient -> no "Specializations" nav item; direct URL access is rejected.
2. Complete V1-V5 with the keyboard only (Tab/Shift+Tab, arrows within radio groups, Enter/Space).
3. Narrow the window to a mobile width -> layouts remain usable and the services table scrolls
   horizontally.

---

## 5. Automated Coverage Map

| Suite | Proves |
|-------|--------|
| `specialization-form.component.spec.ts` | `FormArray` starts empty; push/remove; `canSubmit` false when `length === 0`; exact messages; defaults |
| `specialization-create-dialog.component.spec.ts` | Create ordering, duplicate-submit guard, cancel Yes/No, partial-failure retry |
| `specializations-page.component.spec.ts` | Mapping/sorting, empty/error/retry, immediate status + rollback, in-flight guard, navigation |
| `specialization-info.component.spec.ts` | Load/not-found/error, Edit pre-fill, save, cancel Yes/No, staged vs immediate status |
| `specialization-writer.service.spec.ts` | Call sequence, idempotent retry, no deletes, partial state |
| `specialization.model.spec.ts` | Enum mapping, payload mapping, rejection of incomplete payloads |

Run one suite:

```powershell
npx vitest run src/app/features/specializations
```

---

## 6. Definition of Done

- `npm run build` passes.
- All suites above pass.
- V1-V5 pass end to end; V5 cascade passes only once backend gate G-4 is closed.
- No request is made through anything other than the generated Services API client.
- No `any`, no `NgModule`, no hand-written DTOs, every new component is standalone with `OnPush`.
