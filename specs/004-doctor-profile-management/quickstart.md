# Quickstart: Doctor Profile Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/profile-api.contract.md](./contracts/profile-api.contract.md)

This guide validates the feature end-to-end. It assumes the backend prerequisites from `contracts/profile-api.contract.md` (E1 account lookup, widened E2) are available. The frontend client is hand-written and typed; no regeneration step is needed.

---

## 1. Prerequisites

| Item | Requirement |
|---|---|
| Node.js | 20 LTS or newer |
| npm | 11.x (project pins `npm@11.6.0`) |
| Angular CLI | Local via `npx ng` / `npm start` |
| Backend | Gateway + Profiles + Offices + Services + Documents + Keycloak running in Docker |
| Accounts | One `Doctor` account and one `Receptionist` account, both with a permitted status |
| API client | Hand-written, strictly typed (`src/app/api/`); no generator step |
| Account link | `DoctorProfile.AccountId` populated with the Keycloak `sub` of the test doctor |

If E1 or the widened E2 is missing, the profile page and the status select cannot be validated; see the blocking note in the plan.

---

## 2. Setup

Run from the repository root (`E:\Innowise Project\Frontend\AdminApp`):

```powershell
cd AdminApp
npm install
npm install @angular/cdk@^21.2.0
```

Add the CDK overlay styles to `AdminApp/src/styles.css`:

```css
@import 'tailwindcss';
@import '@angular/cdk/overlay-prebuilt.css';
```

Start the app:

```powershell
npm start
```

The dev server prints the local URL (typically `http://localhost:4200`).

---

## 3. Automated checks

| Command | Purpose |
|---|---|
| `npm test` | Vitest unit/component suite |
| `npm run build` | Production build; fails on strict template/type errors and budget overruns |

Expected:
- Zero TypeScript errors under `strict: true`.
- Zero `any` in the new code.
- All new specs pass.

Suggested focused specs (created during implementation):

```text
src/app/features/profile/pages/profile-page/profile-page.component.spec.ts
src/app/features/profile/components/profile-edit/profile-edit.component.spec.ts
src/app/features/doctors/pages/doctors-page/doctors-page.component.spec.ts
src/app/shared/components/autocomplete/autocomplete.component.spec.ts
src/app/core/guards/role.guard.spec.ts
```

---

## 4. Manual validation — Doctor (US1, US2)

Sign in as a Doctor.

### 4.1 View own profile (US2)

1. Click the profile icon in the header.
2. Expected: the profile page opens in View mode and shows photo, first name, last name, middle name, date of birth, specialization, office, career start year, status, and an "Edit" button.
3. Try to change a field with the mouse/keyboard.
4. Expected: fields are read-only until "Edit" is clicked.

### 4.2 Enter Edit mode (AC-1, AC-2)

1. Click "Edit".
2. Expected:
   - Every field becomes editable and is pre-filled with the stored values.
   - The footer shows "Save changes" and "Cancel".
   - "Save changes" is enabled if all required values are valid.

### 4.3 Required-field validation (AC-3, F-2…F-8)

For each field below, clear it and blur:

| Field | Expected red border + message |
|---|---|
| First name | `Please, enter the first name` |
| Last name | `Please, enter the last name` |
| Date of birth | `Please, select the date` |
| Specialization | `Please, choose the specialisation` |
| Office | `Please, choose the office` |
| Career start year | `Please, select the year` |

Expected: while any required field is empty or invalid, "Save changes" is disabled.

Specialization-specific:
- Type a value that is not in the catalog, then blur → `Invalid specialization name`.
- Select a value from the filtered list → the field fills and the error clears.

Office-specific:
- Type to filter the list; select an entry → the field fills.
- Clear the field and blur → `Please, choose the office`.

### 4.4 Date boundaries (AC-5)

1. Set Date of birth to today → accepted.
2. Set Date of birth to tomorrow → rejected (`Date cannot be in the future`), save disabled.
3. Set Career start year to the current year → accepted.
4. Set Career start year to next year → rejected (`Year cannot be in the future`), save disabled.

### 4.5 Save (AC-4)

1. With all required fields valid, change the middle name and the status.
2. Click "Save changes".
3. Expected:
   - A success notification appears.
   - The page returns to View mode.
   - The updated values are displayed without a manual reload.
4. Reload the page and reopen the profile.
5. Expected: the updated values persist.

### 4.6 Cancel — "Yes" (AC-6…AC-8)

1. Enter Edit mode and change several values.
2. Click "Cancel".
3. Expected: a modal dialog shows exactly `Do you really want to cancel? Changes will not be saved.` with "Yes" and "No".
4. Click "Yes".
5. Expected: the dialog closes, the page returns to View mode, and none of the changes were saved.
6. Confirm the dialog cannot be dismissed by clicking the backdrop or pressing Escape (a choice is required).

### 4.7 Cancel — "No" (AC-9)

1. Enter Edit mode and change values.
2. Click "Cancel", then "No".
3. Expected: the dialog closes, the page stays in Edit mode, and all entered values are preserved.

### 4.8 Photo (F-1)

1. In Edit mode, select a valid image (JPEG/PNG/WebP, up to 5 MB).
2. Expected: a local preview appears.
3. Save.
4. Expected: the new photo is displayed in View mode after the update.
5. Select an unsupported file.
6. Expected: an inline error appears and the file is not attached; saving remains possible with the existing photo.

---

## 5. Manual validation — Receptionist (US1, US3)

Sign in as a Receptionist.

### 5.1 Open a doctor's profile (US1)

1. Go to the "Doctors" page.
2. Use the "View profile" action on a row.
3. Expected: the doctor's profile page opens in View mode with the same field set and an "Edit" button.
4. Edit a value and save.
5. Expected: the change persists and is visible after reloading.
6. Directly navigate to `/profile`.
7. Expected: access denied; redirect to `/` (the Receptionist has no own doctor profile).

### 5.2 Change status (US3, F-9)

1. On the "Doctors" page, open the status select for a doctor.
2. Expected options: `At work`, `On vacation`, `Sick Day`, `Sick Leave`, `Self-isolation`, `Leave without pay`, `Inactive`.
3. Choose a different status.
4. Expected:
   - The row updates immediately.
   - A success notification appears.
   - The select is disabled while the request is in flight.
5. Reload the page.
6. Expected: the new status persists.
7. Open the same doctor's profile.
8. Expected: the profile shows the same status.
9. Simulate a failure (stop the Profiles API or use a network throttle), change the status.
10. Expected: the previous status is restored and an error notification is shown.

---

## 6. Access control

| Scenario | Expected |
|---|---|
| Unauthenticated user opens `/profile` | Redirect to `/sign-in` |
| Unauthenticated user opens `/doctors/{id}/profile` | Redirect to `/sign-in` |
| Doctor opens another doctor's profile URL | Redirect to `/`; no data shown |
| Receptionist opens `/profile` | Redirect to `/` |
| Doctor opens `/doctors` | Allowed (existing route) but no status select actions are exposed to the Doctor |

---

## 7. Failure-path validation

| Scenario | Expected |
|---|---|
| Profile load fails (5xx) | Error state with a retry action; no crash |
| Profile not found (404) | "Profile not found" state; no crash |
| Save fails (400) | Edit mode preserved; server messages shown; values intact |
| Save fails (5xx) | Edit mode preserved; error toast; retry possible |
| Catalog load fails | Edit mode shows an error; "Save changes" stays disabled; no fake options |
| Status update fails | Row reverts; error toast |
| Double-click "Save changes" | Only one request is sent |

---

## 8. Accessibility and responsiveness checks

1. Tab through the Edit form: every control, the autocomplete list, and the dialog buttons are reachable.
2. In the autocomplete, use `ArrowDown` / `ArrowUp` / `Enter` / `Escape`; the active option is announced via `aria-activedescendant`.
3. Open the Cancel dialog: focus moves into the dialog and returns to the "Cancel" button after closing.
4. Resize to 375 px width: the form stacks in one column; the footer buttons remain reachable.
5. Check at `sm`, `md`, and `lg` breakpoints.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `403` on the profile page | E1/E2 not authorized for the role | Verify the backend role attributes (`Receptionist` on `GET /api/Doctors/{id}`) |
| Profile page shows "not found" for a Doctor | E1 missing, the profile is not linked, or the response lacks `id`/`status` | Confirm `GET /api/Doctors/account/{accountId}` exists and `AccountId = sub` for that doctor |
| Status select rolls back with an error | E2/E3 failed (e.g. Receptionist still forbidden on `GET /{id}`) | Widen `GET /api/Doctors/{id}` to `Receptionist`; the client composes `GET` + `PUT` |
| Catalog fields empty | E6/E7 unavailable | Fix the catalog endpoint; the client no longer fabricates fallback values, so saving stays disabled |
| Dialog has no backdrop styling | CDK overlay CSS not imported | Add `@import '@angular/cdk/overlay-prebuilt.css';` to `styles.css` |
| `NG0203` / injection error when opening the dialog | `Dialog` injected outside an injection context | Inject it as a field in the Smart component, not inside a method |
