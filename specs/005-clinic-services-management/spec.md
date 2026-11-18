# Feature Specification: Clinic Services Management

**Feature Branch**: `005-clinic-services-management`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Создай спецификацию для функционала управления услугами клиники (Services: Create, View, Edit, Change Status).

User Story 1: As a RECEPTIONIST I want to create service.
Preconditions: Signed in.
AC-1: Click “Add service” -> modal window/page for creation is displayed.
AC-2: Fields: service name (text, req), price (numeric, req), status (radio Active/Inactive), service category (dropdown). Buttons: “Confirm”, “Cancel”.
AC-3: Required empty or invalid -> “Confirm” disabled.
AC-4: All valid + “Confirm” -> add Service to system.
AC-5: Click "Cancel" -> show dialog “Do you really want to cancel? Entered data will not be saved.”
AC-6: Dialog buttons: “Yes”, “No”.
AC-7: Dialog "Yes" -> close dialog, go to previous page.
AC-8: Dialog "No" -> close dialog, stay on creation page with data.
AC-9: Categories: analyses, consultation, diagnostics.

User Story 2: As a RECEPTIONIST I want to change service’s status.
AC-1: Change status -> system changes status in DB.
AC-2: Change to “Inactive” -> service becomes invisible for patients.

User Story 3: As a RECEPTIONIST I want to edit service information.
Preconditions: On “Service information” page.
AC-1: Click “Edit” -> fields become editable.
AC-2: Buttons: “Save changes”, “Cancel”.
AC-3: Invalid/empty -> “Save changes” disabled.
AC-4: Valid + “Save changes” -> update DB, switch to View mode with updated data.
AC-5: Click "Cancel" -> dialog “Do you really want to cancel? Changes will not be saved.”
AC-7: Dialog "Yes" -> close dialog, switch to View mode, changes not saved.
AC-8: Dialog "No" -> stay in Edit mode.

User Story 4: As a RECEPTIONIST I want to view service’s info.
AC-1: Click on service row (on Specialization info page) -> service page displayed.
AC-2: Fields: service name, price, category, status (radio).
AC-3: Contains “Edit” button.

Fields description (Shared for Create & Edit):
F-1 Service name: Req, text. Empty on blur -> red border, “Please, enter the name”.
F-2 Price: Req, number. Non-numeric or <= 0 on blur -> red border, “You've entered an invalid price”. Empty on blur -> red border, “Please, enter the price”.
F-3 Service category: Req, dropdown (analyses, consultation, diagnostics). Empty on blur -> red border, “Please, choose the service category”.
F-4 Status: Req, radiobuttons (Active, Inactive). Default: Active."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a service (Priority: P1)

A signed-in Receptionist is on the "Specialization info" page and activates "Add service". A creation form is displayed containing the service name, price, service category, and status, with the status pre-set to "Active" and the other fields empty. The Receptionist fills in the values. While any required field is empty or invalid, "Confirm" stays disabled. Once all values are valid, "Confirm" stores the new service under the specialization the Receptionist is working in, and the new service appears in that specialization's service list. Activating "Cancel" asks for confirmation before leaving the creation form and discarding everything typed.

**Why this priority**: Adding services is the reason the management surface exists; without creation there is nothing to view, edit, or deactivate. Delivering only this story already lets a Receptionist grow the clinic's service catalog.

**Independent Test**: Sign in as a Receptionist, open a specialization's page, click "Add service", and verify "Confirm" is disabled. Leave each required field empty on blur and verify the exact inline messages and red borders. Fill a valid name, a positive price, and a category, then click "Confirm" and verify the service is created and listed. Repeat the flow, type values, click "Cancel", choose "No", and verify the data is preserved; then choose "Yes" and verify the previous page is shown and no service was created.

**Acceptance Scenarios**:

1. **Given** the Receptionist is on the "Specialization info" page, **When** the Receptionist clicks "Add service", **Then** the service creation form is displayed with empty name, empty price, no selected category, and status "Active".
2. **Given** the creation form is displayed, **When** it is rendered, **Then** it contains the fields service name, price, service category, and status, and the buttons "Confirm" and "Cancel".
3. **Given** the creation form is displayed and at least one required field is empty or invalid, **When** the form is rendered, **Then** "Confirm" is disabled.
4. **Given** all required fields contain valid values, **When** the Receptionist clicks "Confirm", **Then** the service is added to the system under the specialization being viewed and appears in that specialization's service list.
5. **Given** the creation form is displayed, **When** the Receptionist clicks "Cancel", **Then** a dialog with the message "Do you really want to cancel? Entered data will not be saved." is displayed with the buttons "Yes" and "No".
6. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "Yes", **Then** the dialog closes, the previous page is displayed, and no service is created.
7. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "No", **Then** the dialog closes, the creation form remains displayed, and every entered value is preserved.
8. **Given** the creation form is displayed, **When** the Receptionist leaves the name empty on blur, **Then** the field gets a red border and the message "Please, enter the name" is shown.
9. **Given** the creation form is displayed, **When** the Receptionist leaves the price empty on blur, **Then** the field gets a red border and the message "Please, enter the price" is shown.
10. **Given** the creation form is displayed, **When** the Receptionist enters a non-numeric price or a price less than or equal to zero and leaves the field, **Then** the field gets a red border and the message "You've entered an invalid price" is shown.
11. **Given** the creation form is displayed, **When** the Receptionist leaves the service category unselected on blur, **Then** the field gets a red border and the message "Please, choose the service category" is shown.
12. **Given** the service category dropdown is opened, **When** it is rendered, **Then** it offers exactly the categories "Analyses", "Consultations", and "Diagnostics".
13. **Given** the creation form is displayed, **When** the Receptionist selects "Inactive" and submits a valid form, **Then** the service is created with the status "Inactive".
14. **Given** the Receptionist activates "Confirm" while a creation request is already in progress, **When** the second activation happens, **Then** no duplicate service is created.

---

### User Story 2 - View service information (Priority: P2)

A signed-in Receptionist clicks a service row in the service list of the "Specialization info" page and is taken to that service's information page. The page displays the service name, price, category, and status in read-only form and offers an "Edit" button that starts the editing flow.

**Why this priority**: The information page is the landing state after creation and the starting point for editing and status changes. It is independently demonstrable and delivers immediate value as a reliable read-only record.

**Independent Test**: Sign in as a Receptionist, open a specialization's service list, click any service row, and verify that the service page opens showing the name, price, category, and current status with an "Edit" button, and that no field can be modified until "Edit" is activated.

**Acceptance Scenarios**:

1. **Given** the Receptionist is on the "Specialization info" page with its service list, **When** the Receptionist clicks a service row, **Then** that service's information page is displayed.
2. **Given** the service information page is displayed, **When** it is rendered, **Then** it shows the service name, price, category, and current status.
3. **Given** the service information page is displayed, **When** it is rendered, **Then** it contains an "Edit" button.
4. **Given** the service information page is displayed in View mode, **When** the Receptionist tries to change any value, **Then** nothing is editable until "Edit" is activated.
5. **Given** a service whose status is "Inactive", **When** the Receptionist opens its information page, **Then** the page displays the service and its "Inactive" status instead of hiding it.

---

### User Story 3 - Edit service information (Priority: P3)

From the service information page, a signed-in Receptionist activates "Edit". The fields become editable and are pre-filled with the stored values, and the footer shows "Save changes" and "Cancel". While any required field is empty or invalid, "Save changes" stays disabled. When every required field is valid, "Save changes" stores the changes and returns the page to View mode showing the updated data. Activating "Cancel" asks for confirmation before discarding the edits.

**Why this priority**: Correcting service data keeps the catalog accurate. It builds directly on the view page and the same field rules as creation, so it is smaller than creation but still a complete, valuable workflow.

**Independent Test**: Sign in as a Receptionist, open a service, click "Edit", clear the name, and verify "Save changes" is disabled and the inline message appears on blur. Enter a valid name, price, and category, click "Save changes", and verify the page returns to View mode with the new values. Re-enter Edit, change values, click "Cancel", choose "No", and verify the edits remain; choose "Yes" and verify the stored values are unchanged.

**Acceptance Scenarios**:

1. **Given** the service information page is in View mode, **When** the Receptionist clicks "Edit", **Then** the fields become editable and are pre-filled with the stored values.
2. **Given** the service page is in Edit mode, **When** the footer is rendered, **Then** it shows the buttons "Save changes" and "Cancel".
3. **Given** the service page is in Edit mode and at least one required field is empty or invalid, **When** the page is rendered, **Then** "Save changes" is disabled.
4. **Given** all required fields contain valid values, **When** the Receptionist clicks "Save changes", **Then** the service is updated and the page returns to View mode showing the updated values.
5. **Given** the service page is in Edit mode, **When** the Receptionist clicks "Cancel", **Then** a dialog with the message "Do you really want to cancel? Changes will not be saved." is displayed with the buttons "Yes" and "No".
6. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "Yes", **Then** the dialog closes, the page returns to View mode, and none of the entered changes are saved.
7. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "No", **Then** the dialog closes and the page remains in Edit mode with every entered value preserved.
8. **Given** the service page is in Edit mode, **When** the Receptionist leaves the name empty on blur, **Then** the field gets a red border and the message "Please, enter the name" is shown.
9. **Given** the service page is in Edit mode, **When** the Receptionist leaves the price empty on blur, **Then** the field gets a red border and the message "Please, enter the price" is shown.
10. **Given** the service page is in Edit mode, **When** the Receptionist enters a non-numeric price or a price less than or equal to zero and leaves the field, **Then** the field gets a red border and the message "You've entered an invalid price" is shown.
11. **Given** the service page is in Edit mode, **When** the Receptionist leaves the service category unselected on blur, **Then** the field gets a red border and the message "Please, choose the service category" is shown.
12. **Given** the service page is in Edit mode and the Receptionist did not change any value, **When** all required fields are valid, **Then** "Save changes" is enabled and saving completes successfully without altering the stored data.
13. **Given** a save fails, **When** the failure is reported, **Then** the page remains in Edit mode with all entered values preserved, an error notification is displayed, and the Receptionist can retry.

---

### User Story 4 - Change a service's status (Priority: P4)

A signed-in Receptionist changes a service's status between "Active" and "Inactive". The new status is stored immediately and reflected everywhere the service is displayed. Setting a service to "Inactive" removes it from what patients can see, while keeping it visible and manageable for clinic staff.

**Why this priority**: Status control lets the clinic retire a service without deleting it. It is a small, independent operational capability built on the same status model as creation and editing.

**Independent Test**: Sign in as a Receptionist, change a service to "Inactive", confirm the value persists after reloading, and confirm the service no longer appears in the patient-facing catalog. Change it back to "Active" and confirm it reappears.

**Acceptance Scenarios**:

1. **Given** the Receptionist changes a service's status, **When** the change is confirmed, **Then** the new status is stored.
2. **Given** a service is set to "Inactive", **When** a patient views the clinic catalog, **Then** that service is not visible.
3. **Given** a service is set to "Active", **When** a patient views the clinic catalog, **Then** that service is visible.
4. **Given** a service's status was changed, **When** the page is reloaded, **Then** the new status is displayed.
5. **Given** the status control is opened, **When** it is rendered, **Then** it offers exactly "Active" and "Inactive".
6. **Given** a status change cannot be stored, **When** the failure is reported, **Then** the previously stored status is shown again and an error notification is displayed.
7. **Given** the Receptionist selects the status that is already set, **When** the selection is confirmed, **Then** no unintended change occurs and no error is shown.

---

### Edge Cases

- **Whitespace-only name**: a name consisting only of spaces is treated as empty and blocks saving with "Please, enter the name".
- **Price formats**: values such as `0`, negative numbers, text, multiple separators, or more than two fractional digits are rejected with "You've entered an invalid price"; a valid positive amount with up to two fractional digits is accepted.
- **Price with a comma separator**: a decimal comma is accepted the same way as a decimal point.
- **Duplicate service names**: two services may share the same name; names are not unique and this is not an error.
- **Category left unselected**: the dropdown has no default, so an untouched category keeps "Confirm"/"Save changes" disabled.
- **Status untouched**: the status always has exactly one selected value; on creation it defaults to "Active".
- **Saving without changes**: "Save changes" is enabled when all required fields are valid even if nothing changed; saving is a successful no-op.
- **Double submission**: repeated activations of "Confirm" or "Save changes" while a request is in progress are ignored.
- **Create or save failure**: the form stays open with all entered values preserved, an error notification is shown, and the user can retry.
- **Leaving without confirmation**: navigation away, browser back, or page reload discards unsaved values without a prompt; only "Cancel" is confirmed.
- **Specialization context lost**: if the specialization the service belongs to can no longer be resolved, the service cannot be created and an error notification is shown.
- **Service changed or removed by another user**: the next successful save or status change wins; there is no conflict detection. If the service no longer exists, an error notification is shown.
- **Inactive service and staff views**: staff management pages still list and open inactive services so they can be reactivated; only patient-facing views hide them.
- **Very long name**: a name above the accepted maximum length is rejected with an inline message and blocks saving.
- **Confirmation dialog interaction**: the dialog is keyboard operable, moves focus into the dialog when opened, and does not close on backdrop click unless "Yes" or "No" is chosen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a signed-in Receptionist to start creating a service from the "Specialization info" page via an "Add service" action.
- **FR-002**: The service creation form MUST contain the fields service name, price, service category, and status, and the buttons "Confirm" and "Cancel".
- **FR-003**: The creation form MUST open with an empty name, an empty price, no selected category, and the status "Active".
- **FR-004**: The service category control MUST be a dropdown offering exactly "Analyses", "Consultations", and "Diagnostics", with no default selection.
- **FR-005**: The status control MUST offer exactly "Active" and "Inactive" and MUST always have exactly one value selected.
- **FR-006**: "Confirm" MUST be disabled whenever any required field is empty or invalid, and MUST be enabled only when all required fields are valid.
- **FR-007**: When "Confirm" is activated with all required fields valid, the system MUST store the new service under the specialization the Receptionist is viewing and make it appear in that specialization's service list.
- **FR-008**: Activating "Cancel" on the creation form MUST display a confirmation dialog containing exactly "Do you really want to cancel? Entered data will not be saved." with the buttons "Yes" and "No".
- **FR-009**: Activating "Yes" in the creation cancellation dialog MUST close the dialog, return the user to the previous page, and discard the entered data without creating a service.
- **FR-010**: Activating "No" in the creation cancellation dialog MUST close the dialog, keep the creation form open, and preserve every entered value.
- **FR-011**: The system MUST validate required fields when they lose focus and MUST show a red border together with the following messages:
  - Service name empty — "Please, enter the name".
  - Price empty — "Please, enter the price".
  - Price non-numeric or less than or equal to zero — "You've entered an invalid price".
  - Service category not selected — "Please, choose the service category".
- **FR-012**: The system MUST reject a price that is not a positive number with at most two fractional digits, and such a value MUST prevent creation and saving.
- **FR-013**: The system MUST display a service information page when a Receptionist selects a service row on the "Specialization info" page.
- **FR-014**: The service information page MUST display, in View mode, the service name, price, category, and current status.
- **FR-015**: The service information page MUST display an "Edit" button in View mode and MUST keep every field non-editable until "Edit" is activated.
- **FR-016**: The service information page MUST display services whose status is "Inactive" to clinic staff, including their status.
- **FR-017**: Activating "Edit" MUST switch the service page to Edit mode, pre-fill every editable field with the stored value, and make those fields editable.
- **FR-018**: Edit mode MUST present a footer containing the buttons "Save changes" and "Cancel".
- **FR-019**: Edit mode MUST apply the same field set, validation rules, and error messages as the creation form.
- **FR-020**: "Save changes" MUST be disabled whenever any required field is empty or invalid, and MUST be enabled only when all required fields are valid.
- **FR-021**: When "Save changes" is activated with all required fields valid, the system MUST store the changes and return the page to View mode showing the updated values.
- **FR-022**: Activating "Cancel" in Edit mode MUST display a confirmation dialog containing exactly "Do you really want to cancel? Changes will not be saved." with the buttons "Yes" and "No".
- **FR-023**: Activating "Yes" in the edit cancellation dialog MUST close the dialog, discard all entered changes, leave the stored service unchanged, and return the page to View mode.
- **FR-024**: Activating "No" in the edit cancellation dialog MUST close the dialog, keep the page in Edit mode, and preserve every entered value.
- **FR-025**: The system MUST preserve all entered values and keep the form open when a creation or save fails, MUST display an error notification, and MUST allow the user to retry.
- **FR-026**: The system MUST ignore repeated "Confirm" or "Save changes" activations while a request is already in progress, so that no duplicate service is created and no duplicate save is sent.
- **FR-027**: The system MUST allow a signed-in Receptionist to change a service's status between "Active" and "Inactive", and MUST store the new status immediately.
- **FR-028**: A service whose status is "Inactive" MUST NOT be visible in patient-facing catalog views; a service whose status is "Active" MUST be visible there.
- **FR-029**: A status change MUST be reflected in every staff view of that service after the change and after a page reload.
- **FR-030**: If a status change cannot be stored, the system MUST restore the previously displayed status and show an error notification.
- **FR-031**: Selecting the status that is already set MUST NOT produce an unintended change or an error.
- **FR-032**: Only a signed-in Receptionist may create, view, edit, or change the status of a service; users without that role MUST NOT reach these capabilities.
- **FR-033**: The confirmation dialogs MUST be keyboard operable and MUST move focus into the dialog when they open.
- **FR-034**: The creation form MUST accept service names up to the accepted maximum length and MUST reject longer values with an inline message that blocks saving.

### Key Entities

- **Service**: A billable medical service offered by the clinic. Attributes: name, price, category, status, and the specialization it belongs to. Each service belongs to exactly one specialization.
- **Specialization**: The medical discipline that groups services and is the context in which services are created, listed, and opened. Its own name, price, and status are managed outside this feature.
- **Service Category**: One of "Analyses", "Consultations", or "Diagnostics". Every service has exactly one category.
- **Service Status**: "Active" or "Inactive". "Active" services are visible to patients; "Inactive" services are hidden from patients but remain visible to clinic staff.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Receptionist can create a complete, valid service in under 1 minute from opening the creation form.
- **SC-002**: 100% of attempts to create or save a service with at least one empty or invalid required field are blocked, and the corresponding action button is disabled in every such case.
- **SC-003**: 100% of "Cancel" → "Yes" actions leave the stored catalog exactly as it was before the form was opened.
- **SC-004**: 100% of "Cancel" → "No" actions keep the form open with every entered value preserved.
- **SC-005**: 100% of successful saves display the updated values in View mode immediately, without a manual page reload.
- **SC-006**: 100% of services set to "Inactive" are absent from patient-facing catalog views, verified across repeated checks.
- **SC-007**: 100% of status changes are visible after reloading the page, with no stale values.
- **SC-008**: 100% of creation and save failures keep the user's data intact and offer a retry path.
- **SC-009**: Zero duplicate services are created by repeated activations of "Confirm" during a single creation.

## Assumptions

- Services are managed in the context of a specialization: "Add service" is started from the "Specialization info" page, and the new service inherits that specialization. The specialization is therefore not a field in the creation or edit form.
- The "Specialization info" page and its service list are a prerequisite surface; this feature adds the "Add service" action, the row navigation to the service page, and the service creation, view, edit, and status capabilities. Building the specialization page itself is outside this feature.
- The creation form is presented as a modal dialog over the "Specialization info" page; the confirmation dialogs are modal as well.
- "Previous page" after cancelling creation means the page the Receptionist came from, which is the "Specialization info" page.
- The service category dropdown is not pre-selected, so the Receptionist must make an explicit choice; only the status has a default ("Active").
- Prices are positive amounts with up to two fractional digits, displayed in the clinic's single default currency; there is no currency selector and no tax handling.
- Service names are not unique; duplicate names are allowed and are not treated as an error.
- In View mode the status is presented with the same "Active"/"Inactive" options and is not changeable until "Edit" is activated.
- The maximum service name length follows the existing catalog conventions; where no convention exists, a reasonable limit is applied and reported inline.
- Error wording, validation messages, and category labels follow the existing clinic service conventions; the messages listed in this specification are authoritative for the new forms. The category labels are "Analyses", "Consultations", and "Diagnostics" — the input's "consultation" refers to the same category, and the plural form matches the existing catalog.
- Clinic staff management pages show services of both statuses; only patient-facing views filter out "Inactive" services.
- Leaving a form through navigation, browser back, or reload discards unsaved values without a prompt; only "Cancel" is confirmed.
- There is no audit history, change log, approval workflow, or concurrency conflict resolution for services; the last successful change wins.
- The service status is the only lifecycle state; services are not deleted by this feature.
- Users have an active network connection and a supported modern browser.

## Dependencies

- An existing authenticated session and role information for Receptionists, as delivered by the sign-in feature.
- An existing service catalog store that supports creating, reading, updating, and changing the status of a service.
- The "Specialization info" page and its service list, which provide the entry points for creating a service and opening a service row.
- Existing service category and status definitions shared with the patient-facing catalog.
- Existing patient-facing catalog behaviour that hides "Inactive" services, which this feature relies on to satisfy the visibility rule.
- Existing global error notification behaviour used to report failed creation, saving, and status changes.
