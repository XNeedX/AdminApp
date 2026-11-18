# Quickstart Validation: Clinic Services Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

Use this guide to prove the feature works end to end after implementation. It is a validation guide, not an implementation guide.

---

## 1. Prerequisites

| Requirement | How to check |
|---|---|
| Keycloak realm `InnoClinic` is running | `http://localhost:8080/realms/InnoClinic/.well-known/openid-configuration` returns 200 |
| Services API is running | `http://localhost:5095/swagger/v1/swagger.json` returns 200 |
| Gateway is running on HTTP | `http://localhost:5137/services/Service` returns `401` without a token (not `404`) |
| `testreceptionist` can sign in and holds the `Receptionist` role | Sign-in succeeds and `/doctors` opens |
| The generated Services client exists | `src/app/api/generated/services/` is present and `npm run api:services` regenerates it without errors |
| Contract gaps G1–G4 are closed | [contracts/services-api.contract.md](./contracts/services-api.contract.md) §5 |
| The specialization context page is available | The `/services` tab (`ServicesPageComponent`) lists a specialization's services and hosts "Add service" and row navigation |

If G1–G4 are not closed, only the UI-only scenarios in §4.1 can run; API scenarios are expected to fail.

---

## 2. Commands

Run from `E:\Innowise Project\Frontend\AdminApp\AdminApp`.

```powershell
# Install dependencies (first run)
npm install

# Regenerate the Services OpenAPI client (after the backend publishes typed responses)
npm run api:services

# Build (must be clean)
npm run build

# Unit tests (must be green)
npm test -- --watch=false

# Start the AdminApp
npm start
```

Expected: `npm run build` completes without errors, `npm test -- --watch=false` reports all tests passing, and `npm start` serves the app at `http://localhost:4200`.

---

## 3. Environment checks

```powershell
# Gateway reachability for the Services route (expect 401 without a token)
try {
  Invoke-WebRequest http://localhost:5137/services/Service -UseBasicParsing
} catch {
  $_.Exception.Response.StatusCode.value__   # expected: 401
}

# Services API definition
(Invoke-RestMethod http://localhost:5095/swagger/v1/swagger.json).paths.PSObject.Properties.Name
# expected to include /api/Service, /api/Service/{id}, /api/Service/{id}/status
```

---

## 4. Manual validation scenarios

Sign in as `testreceptionist` before starting.

### 4.1 UI-only checks (no backend required)

1. **Form validation (Create mode)** — open the creation form and blur every field without typing.
   - Name shows "Please, enter the name" with a red border.
   - Price shows "Please, enter the price" with a red border.
   - Category shows "Please, choose the service category" with a red border.
   - Status is "Active" and has no error.
   - "Confirm" is disabled.
2. **Price rule** — enter `0`, `-5`, `abc`, and `12.345`, blurring each time.
   - Each shows "You've entered an invalid price" and keeps "Confirm" disabled.
   - Enter `12.34`; the message disappears and "Confirm" enables once the other fields are valid.
3. **Mode labels** — the same form in Edit mode shows "Save changes" instead of "Confirm" and the same messages.
4. **Cancel dialog** — click "Cancel".
   - Create: "Do you really want to cancel? Entered data will not be saved." with "Yes"/"No".
   - Edit: "Do you really want to cancel? Changes will not be saved." with "Yes"/"No".
   - "No" keeps the form and the data; "Yes" discards.
   - The dialog traps focus, is keyboard operable, and does not close on backdrop click.

### 4.2 User Story 1 — Create a service

1. Open the `/services` tab, pick the specialization in the selector, then click "Add service".
2. Fill a unique name, a valid price, and a category; keep "Active".
3. Click "Confirm".
4. **Expected**: the dialog closes, the new service appears in the specialization's list, and a success toast is shown.
5. Repeat with "Inactive"; **expected**: the service is created with "Inactive".
6. Repeat, click "Cancel" → "Yes"; **expected**: no service is created and the previous page is shown.
7. Repeat, click "Cancel" → "No"; **expected**: the form still shows the entered data.

### 4.3 User Story 2 — View service information

1. Click a service row in the specialization's list.
2. **Expected**: `/services/:id` opens with name, price, category, and status in read-only form, plus an "Edit" button.
3. Verify that no field can be edited until "Edit" is clicked.
4. Open an "Inactive" service; **expected**: it is still visible to the Receptionist and shows "Inactive".

### 4.4 User Story 3 — Edit a service

1. Open a service and click "Edit".
2. **Expected**: fields become editable and are pre-filled; the footer shows "Save changes" and "Cancel".
3. Clear the name; **expected**: the inline message appears on blur and "Save changes" is disabled.
4. Enter valid values and click "Save changes"; **expected**: the page returns to View mode with the new values and a success toast, without a page reload.
5. Enter Edit again, change values, click "Cancel" → "No"; **expected**: still in Edit mode with the edits preserved.
6. Click "Cancel" → "Yes"; **expected**: back to View mode with the original values.
7. Simulate a failure (stop the Services API, then save); **expected**: Edit mode is kept, values are preserved, an error toast is shown, and retry works after the API is back.

### 4.5 User Story 4 — Change service status

1. Open a service in View mode and switch the status to "Inactive".
2. **Expected**: the radio updates immediately, a success toast is shown, and the value persists after a reload.
3. Verify in the patient-facing catalog that the service is no longer visible.
4. Switch back to "Active"; **expected**: the service reappears in the patient-facing catalog.
5. Simulate a failure (stop the Services API, then switch the status); **expected**: the radio rolls back to the previous value and an error toast is shown.
6. Select the status that is already set; **expected**: no request error and no unintended change.

### 4.6 Duplicate submission

1. With a slow network (DevTools throttling), click "Confirm"/"Save changes" several times quickly.
2. **Expected**: only one request is sent and only one service is created / one update is applied.

---

## 5. Expected outcomes summary

| Scenario | Pass condition |
|---|---|
| Create | Service appears in the list; no reload required |
| View | All four attributes and "Edit" are shown; read-only until Edit |
| Edit | View mode shows the saved values immediately |
| Cancel | "Yes" discards; "No" preserves |
| Status | Immediate persistence; patient catalog hides Inactive |
| Validation | Exact messages, red borders, disabled submit |
| Failures | Data preserved, toast shown, retry works |

---

## 6. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `403` on any Service call | Signed-in user lacks `Receptionist` | Re-login as `testreceptionist` |
| `401` on any Service call | Missing/expired token | Sign in again |
| `404` on `/services/Service` | Gateway route or service down | Check Gateway and Services API |
| Generated client has no response types | Contract gaps G1/G2 | Ask the backend team to publish typed responses, then regenerate |
| Status/category labels are numbers | Enum mapping not applied | Check `features/services/models/service.model.ts` |
| "Confirm" stays disabled with valid data | Hidden invalid control (e.g., category `''`) | Inspect the form group state in DevTools |
| Cancel dialog does not open | `Dialog` provider missing or CDK overlay CSS not imported | Check `app.config.ts` and global overlay styles |

---

## 7. Validation log (2026-11-12)

Environment checks (§3), run from `AdminApp/`:

| Check | Result |
|---|---|
| `GET http://localhost:8080/realms/InnoClinic/.well-known/openid-configuration` | 200 |
| `GET http://localhost:5095/swagger/v1/swagger.json` | 200 |
| `POST http://localhost:5137/services/Service` without a token | 401 (route reachable) |
| `GET http://localhost:5137/services/Service/{id}` without a token | 401 (route reachable) |
| `GET http://localhost:5137/services/Service` without a token | 405 (path exists, POST-only) |
| Generated client `src/app/api/generated/services/` | Present; `npm run api:services` regenerates it |
| Contract gaps G1–G3 | Open; bridged by the temporary overlay (T037 stays open) |
| Prerequisite specialization page | Delivered as the `/services` tab (2026-11-15); it was absent on 2026-11-12 |

Scenario results:

| Scenario | Result | Evidence / blocker |
|---|---|---|
| 4.1 Form validation, price rule, mode labels, cancel dialog | **Verified by automated tests** | `service-form.component.spec.ts` (11 tests), `cancel-confirm-dialog.component.spec.ts`, `positive-price.validator.spec.ts`. Not re-run in a browser session. |
| 4.2 Create a service | **Component-level verified** | `service-create-dialog.component.spec.ts` (6 tests) covers the POST body, success close, error toast, missing id, duplicate submit and Cancel Yes/No; the `/services` tab entry point is covered by `services-page.component.spec.ts`. Not yet re-run in a browser (T039). |
| 4.3 View service information | **Component-level verified** | `service-info.component.spec.ts` covers read-only rendering, Inactive service, 404 + retry; row navigation is covered by `services-page.component.spec.ts`. Not yet re-run in a browser (T039). |
| 4.4 Edit a service | **Component-level verified** | Pre-fill, invalid-name message, PUT body, return to View without reload, failure keeps Edit + values + retry, Cancel Yes/No, duplicate submit. |
| 4.5 Change service status | **Component-level verified** | Immediate PATCH with mapped value, optimistic UI, rollback + error toast, no-op for the current status, ignored while saving, no reload. Patient-facing catalog check not run. |
| 4.6 Duplicate submission | **Component-level verified** | `serviceIdPut` / `servicePost` called once for two rapid submits. No DevTools throttling run. |

Build and unit tests: `npm run build` succeeded; `npm test -- --watch=false` reported 21 files / 149 tests passing.

Remaining manual work (as of 2026-11-12; the entry points were delivered on 2026-11-15, so only a signed-in browser session remains): steps 4.2.1, 4.2.4–4.2.7, 4.3.1, 4.5.3–4.5.4, and the API-failure variants 4.4.7 / 4.5.5 against the live stack.

---

## 8. Validation log (2026-11-15, `/speckit.implement` pass)

| Check | Result |
|---|---|
| `npm test -- --watch=false` | 22 files / 159 tests passed |
| `npm run build` | clean; `dist/AdminApp` produced |
| `GET http://localhost:5095/swagger/v1/swagger.json` | reachable on the follow-up check; gaps G1–G3 confirmed still open (no response schemas, integer enums, `POST` documented `200`) — T037 stays open |
| Entry points | Delivered: `/services` tab (`ServicesPageComponent`) opens the create dialog (`T023`) and navigates rows to `/services/:id` (`T028`); `services-page.component.spec.ts` covers both |
| Browser scenarios §4.1–§4.6 | Not executed — no browser automation in this environment; requires an interactive signed-in `testreceptionist` session (T039 stays open) |

API-level end-to-end (Gateway `http://localhost:5137`, token from Keycloak for `testreceptionist`, role `Receptionist`):

| Step | Result |
|---|---|
| `GET /services/Specialization?Page=1&PageSize=50` | `200`, `{ data: { items, totalCount } }` |
| `GET /services/Specialization/{id}` | `200`, `{ data: { id, name, status, services: [...] } }` |
| `POST /services/Service` (valid body, `status: 1`) | `201 Created` + `{ data: "<new guid>", isSuccess: true }` |
| `GET /services/Service/{id}` | `200`, full DTO incl. `specializationId`, numeric `category`/`status` |
| `PUT /services/Service/{id}` | `204 No Content` |
| `PATCH /services/Service/{id}/status` (`0` → `1` → `0`) | `204`, value persists on re-read |
| `GET /services/Service/{missing guid}` | `404` + `{ isSuccess: false, errors: ["The service was not found."] }` |
| `POST /services/Service` (price `0`) | `400` + `errors: ["Please, enter the price"]` |
| CORS preflight `OPTIONS` from `http://localhost:4200` for GET/POST/PUT/PATCH | `204`, reflected method/headers/origin |
| `GET /api/Service/by-category/2` (patient catalog) | Inactive probe hidden; visible after switching it to Active; hidden again after switching back |
| `npm run api:services` against the live definition | succeeded — 17 models / 2 services; `npm test -- --watch=false` (159 tests) and `npm run build` still green afterwards |

Probe record created by the API check: `22dbe5e9-2299-4e8f-b8b4-08df430eaa42` (`speckit-create-check`, specialization `886d110b-…`, category `Diagnostics`, left `Inactive`). The Services API exposes no delete operation, so it cannot be removed through the Gateway; delete it from the Services database if the dev data must stay clean.
