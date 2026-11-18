# Quickstart Validation — Doctor Directory and Patient Profile

**Feature**: `007-doctor-directory-patient-profile` | **Date**: 2026-11-17

This guide proves the feature works end to end. Field-level rules live in
[data-model.md](./data-model.md) §4, endpoints in [contracts/api-contracts.md](./contracts/api-contracts.md),
and pending client work in [contracts/openapi-gaps.md](./contracts/openapi-gaps.md).

## 1. Prerequisites

| Item | Requirement |
|------|-------------|
| Node / npm | Node 20+, npm 11 (repo pins `npm@11.6.0`) |
| Gateway | Running and reachable at the `apiUrl` from `src/environments/environment.development.ts` (default `http://localhost:5137`) |
| Accounts | One signed-in **Receptionist** and one signed-in **Doctor**, both valid for the gateway |
| Data | At least two offices and three specializations in the catalogs; at least five doctors, two of them in different offices; one doctor's schedule with one **Approved** and one **not approved** appointment for a patient who has at least one recorded result |
| Contracts | P-1…P-6 from `contracts/openapi-gaps.md` resolved for the stories you intend to exercise (see §2) |

## 2. Contract preflight

Run the generators, then confirm the generated operation signatures carry payload types instead of
`void`:

```bash
npm run api:profiles
npm run api:appointments
```

Check these files (search for `Observable<` in the `*$Response` methods):

| File | Expected |
|------|----------|
| `src/app/api/generated/profiles/services/doctors.service.ts` | `doctorsIdGet` returns a payload type, `doctorsPost` returns a payload type |
| `src/app/api/generated/appointments/services/schedule.service.ts` | `scheduleDoctorDoctorIdGet` and `schedulePatientPatientIdHistoryGet` return payload types |
| `src/app/api/generated/appointments/services/appointments-result.service.ts` | `appointmentsAppointmentIdResultsGet` returns a payload type |

If any still shows `Observable<void>`, stop: the dependent story is blocked per the constitution. Do not
add a hand-written client to unblock it.

## 3. Commands

```bash
npm start          # dev server, http://localhost:4200
npm test           # Vitest unit/component suite
npm run build      # production build; must stay inside the 500 kB / 1 MB budgets
```

Expected: `npm test` green (baseline is 32 spec files) and `npm run build` successful with no budget
errors.

## 4. US1 — Create a doctor (P1)

| # | Step | Expected |
|---|------|----------|
| 1.1 | Sign in as Receptionist, open **Doctors**, click **Create doctor** | Dialog/page with photo, first/last/middle name, date of birth, email, specialization combobox, office dropdown, career start year, status; actions **Confirm** and **Cancel** |
| 1.2 | Leave every required field empty | **Confirm** disabled |
| 1.3 | Focus the first-name field and tab out without typing | Red border + `Please, enter the first name` |
| 1.4 | Repeat for last name, email, date of birth, specialization, office, career start year, status | `Please, enter the last name`, `Please, enter the email`, `Please, select the date`, `Please, choose the specialisation`, `Please, choose the office`, `Please, select the year`, `Please, choose the status` |
| 1.5 | Type `not-an-email` in email | `You've entered an invalid email`; **Confirm** disabled |
| 1.6 | Enter an email that already belongs to a doctor | `User with this email already exists`; no account created |
| 1.7 | Type a specialization not in the catalog and tab out | `Invalid specialization name`; **Confirm** disabled |
| 1.8 | Set date of birth or career start year in the future | Value rejected / message shown; **Confirm** disabled |
| 1.9 | Enter only spaces in first name | Treated as empty (`Please, enter the first name`) |
| 1.10 | Fill all fields validly, attach a JPEG, click **Confirm** | Doctor appears in the directory without a manual reload; success confirmation; credentials email sent to the doctor's address by the backend |
| 1.11 | Open the same form, type something, click **Cancel** | Dialog `Do you really want to cancel? Entered data will not be saved.` with **Yes** / **No** |
| 1.12 | Choose **No** | Dialog closes, entered data still present |
| 1.13 | Choose **Yes** | Form closes without saving; directory unchanged |
| 1.14 | Double-click **Confirm** quickly on a valid form | Exactly one doctor created |

## 5. US4 — Directory, filters, status (P2)

| # | Step | Expected |
|---|------|----------|
| 4.1 | Open **Doctors** as Receptionist | Table with full name, specialization, status, date of birth, office, and a **Create doctor** action |
| 4.2 | Change one doctor's status to **On vacation** | Row shows the new value immediately; no separate save; reload page → value persists |
| 4.3 | Disconnect the gateway, then change a status | Row reverts to the previous value and an error is reported; select is enabled again |
| 4.4 | Select a doctor in the name combobox | Table shows only that doctor; clear it → previous result set returns |
| 4.5 | Select an **office** | Table narrows; open the specialization filter → only specializations of doctors in that office (plus `All`) |
| 4.6 | Clear office, select a **specialization** | Table narrows; open the office filter → only offices where that specialization works (plus `All`) |
| 4.7 | Set office + specialization + name together | Table shows only doctors matching all three; no infinite reload loop in the console |
| 4.8 | Click **Clear filters** | Full directory returns; all selects show `All` |
| 4.9 | Choose a combination matching nobody | Explanatory empty state (not a blank table) |
| 4.10 | Click a doctor's full name | That doctor's profile opens |
| 4.11 | Reset filters while a narrowing filter is selected | The other dropdown re-widens automatically; no impossible selected value remains |
| 4.12 | With 500 doctors seeded, apply a two-filter combination | Result appears in under 1 second; table remains scrollable |

## 6. US3 — Edit a doctor profile (P3)

| # | Step | Expected |
|---|------|----------|
| 3.1 | As Receptionist open a doctor from the directory; click **Edit** | Fields become editable; **Save changes** and **Cancel** appear; email is visible but read-only |
| 3.2 | Clear the first name | Red border + `Please, enter the first name`; **Save changes** disabled |
| 3.3 | Enter an invalid specialization | `Invalid specialization name`; save stays disabled |
| 3.4 | Fix all fields and click **Save changes** | View mode returns with the new values; reload keeps them |
| 3.5 | Edit again, change something, click **Cancel** | Dialog `Do you really want to cancel? Changes will not be saved.` |
| 3.6 | Choose **No** | Edit mode and entered data remain |
| 3.7 | Choose **Yes** | View mode returns with the stored values (edits discarded) |
| 3.8 | As Doctor open **Profile** and repeat 3.4 | Only the doctor's own profile is editable; saving updates the same record |
| 3.9 | As Doctor try to open another doctor's profile URL | Access denied (role guard redirects) |

## 7. US2 — Patient profile from the schedule (P4)

Requires P-1, P-4, P-5.

| # | Step | Expected |
|---|------|----------|
| 2.1 | As Doctor open **My schedule** | Today's appointments with patient names, services and times |
| 2.2 | Find the **Approved** appointment | Patient name is an active link |
| 2.3 | Find the not-approved appointment | Patient name is plain, non-interactive, marked unavailable |
| 2.4 | Click the approved patient's name | Patient profile opens with two tabs, **Personal information** selected by default |
| 2.5 | Inspect **Personal information** | Photo (or neutral placeholder), first/last/middle name, phone number, date of birth |
| 2.6 | Switch to **Appointment results** | Most recent appointment first, each with date, doctor, service, complaints, conclusion, recommendations |
| 2.7 | Use keyboard only on the tabs | `ArrowLeft`/`ArrowRight`/`Home`/`End` move between tabs; focus ring visible; panel content follows |
| 2.8 | Open a patient with no recorded results | Empty state in the results tab (not an error) |
| 2.9 | Stop the gateway and reload the patient profile | Error state with a retry action (no partial profile) |
| 2.10 | Paste `/patients/<id>/profile` for a patient without an approved appointment | Redirected away; profile content not shown |
| 2.11 | Approval changes while the schedule is open, then refresh | Link state matches the refreshed approval status |

## 8. Cross-cutting checks

| Check | Expected |
|-------|----------|
| Browser console during any scenario | No infinite change-detection loops, no `ExpressionChangedAfterItHasBeenChecked`, no unhandled promise rejections |
| Network panel | Status change sends exactly one `PUT /Doctors/{id}`; filters send no requests; the directory loads `GET /Doctors/doctors` pages once |
| Accessibility | All dialogs trap focus and restore it to the trigger; selects and comboboxes have accessible names; error messages are linked with `aria-describedby` |
| Responsive | At 375 px wide the table scrolls horizontally, the form stacks, and no action is unreachable |
| Code scan | `grep -r "\bany\b" src/app/features/{doctors,patients,schedule}` finds no type usages; no `.subscribe(` without `takeUntilDestroyed`; no `@apply` |

## 9. Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Comboboxes are empty | Specializations/offices catalog request failed — check the Appointments gateway route and `provideAppointmentsApiConfiguration()` |
| Status reverts immediately on every change | `PUT` rejected; inspect the response body (`message`/`errors`) and confirm the profile read (P-2) returns `status` |
| Patient link is never active | Schedule response has `isApproved: false`, or P-4 is unresolved and rows fall back to an empty list |
| `/my-schedule` shows "account not linked" | P-1 missing: `GET /Doctors/account/{accountId}` is not implemented |
| Build fails on `strictTemplates` | A dumb component is receiving `undefined` where the contract requires a value — fix the input type, do not widen it |
