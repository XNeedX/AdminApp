# Feature Specification: Appointment Management

**Feature Branch**: `006-appointment-management`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Создай спецификацию для функционала управления записями на прием (Appointments: Create, View List, Approve, Cancel).

User Story 1: As a RECEPTIONIST I want to create an appointment.
Preconditions: Signed in.
AC-1: Click “Create an appointment” -> show modal window/page.
AC-2: Fields: patient, specialization, doctor, service (comboboxes), office (dropdown), date, time slots. Buttons: “Create patient”, “Confirm”, "x" (top right).
AC-3: All valid + “Confirm” -> save to DB.
AC-4: Empty/invalid -> “Confirm” disabled.
AC-5: Click "x" -> dialog “Do you really want to exit? Appointment will not be saved.”
AC-7: Dialog "Yes" -> close dialog, close modal.
AC-8: Dialog "No" -> close dialog, stay in modal with data.
AC-9: Specialization and Service completed -> Date and Time Slots get enabled.
AC-10/11/12/13: Lists contain only Active/At work items.
Form Interdependencies & Validation:
- Patient: Req, combobox. Autocomplete. Invalid -> “Invalid patient name”. Empty on blur -> “Please, choose the patient”.
- Specialization: Req, combobox. Autocomplete. If Doctor filled -> auto-fill doctor's spec. If Service filled -> auto-fill service's spec. If Office filled -> filter specs by doctors in office.
- Doctor: Req, combobox. Autocomplete. If Spec filled -> filter by spec. If Service filled -> filter by service. If Office filled -> filter by office. If Date/Time filled -> filter by availability (if 1 left, auto-fill).
- Service: Req, combobox. Autocomplete. If Spec filled -> filter by spec. If Doctor filled -> filter by doctor's spec. If Office filled -> filter by office's doctors.
- Office: Req, dropdown. If Spec/Service filled -> filter by doctors with spec. If Doctor filled -> auto-fill doctor's office.

User Story 2: As a RECEPTIONIST I want to view appointment list.
AC-1: Click “Appointments” -> page with filters and “Generate” button.
AC-2: Click “Generate” -> show table below.
AC-3: Table columns: time (e.g. 11:00 - 11:20), doctor full name, patient full name, patient phone, service name.
AC-4: Rows contain “Approve”, “Cancel”, “Reschedule” buttons/icons.
AC-5/12/13/14: Sorting rule (Ascending): Time -> Doctor Surname -> Doctor Name -> Service Name.
AC-6 to 11: Filters: Date (datepicker, auto-reloads list for new date), Doctor full name, Service name, Status (Approved, Not Approved, All), Office. Can be combined (AC-15).
AC-16: Page contains “Create an appointment” button.

User Story 3: As a RECEPTIONIST I want to approve appointment.
AC-1: Click “Approve” -> status becomes “Approved”, row gets special highlighting, “Approve” button gets disabled.

User Story 4: As a RECEPTIONIST I want to cancel appointment.
AC-1: Click “Cancel” -> dialog “Do you really want to cancel the appointment? It will be permanently deleted.”
AC-3: Dialog "Yes" -> delete from DB and table.
AC-4: Dialog "No" -> close dialog, table unchanged."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an appointment (Priority: P1)

A signed-in Receptionist opens the appointments page and activates "Create an appointment". A creation modal appears with the patient, specialization, doctor, service, office, date, and time-slot controls, plus "Create patient", "Confirm", and a close "x". The Receptionist finds an existing patient, narrows the catalog with any combination of specialization, doctor, service, and office, then chooses a date once both specialization and service are set, and finally picks a free time slot. "Confirm" stays disabled until every required value is present and mutually consistent; when it is enabled, activating it stores the appointment as "Not Approved", closes the modal, and refreshes the appointment list. Closing with "x" asks for confirmation before discarding the entry.

**Why this priority**: Booking appointments is the core purpose of the reception workspace. Without creation there is nothing to list, approve, or cancel, and the clinic cannot schedule patients at all.

**Independent Test**: Sign in as a Receptionist, click "Create an appointment", verify the modal and its controls, verify "Confirm" is disabled, verify date and time slots are disabled, select a specialization and a service, verify date and time slots become enabled, pick a patient, doctor, office, date, and slot, and verify "Confirm" becomes enabled and creates the appointment. Then repeat the flow and verify the "x" confirmation dialog with both "Yes" and "No".

**Acceptance Scenarios**:

1. **Given** the Receptionist is on the appointments page, **When** the Receptionist clicks "Create an appointment", **Then** an appointment creation modal is displayed.
2. **Given** the creation modal is displayed, **When** it is rendered, **Then** it contains the controls patient, specialization, doctor, service, office, date, and time slots, and the buttons "Create patient", "Confirm", and a close "x" in the top right corner.
3. **Given** the creation modal has just opened, **When** it is rendered, **Then** every field is empty, the date and time-slot controls are disabled, and "Confirm" is disabled.
4. **Given** all required fields contain valid and mutually consistent values, **When** the form is in that state, **Then** "Confirm" is enabled.
5. **Given** all required fields are valid, **When** the Receptionist clicks "Confirm", **Then** the appointment is stored with the status "Not Approved", the modal closes, and the appointment list reflects the new entry.
6. **Given** at least one required field is empty or invalid, **When** the form is in that state, **Then** "Confirm" is disabled and clicking it does not create anything.
7. **Given** the patient field is displayed, **When** the Receptionist leaves it empty on blur, **Then** the field gets a red border and the message "Please, choose the patient" is shown.
8. **Given** the patient field is displayed, **When** the Receptionist types text that does not match a selectable patient and leaves the field, **Then** the field gets a red border and the message "Invalid patient name" is shown.
9. **Given** the Receptionist has selected a patient from the suggestions, **When** the field loses focus, **Then** no validation message is shown.
10. **Given** the creation modal is displayed with an empty specialization and an empty service, **When** it is rendered, **Then** the date and time-slot controls are disabled.
11. **Given** the Receptionist has selected both a specialization and a service, **When** both values are present, **Then** the date and time-slot controls become enabled.
12. **Given** the date and time-slot controls are enabled, **When** the Receptionist clears either the specialization or the service, **Then** the selected date and time slot are cleared and both controls become disabled again.
13. **Given** the Receptionist selects a doctor, **When** the selection is made, **Then** the specialization is automatically filled with that doctor's specialization.
14. **Given** the Receptionist selects a service, **When** the selection is made, **Then** the specialization is automatically filled with that service's specialization.
15. **Given** the Receptionist selects an office that has doctors, **When** the specialization suggestions are opened, **Then** they contain only specializations of doctors working in that office.
16. **Given** the Receptionist selects a specialization, **When** the doctor suggestions are opened, **Then** they contain only doctors of that specialization.
17. **Given** the Receptionist selects a service, **When** the doctor suggestions are opened, **Then** they contain only doctors who can perform that service.
18. **Given** the Receptionist selects an office, **When** the doctor suggestions are opened, **Then** they contain only doctors working in that office.
19. **Given** the Receptionist has selected a date and a time slot, **When** the doctor suggestions are opened, **Then** they contain only doctors who are available at that date and time.
20. **Given** a date and time slot are selected and exactly one doctor remains available, **When** the suggestions are resolved, **Then** that doctor is filled in automatically.
21. **Given** the Receptionist selects a specialization, **When** the service suggestions are opened, **Then** they contain only services of that specialization.
22. **Given** the Receptionist selects a doctor, **When** the service suggestions are opened, **Then** they contain only services that doctor can perform.
23. **Given** the Receptionist selects an office, **When** the service suggestions are opened, **Then** they contain only services provided by doctors working in that office.
24. **Given** the Receptionist has selected a specialization or a service, **When** the office options are opened, **Then** they contain only offices with doctors matching that specialization or service.
25. **Given** the Receptionist selects a doctor, **When** the selection is made, **Then** the office is automatically filled with that doctor's office.
26. **Given** any combobox or dropdown in the creation modal is opened, **When** its options are displayed, **Then** they contain only currently active and available records: active patients, active specializations, doctors whose status is "At work", active services, and active offices.
27. **Given** a selection change makes an existing dependent selection impossible, **When** the change is applied, **Then** the now-invalid dependent selection is cleared so the form never holds a contradictory combination.
28. **Given** a date and a doctor are selected, **When** the time slots are displayed, **Then** only free slots are offered, slots already taken for that doctor are not selectable, and slots are 20 minutes long in ascending order starting from the clinic's working hours.
29. **Given** the creation modal is displayed, **When** the Receptionist clicks "Create patient", **Then** the patient creation flow opens over the appointment modal.
30. **Given** the patient creation flow was opened from the appointment modal, **When** a new patient is saved successfully, **Then** the new patient is selected in the patient field and every value already entered in the appointment form is preserved.
31. **Given** the patient creation flow was opened from the appointment modal, **When** the Receptionist dismisses it without saving, **Then** the appointment modal is shown again with every value preserved and no patient selected.
32. **Given** the creation modal contains entered or selected values, **When** the Receptionist clicks "x", **Then** a dialog with the message "Do you really want to exit? Appointment will not be saved." is displayed with the buttons "Yes" and "No".
33. **Given** the exit dialog is displayed, **When** the Receptionist clicks "Yes", **Then** the dialog closes, the creation modal closes, and no appointment is created.
34. **Given** the exit dialog is displayed, **When** the Receptionist clicks "No", **Then** the dialog closes, the creation modal remains displayed, and every entered value is preserved.
35. **Given** all required fields are valid, **When** storing the appointment fails, **Then** the modal stays open, all entered values are preserved, an error notification is displayed, and the Receptionist can retry.
36. **Given** "Confirm" was already activated and the request is in progress, **When** "Confirm" is activated again, **Then** no duplicate appointment is created.
37. **Given** the Receptionist clicks "Confirm" with a slot that has just been booked by someone else, **When** the appointment is stored, **Then** the conflict is reported, no double booking is created, and the Receptionist is returned to slot selection with a message.

---

### User Story 2 - View the appointment list (Priority: P2)

A signed-in Receptionist activates "Appointments" and lands on the appointments page, which shows a filter panel, a "Generate" button, and a "Create an appointment" button. After activating "Generate", a table appears below the filters listing the appointments for the chosen date with time range, doctor full name, patient full name, patient phone, and service name, ordered by time and then by doctor surname, doctor name, and service name. The Receptionist narrows the table with any combination of date, doctor, service, status, and office filters; changing the date refreshes the table immediately.

**Why this priority**: The list is how the clinic sees its day. It delivers standalone value as soon as appointments exist, and it is the surface that hosts approval and cancellation.

**Independent Test**: Sign in as a Receptionist, click "Appointments", verify the filter panel, "Generate", and "Create an appointment" are present, click "Generate", and verify the table columns, row actions, and ascending order. Then apply each filter and a combined filter set and verify the resulting rows, and change the date and verify the table reloads without using "Generate".

**Acceptance Scenarios**:

1. **Given** the Receptionist is signed in, **When** the Receptionist clicks "Appointments", **Then** the appointments page is displayed containing a filter panel, a "Generate" button, and a "Create an appointment" button.
2. **Given** the appointments page is displayed before any generation, **When** it is rendered, **Then** the filters and the "Generate" button are visible and the results table is not displayed.
3. **Given** the appointments page is displayed, **When** the Receptionist clicks "Generate", **Then** a results table is displayed below the filters.
4. **Given** the results table is displayed, **When** it is rendered, **Then** it contains the columns time (for example "11:00 - 11:20"), doctor full name, patient full name, patient phone, and service name.
5. **Given** the results table is displayed, **When** a row is rendered, **Then** the row contains the actions "Approve", "Cancel", and "Reschedule".
6. **Given** several appointments exist for the displayed date, **When** the table is rendered, **Then** rows are sorted ascending by time, then by doctor surname, then by doctor name, then by service name.
7. **Given** two appointments have the same time and the same doctor, **When** the table is rendered, **Then** the row with the alphabetically earlier service name is placed first.
8. **Given** the filter panel is displayed, **When** it is rendered, **Then** it contains a date filter, a doctor full-name filter, a service-name filter, a status filter offering "Approved", "Not Approved", and "All", and an office filter.
9. **Given** the appointments page is opened for the first time, **When** the filters are rendered, **Then** the date filter is set to today and the status filter is set to "All".
10. **Given** the table has been generated, **When** the Receptionist selects a different date, **Then** the table reloads automatically with the appointments of the newly selected date, without activating "Generate".
11. **Given** the doctor filter is used, **When** the Receptionist types a full name, **Then** suggestions are offered and selecting a doctor limits the table to that doctor's appointments.
12. **Given** the service filter is used, **When** the Receptionist types a service name, **Then** suggestions are offered and selecting a service limits the table to that service's appointments.
13. **Given** the status filter is set to "Approved", **When** the table is rendered, **Then** only approved appointments are shown; with "Not Approved" only not-approved appointments are shown; with "All" both are shown.
14. **Given** the office filter is selected, **When** the table is rendered, **Then** only appointments in that office are shown.
15. **Given** two or more filters are set, **When** the table is rendered, **Then** only appointments matching all selected filters are shown.
16. **Given** the table has been generated, **When** the Receptionist changes any filter other than the date, **Then** the displayed rows match the new filter set without a page reload.
17. **Given** no appointment matches the current filters, **When** the table is rendered, **Then** an empty-state message is shown instead of rows.
18. **Given** the table is displayed, **When** the Receptionist clicks "Create an appointment", **Then** the appointment creation modal opens from the list page.
19. **Given** an appointment was just created, **When** the list is refreshed for its date, **Then** the new appointment appears with the status "Not Approved".
20. **Given** appointments exist for a date and the Receptionist leaves every filter at its default, **When** "Generate" is activated, **Then** all appointments for that date are shown.

---

### User Story 3 - Approve an appointment (Priority: P3)

A signed-in Receptionist reviews a row in the appointment list and activates "Approve". The appointment's status is stored as "Approved", the row is highlighted to make the approval visually obvious, and the "Approve" action on that row becomes disabled so the same approval cannot be repeated.

**Why this priority**: Approval turns a provisional booking into a confirmed visit. It is a small, independent capability that builds on the list and delivers immediate operational value.

**Independent Test**: Sign in as a Receptionist, generate a list containing a "Not Approved" appointment, click "Approve" on that row, and verify the status becomes "Approved", the row is highlighted, and "Approve" is disabled. Reload the page and verify the approved status persists.

**Acceptance Scenarios**:

1. **Given** a row with the status "Not Approved" is displayed, **When** the Receptionist clicks "Approve", **Then** the appointment's status becomes "Approved" and is stored.
2. **Given** an appointment has just been approved, **When** its row is rendered, **Then** the row is visually highlighted as approved.
3. **Given** an appointment is approved, **When** its row is rendered, **Then** the "Approve" action on that row is disabled.
4. **Given** an appointment was approved, **When** the page or list is reloaded, **Then** the appointment still shows the status "Approved" and the disabled "Approve" action.
5. **Given** an appointment is already "Approved", **When** its row is displayed, **Then** "Approve" is disabled and no further approval can be triggered.
6. **Given** the Receptionist approves an appointment, **When** the row updates, **Then** its time, doctor, patient, and service values are unchanged and the row keeps its sorted position.
7. **Given** approval cannot be stored, **When** the failure is reported, **Then** the row keeps its previous status, no highlight is applied, an error notification is displayed, and the Receptionist can retry.
8. **Given** the Receptionist activates "Approve" repeatedly while the request is in progress, **When** the extra activations happen, **Then** only one approval is sent and no error is shown.

---

### User Story 4 - Cancel an appointment (Priority: P4)

A signed-in Receptionist activates "Cancel" on a row. A confirmation dialog warns that the appointment will be permanently deleted. Choosing "Yes" deletes the appointment and removes the row from the table; choosing "No" leaves everything untouched.

**Why this priority**: Cancellation frees a slot that was booked by mistake or is no longer needed. It completes the reception workflow and is independent of approval.

**Independent Test**: Sign in as a Receptionist, generate a list, click "Cancel" on a row, verify the dialog message and buttons, choose "No" and verify the row is unchanged, then repeat and choose "Yes" and verify the row disappears and does not return after a reload.

**Acceptance Scenarios**:

1. **Given** a row is displayed, **When** the Receptionist clicks "Cancel", **Then** a dialog is displayed containing exactly "Do you really want to cancel the appointment? It will be permanently deleted." with the buttons "Yes" and "No".
2. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "Yes", **Then** the appointment is permanently deleted from the system and its row disappears from the table.
3. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "No", **Then** the dialog closes and the table remains unchanged with every row still displayed.
4. **Given** a cancellation succeeded, **When** the list is reloaded for the same date, **Then** the cancelled appointment does not appear.
5. **Given** the cancelled appointment was the only row in the table, **When** the row disappears, **Then** the empty-state message is shown.
6. **Given** an appointment has the status "Approved", **When** the Receptionist cancels it, **Then** the cancellation proceeds exactly as for a not-approved appointment.
7. **Given** deletion fails, **When** the failure is reported, **Then** the row remains displayed with its previous data and status, an error notification is shown, and the Receptionist can retry.
8. **Given** the dialog is displayed, **When** the Receptionist dismisses it with the keyboard, **Then** the dialog closes and the table remains unchanged.

---

### Edge Cases

- **No specializations, doctors, services, or offices match the current combination**: the affected combobox shows an empty-state message instead of stale options, and "Confirm" stays disabled until a valid combination is chosen.
- **Catalog record deactivated mid-entry**: if a selected specialization, service, office, or doctor becomes inactive or stops working while the form is open, the value is cleared on the next validation pass and the Receptionist must choose again.
- **Patient record missing**: if a patient is no longer selectable, the patient field is cleared and the "Please, choose the patient" message applies; the appointment cannot be confirmed.
- **Doctor becomes unavailable after the slot was chosen**: the conflict is detected on confirmation, the appointment is not created, and the Receptionist is returned to slot selection with an explanatory message.
- **Slot at the boundary of working hours**: a slot that would extend past the doctor's working hours or past midnight is not offered.
- **Date in the past**: past dates remain selectable for viewing historical appointments, but no new appointment can be confirmed for a past date or past time.
- **Daylight-saving or clock change**: the offered slots follow the clinic's local calendar day and never overlap or duplicate around a clock change.
- **Whitespace-only patient input**: text consisting only of spaces is treated as empty and shows "Please, choose the patient".
- **Patient typed but not selected**: typed text that matches no suggestion counts as invalid and shows "Invalid patient name"; text that exactly matches a suggestion's display name but was never selected still requires an explicit selection.
- **Contradictory filters**: a filter combination that matches nothing is not an error; it produces the empty-state message.
- **Clearing a filter**: clearing the doctor, service, or office filter widens the result set again; the date and status always keep a value.
- **Very large day**: a day with several hundred appointments is displayed in a single scrollable table without truncating rows.
- **Create and cancel at the same time elsewhere**: the last successful operation wins; a cancellation made by another user surfaces as a failed action with an error notification on the next attempt.
- **Network failure while generating**: the table keeps its previous rows, an error notification is displayed, and "Generate" can be retried.
- **Closing the modal while confirmation is in progress**: closing is blocked or results in no appointment; the appointment is never created twice.
- **Exit dialog with an untouched form**: clicking "x" on a form with no changes still shows the confirmation dialog, so the behaviour is predictable.
- **Confirmation dialogs**: both dialogs are keyboard operable, move focus into the dialog when opened, and never close on backdrop click without an explicit choice.
- **Duplicate patient names**: two patients may share a full name; the suggestions must be distinguishable by the additional identifying detail shown with each suggestion.

## Requirements *(mandatory)*

### Functional Requirements

**Appointment creation**

- **FR-001**: The system MUST allow a signed-in Receptionist to open the appointment creation modal from the appointments page via a "Create an appointment" action.
- **FR-002**: The creation modal MUST contain the patient, specialization, doctor, service, office, date, and time-slot controls, plus the buttons "Create patient", "Confirm", and a close "x" in the top right corner.
- **FR-003**: Patient, specialization, doctor, and service MUST be autocomplete comboboxes, and office MUST be a dropdown; all six catalog fields are required.
- **FR-004**: The creation modal MUST open with every field empty, the date and time-slot controls disabled, and "Confirm" disabled.
- **FR-005**: "Confirm" MUST be disabled whenever any required field is empty or invalid, or the selected combination is inconsistent, and MUST be enabled only when all required values are valid and consistent.
- **FR-006**: When "Confirm" is activated with all required values valid, the system MUST store the appointment with the status "Not Approved", close the modal, and refresh the displayed appointment list.
- **FR-007**: Activating "Confirm" while a creation request is already in progress MUST NOT create a second appointment.
- **FR-008**: When storing an appointment fails, the system MUST keep the modal open, preserve every entered value, display an error notification, and allow a retry.
- **FR-009**: When an appointment cannot be stored because the selected slot is no longer free, the system MUST report the conflict, MUST NOT create a double booking, and MUST return the Receptionist to slot selection with an explanatory message.
- **FR-010**: The system MUST reject confirming an appointment whose date or start time is in the past.
- **FR-011**: The system MUST validate the patient field on blur and MUST show a red border together with:
  - Empty value — "Please, choose the patient".
  - Text that does not resolve to a selected patient — "Invalid patient name".
- **FR-012**: The date and time-slot controls MUST be disabled until both a specialization and a service are selected.
- **FR-013**: If the specialization or the service is cleared after a date or slot was chosen, the system MUST clear the date and the slot and disable both controls again.
- **FR-014**: The offered time slots MUST be 20 minutes long, presented in ascending order, derived from the selected doctor's and office's working hours for the chosen date, and MUST contain only slots that are still free.
- **FR-015**: All option lists in the creation modal MUST contain only currently available records: active patients, active specializations, active services, active offices, and doctors whose status is "At work".
- **FR-016**: Activating "Create patient" MUST open the existing patient creation flow over the appointment modal.
- **FR-017**: When a patient is created successfully from the appointment modal, the system MUST select the new patient in the patient field and MUST preserve every other value already entered.
- **FR-018**: When the patient creation flow is dismissed without saving, the system MUST return to the appointment modal with every value preserved and no patient selected.
- **FR-019**: Activating "x" in the creation modal MUST display a dialog containing exactly "Do you really want to exit? Appointment will not be saved." with the buttons "Yes" and "No".
- **FR-020**: Activating "Yes" in the exit dialog MUST close the dialog, close the creation modal, and create nothing.
- **FR-021**: Activating "No" in the exit dialog MUST close the dialog, keep the creation modal open, and preserve every entered value.
- **FR-022**: The exit dialog MUST be displayed on every "x" activation, regardless of whether the form contains data.

**Field interdependencies**

- **FR-023**: Selecting a doctor MUST automatically fill the specialization with that doctor's specialization.
- **FR-024**: Selecting a service MUST automatically fill the specialization with that service's specialization.
- **FR-025**: Selecting an office MUST limit the specialization suggestions to specializations of doctors working in that office.
- **FR-026**: Selecting a specialization MUST limit the doctor suggestions to doctors of that specialization.
- **FR-027**: Selecting a service MUST limit the doctor suggestions to doctors who can perform that service.
- **FR-028**: Selecting an office MUST limit the doctor suggestions to doctors working in that office.
- **FR-029**: When a date and a time slot are selected, the doctor suggestions MUST be limited to doctors available at that date and time.
- **FR-030**: When exactly one doctor remains available for the selected date and time, the system MUST fill that doctor automatically.
- **FR-031**: Selecting a specialization MUST limit the service suggestions to services of that specialization.
- **FR-032**: Selecting a doctor MUST limit the service suggestions to services that doctor can perform.
- **FR-033**: Selecting an office MUST limit the service suggestions to services provided by doctors working in that office.
- **FR-034**: Selecting a specialization or a service MUST limit the office options to offices that have doctors matching that specialization or service.
- **FR-035**: Selecting a doctor MUST automatically fill the office with that doctor's office.
- **FR-036**: When a change makes an existing dependent selection impossible, the system MUST clear the incompatible selection so that no contradictory combination is retained, and the dependent field MUST return to a required-and-empty state.
- **FR-037**: Whenever interdependent values change, the system MUST re-apply all applicable filters so that every remaining option set is consistent with the current values.

**Appointment list**

- **FR-038**: Activating "Appointments" MUST display the appointments page containing a filter panel, a "Generate" button, and a "Create an appointment" button.
- **FR-039**: Before "Generate" is activated, the page MUST show the filters and the "Generate" button without a results table.
- **FR-040**: Activating "Generate" MUST display a results table below the filters using the currently selected filters.
- **FR-041**: The results table MUST contain the columns time, doctor full name, patient full name, patient phone, and service name.
- **FR-042**: The time column MUST display the appointment as a start-and-end range in the form "11:00 - 11:20".
- **FR-043**: Rows MUST be sorted ascending by time, then by doctor surname, then by doctor name, then by service name.
- **FR-044**: Every row MUST contain the actions "Approve", "Cancel", and "Reschedule".
- **FR-045**: The filter panel MUST contain a date filter, a doctor full-name filter, a service-name filter, a status filter offering exactly "Approved", "Not Approved", and "All", and an office filter.
- **FR-046**: The date filter MUST default to the current date and the status filter MUST default to "All".
- **FR-047**: Changing the date filter MUST reload the results table automatically for the newly selected date, without activating "Generate".
- **FR-048**: Changing any other filter after the table has been generated MUST update the displayed rows so that only appointments matching every active filter are shown.
- **FR-049**: The doctor and service filters MUST offer autocomplete suggestions restricted to existing doctors and services.
- **FR-050**: Multiple active filters MUST be combined conjunctively.
- **FR-051**: When no appointment matches the current filters, the page MUST display an empty-state message instead of rows.
- **FR-052**: When loading the results fails, the system MUST keep the previously displayed rows, display an error notification, and allow the Receptionist to retry.
- **FR-053**: An appointment created through the creation modal MUST appear in the list when the list is refreshed for its date, with the status "Not Approved".

**Approval**

- **FR-054**: Activating "Approve" on a row whose status is "Not Approved" MUST change that appointment's status to "Approved" and store the change.
- **FR-055**: An approved row MUST be visually highlighted as approved.
- **FR-056**: After approval, the "Approve" action on that row MUST be disabled.
- **FR-057**: The approved status and the disabled "Approve" action MUST persist across page reloads.
- **FR-058**: Approval MUST NOT alter the appointment's time, doctor, patient, service, or office, and MUST NOT change its position in the sorted result set.
- **FR-059**: When approval fails, the system MUST keep the previous status and highlight, display an error notification, and allow a retry.
- **FR-060**: Repeated "Approve" activations for the same appointment while a request is in progress MUST result in a single approval.

**Cancellation**

- **FR-061**: Activating "Cancel" on a row MUST display a confirmation dialog containing exactly "Do you really want to cancel the appointment? It will be permanently deleted." with the buttons "Yes" and "No".
- **FR-062**: Activating "Yes" in the cancellation dialog MUST permanently delete the appointment and remove its row from the table.
- **FR-063**: Activating "No" in the cancellation dialog MUST close the dialog and leave the table unchanged.
- **FR-064**: A deleted appointment MUST NOT reappear when the list is reloaded.
- **FR-065**: Cancellation MUST be available for both "Approved" and "Not Approved" appointments.
- **FR-066**: When the deleted row was the last row in the table, the system MUST display the empty-state message.
- **FR-067**: When deletion fails, the system MUST keep the row with its previous data and status, display an error notification, and allow a retry.

**Access, dialogs, and data presentation**

- **FR-068**: Only a signed-in user with the Receptionist role may create, list, approve, or cancel appointments; users without that role MUST NOT reach these capabilities.
- **FR-069**: The exit and cancellation dialogs MUST be keyboard operable and MUST move focus into the dialog when they open.
- **FR-070**: "Reschedule" MUST be displayed on every row; its workflow is not part of this feature and MUST be presented as unavailable until the reschedule capability is delivered.
- **FR-071**: Patient phone numbers MUST be displayed in full as stored, without masking or truncation.

### Key Entities

- **Appointment**: A booked visit. Attributes: date, start time, end time, status ("Not Approved" or "Approved"), the office where it takes place, and references to exactly one patient, one doctor, one specialization, and one service. An appointment is either approved or permanently deleted; there is no other lifecycle state in this feature.
- **Appointment Status**: "Not Approved" (the default for a newly created appointment) or "Approved".
- **Patient**: The person being seen. Attributes relevant here: full name and phone number. Only active patients are selectable.
- **Doctor**: The practitioner performing the visit. Attributes relevant here: first name, surname, specialization, office, working hours, status (only "At work" is selectable), and the services the doctor performs.
- **Specialization**: The medical discipline that links doctors and services. Only active specializations are selectable.
- **Service**: The medical service being provided, belonging to exactly one specialization. Only active services are selectable.
- **Office**: The clinic room or location where the appointment takes place. Only active offices are selectable.
- **Time Slot**: A 20-minute interval on a specific date that the selected doctor can still accept. Slots already occupied for that doctor are not offered.
- **Appointment Filter Set**: The combination of date, doctor full name, service name, status, and office used to build the appointment table.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Receptionist can create a complete, valid appointment in under 2 minutes from opening the creation modal.
- **SC-002**: 100% of attempts to confirm an appointment with at least one empty or invalid required field are blocked, and "Confirm" is disabled in every such state.
- **SC-003**: 100% of interdependent selections produce option lists that contain only values compatible with the current form state, verified across all supported selection orders.
- **SC-004**: 100% of "x" → "No" actions keep the modal open with every entered value preserved, and 100% of "x" → "Yes" actions discard the entry without creating an appointment.
- **SC-005**: Zero double bookings occur when two Receptionists attempt to reserve the same doctor and time slot for the same date.
- **SC-006**: Zero duplicate appointments are created by repeated "Confirm" activations during a single creation.
- **SC-007**: A generated appointment table appears within 2 seconds for a day containing up to 300 appointments.
- **SC-008**: 100% of generated tables are ordered by time, doctor surname, doctor name, and service name as specified, verified on data sets containing ties in each key.
- **SC-009**: 100% of filter combinations return exactly the matching appointments, and changing the date refreshes the table without any additional action.
- **SC-010**: 100% of approved appointments remain "Approved" with a disabled "Approve" action after a page reload.
- **SC-011**: 100% of cancelled appointments disappear immediately from the table and never reappear after a reload.
- **SC-012**: 100% of failed creations, approvals, deletions, and list loads leave the user's data intact, report the failure, and offer a retry path.
- **SC-013**: A Receptionist can approve an appointment with a single action and no confirmation step, in under 5 seconds from locating the row.

## Assumptions

- The signed-in Receptionist role, session handling, and the authenticated area are delivered by the existing sign-in feature; this feature adds no authentication behaviour of its own.
- Doctor records include specialization, office, working hours, status, and the services they perform, as delivered by the doctor profile surfaces. The new feature reads these relationships and does not manage doctors.
- Specializations, services, and offices already exist as catalogs with an active/inactive state. "Active" for a patient means the patient record is selectable for a new appointment.
- "At work" is the doctor status that makes a doctor selectable; every other status makes the doctor unavailable for new appointments.
- Appointments are booked in 20-minute slots derived from the doctor's and office's working hours on the selected date; the example "11:00 - 11:20" in the input defines the slot length.
- New appointments start as "Not Approved"; approval is a single action with no confirmation dialog, and approval cannot be undone in this feature.
- Cancellation permanently deletes the appointment. There is no soft delete, cancellation reason, cancellation history, or audit trail, and a cancelled appointment does not free any recorded history.
- "Reschedule" is visible on every row but its workflow belongs to a separate feature; in this feature it is presented as unavailable and is not part of the acceptance scope.
- "Generate" builds the table from the current filters. Before the first generation only the filters and the buttons are shown; after generation, filter changes and date changes refresh the table automatically.
- The doctor and service filters use autocomplete over existing records; the office filter is a fixed list of active offices, and the status filter always has exactly one of "Approved", "Not Approved", or "All" selected.
- The table lists the appointments of a single selected date; there is no cross-date or date-range view in this feature.
- The date filter defaults to today when the page is opened, because reception work is day-oriented.
- The patient and doctor full names are displayed as "<first name> <last name>"; sorting uses surname first for doctors, as specified.
- Patient phone numbers are displayed exactly as stored, without formatting normalization or masking.
- "Create patient" reuses the existing patient creation flow and returns the new patient to the appointment modal. Building patient creation itself is outside this feature.
- The clinic operates in a single time zone and appointments are displayed in clinic local time; no time-zone selector exists.
- There is no pagination within a single day's results; the table scrolls instead.
- There is no conflict detection beyond slot booking: simultaneous approvals or cancellations by different users resolve to the last successful operation, and a failed operation reports an error.
- The confirmation dialogs are modal, remain open until "Yes" or "No" is chosen, and do not close on backdrop click.
- Users have an active network connection and a supported modern browser.

## Dependencies

- An existing authenticated session and Receptionist role information, as delivered by the sign-in feature.
- Existing doctor profiles providing specialization, office, working hours, status, and service assignments.
- Existing catalogs of active specializations, services, and offices.
- Existing patient records and the patient creation flow, which supplies both the patient picker and the "Create patient" action.
- An existing appointment store that supports creating, listing, filtering, approving, and permanently deleting appointments, including the ability to detect that a slot is already taken.
- Existing global error notification behaviour used to report failed creations, approvals, deletions, and list loads.
