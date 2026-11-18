# Quickstart: Appointment Management

**Feature**: `006-appointment-management` | **Date**: 2026-11-15

Runnable validation guide. It proves the feature end to end without prescribing implementation code. Model and contract details live in [data-model.md](./data-model.md), [contracts/appointments-api.md](./contracts/appointments-api.md), and [contracts/appointment-cascade.md](./contracts/appointment-cascade.md).

## 1. Prerequisites

| Requirement | Check |
|---|---|
| Node 20+ and npm 11 | `node -v`, `npm -v` |
| Backend stack running behind the Gateway (appointments, profiles, services, offices, auth) | Gateway Swagger reachable at `/appointments/swagger/v1/swagger.json` |
| Receptionist account signed in | Sign-in page returns the home page with an admin header |
| Seed data: ≥2 offices, ≥2 specializations, ≥2 doctors (one `At work` with an office), ≥2 active services, ≥2 active patients | Backend seed or admin actions |
| Generated appointments client (plan gate **P-1**) | `AdminApp/src/app/api/generated/appointments/` exists and contains `AppointmentsService`/`ScheduleService` |
| Patient search endpoint (plan gate **P-2**) | `GET /profiles/patients?search=` returns `{ isSuccess, data }` |
| No manual HTTP client for appointments | `grep -r "appointments" AdminApp/src/app/api/*.service.ts` returns nothing new |

## 2. Setup

```powershell
cd "E:\Innowise Project\Frontend\AdminApp\AdminApp"
npm install
npm run api:appointments   # overlay + ng-openapi-gen (added by P-1)
npm start                  # http://localhost:4200
```

The dev server must proxy/point `environment.apiUrl` at the Gateway. `provideAppointmentsApiConfiguration()` must be registered in `app.config.ts` (part of P-1).

## 3. Automated checks

```powershell
npm test        # vitest, all spec files
npm run build   # production build must be warning-free for this feature
```

Expected new suites:

| Suite | Proves |
|---|---|
| `appointment-cascade.spec.ts` | Every row of the cascade matrix, idempotence, clearing order |
| `appointment-sort.spec.ts` | Ordering by time → surname → name → service, including ties |
| `appointment-filters.spec.ts` | Filter → query mapping, `All` status omission, exact doctor refinement |
| `appointments-facade.spec.ts` | Approve/delete success, revert on failure, notification calls |
| `appointment-table.component.spec.ts` | Columns, approved highlight, disabled Approve/Reschedule, empty states |
| `appointment-create-modal.component.spec.ts` | Disabled/enabled Confirm, date/slot gating, exit dialog, error retention |
| `app-combobox.component.spec.ts` | Keyboard navigation, ARIA wiring, text/id separation, empty state |

## 4. Manual validation scenarios

### S1 — Cascade and slot gating (US 1, AC-9/12/19/20)

1. Open `/appointments`, click "Create an appointment".
2. Confirm the modal shows patient, specialization, doctor, service, office, date, time slots, "Create patient", "Confirm", and "x".
3. Confirm date and slots are disabled and "Confirm" is disabled.
4. Pick a specialization and a service that belong together.
5. **Expected**: date and slots become enabled; "Confirm" still disabled until the remaining fields are set.
6. Clear the service.
7. **Expected**: date and slot are cleared and disabled again.
8. Re-select specialization + service, pick a doctor, then change the office to one where that doctor does not work.
9. **Expected**: the doctor is cleared; if no doctor of that specialization works there, specialization/service are cleared too.

### S2 — Auto-fill and single remaining doctor (US 1, A1–A4)

1. In a fresh modal, select a doctor.
2. **Expected**: specialization and office fill automatically; the service list narrows to that specialization.
3. Clear the doctor, choose a specialization + service + date.
4. Choose a time slot at which exactly one doctor is free.
5. **Expected**: that doctor and their office fill automatically and the form becomes confirmable (given a patient).

### S3 — Patient field and "Create patient" (US 1, AC-2/4, FR-011/016/017)

1. Click into the patient field and leave it empty.
2. **Expected**: red border + "Please, choose the patient".
3. Type a name that matches nothing and blur.
4. **Expected**: red border + "Invalid patient name".
5. Select a valid patient, then click "Create patient".
6. **Expected**: a patient creation dialog opens over the appointment modal.
7. Complete it and save.
8. **Expected**: the appointment modal returns, the new patient is selected, and all other values are preserved.

### S4 — Exit confirmation (US 1, AC-5/7/8)

1. Fill several fields, click "x".
2. **Expected**: `Do you really want to exit? Appointment will not be saved.` with `Yes`/`No`.
3. Click "No" → dialog closes, modal keeps every value.
4. Click "x" again → "Yes".
5. **Expected**: both dialogs close and no appointment exists in the list.

### S5 — Generate, columns, sorting (US 2, AC-1–5, 12–14)

1. Open `/appointments`.
2. **Expected**: filters, "Generate", and "Create an appointment"; no table yet.
3. Click "Generate".
4. **Expected**: the table shows Time, Doctor, Patient, Phone, Service, Actions; each row has Approve, Cancel, Reschedule.
5. Create three appointments for the same date: same time/different doctors, same doctor/different time, same doctor/time/different services.
6. **Expected**: rows are ordered by time, then doctor surname, then doctor first name, then service name; the time column reads like `11:00 - 11:20`.

### S6 — Filters and combination (US 2, AC-6–11, 15)

1. Change the date; the table reloads without clicking "Generate".
2. Select a doctor; only that doctor's rows remain (exact full-name match, not a partial match).
3. Select a service; only that service's rows remain.
4. Set status to "Approved" → only approved rows; "Not Approved" → only pending rows; "All" → both.
5. Select an office; only that office's rows remain.
6. Combine office + service + status + date.
7. **Expected**: rows satisfy every filter; a combination with no matches shows the empty state, not an error.

### S7 — Approve (US 3)

1. Click "Approve" on a pending row.
2. **Expected**: status becomes Approved, the row is highlighted, and Approve is disabled.
3. Reload the page and generate the same date.
4. **Expected**: still approved and still disabled; approval did not reorder rows.
5. Simulate a failed approval (stop the appointments service) and retry.
6. **Expected**: the row reverts to its previous state and an error notification appears.

### S8 — Cancel and delete (US 4)

1. Click "Cancel" on any row (approved or pending).
2. **Expected**: `Do you really want to cancel the appointment? It will be permanently deleted.` with `Yes`/`No`.
3. Click "No".
4. **Expected**: dialog closes; the table is unchanged.
5. Click "Cancel" → "Yes".
6. **Expected**: the row disappears immediately, and a reload does not bring it back.
7. Cancel the last remaining row.
8. **Expected**: the empty-state message appears.

### S9 — Slot conflict (US 1, FR-009)

1. Open the creation modal in two browser tabs on the same date/doctor/service.
2. Book 11:00 in the first tab.
3. Book 11:00 in the second tab.
4. **Expected**: the second attempt shows a slot error, no duplicate appointment is created, and the slot list refreshes without 11:00.

### S10 — Access and dialogs (FR-068/069)

1. Sign in as a Doctor or Patient.
2. **Expected**: `/appointments` is not reachable; no "Appointments" nav item.
3. As a Receptionist, open each dialog and operate it with the keyboard only (Tab/Shift+Tab, Enter, Escape).
4. **Expected**: focus enters the dialog, `Escape` cancels a confirmation without side effects, and focus returns to the triggering control.

## 5. Traceability

| Spec range | Scenarios |
|---|---|
| US 1 AC-1–AC-13, FR-001–FR-037 | S1, S2, S3, S4, S9 |
| US 2 AC-1–AC-16, FR-038–FR-053 | S5, S6 |
| US 3 AC-1, FR-054–FR-060 | S7 |
| US 4 AC-1/3/4, FR-061–FR-067 | S8 |
| Access/dialogs, FR-068–FR-071 | S10, S4, S8 |

## 6. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `401` on every appointments call | Session expired or token not attached | Re-sign-in; verify `auth.interceptor` covers the new generated root |
| `403` | Signed in without Receptionist role | Use a Receptionist account |
| Empty doctor list | ProfilesAPI returns no `At work` doctors or the address mapping fails | Check `/profiles/doctors/doctors`; verify `officeAddress` matches office `address` |
| Empty service list | Specialization details not loaded or all services inactive | Check `/services/specialization/{id}` and `services[].status` |
| Patient combobox empty | **P-2 not delivered** | Implement the patient search endpoint before continuing |
| `400 The selected time slot is invalid` | Slot taken between load and submit | Expected conflict path; reload slots and retry |
| Date shows the previous day | Time-zone offset when serializing `Date` | Send `yyyy-MM-dd` at local midnight and verify `Date.Date` matching |
| Generated client missing models | Overlay run against an outdated swagger | Re-run `npm run api:appointments` against the live Gateway swagger |
| Approve does nothing | Endpoint returned `409 AlreadyApproved` | Refresh the list; the row is already approved server-side |

## 7. Deviations caused by gates

Recorded during implementation (T053). The scenarios above were not executed end to end
because no backend was running locally; validation was limited to `npm run build` and the
unit suite (30 files, 230 tests, all passing).

| Gate | Deviation as implemented |
|---|---|
| **P-2** patient search | The backend exposes no patient search/list operation, so `AppointmentCatalogService.load()` returns `patients: []`. The patient combobox renders an explicit "Patient search is not available yet" empty state, "Create patient" is disabled with an explanatory tooltip, and T018 stays blocked. No fake patient source exists, so S1–S4/S9 cannot be completed against the live app until P-2 ships. |
| **P-6** reschedule | `Reschedule` is rendered disabled with a tooltip on every row; no reschedule flow exists. |
| **P-1** generated client | Used exclusively; no hand-written HTTP client or DTO was added. Approval is optimistic, and HTTP `409 AlreadyApproved` marks the row approved and notifies instead of reverting. |
| Create modal hosting | The creation form is rendered inline from `AppointmentsPageComponent` (`isCreateOpen` + `CdkTrapFocus`) rather than opened through `AppDialogService`; only the exit/cancel confirmations use CDK dialogs. |
| Navigation | The guarded "Appointments" item is rendered from `AdminApp/src/app/app.ts`; the app has no `app-header` component. |
| Name formats | Doctor rows use `DoctorTableRowDto.FullName` (`First Last Middle`), while appointment rows/patients use `Last First Middle`; the exact-doctor refinement compares against the latter. |
