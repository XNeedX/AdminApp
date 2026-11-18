# Feature Specification: Specialization Management

**Feature Branch**: `008-specialization-management`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Создай спецификацию для модуля Specializations (Create, View List, View Info, Edit, Change Status).

User Story 1: As a RECEPTIONIST I want to view specializations (List).
Preconditions: Signed in.
AC-1: Click “Specializations” menu item -> page with table is displayed.
AC-2: Table columns: specialization name, status (radiobuttons Active/Inactive).
AC-3: Contains “Create specialization” button.

User Story 2: As a RECEPTIONIST I want to create specialization.
AC-1: Click “Create specialization” -> modal/page displayed.
AC-2: Fields: name (text), status (radio Active/Inactive). Includes a table of services and buttons: “Confirm”, “Cancel”.
AC-3: Services table fields: service name, price, status (radio), service category name.
AC-9: Table has “Add service” button (adds new row).
AC-4: Valid Name + at least 1 row in table + Click “Confirm” -> save to DB.
AC-10: Name empty OR table empty -> “Confirm” disabled.
AC-5 to 8: Click Cancel -> dialog “Do you really want to cancel? Entered data will not be saved.” Yes -> to Specializations page, No -> stay on creation page.

User Story 3: As a RECEPTIONIST I want to view specialization’s info.
AC-1: Click on list row -> specialization detail page displayed.
AC-2: Displays Name, Status, Services table.
AC-3: Services table contains: service name, price, status (radio), category name.
AC-4: Contains “Edit” button.

User Story 4: As a RECEPTIONIST I want to edit specialization information.
Preconditions: On detail page.
AC-1: Click “Edit” -> Name becomes editable. Table gets “Add service” button.
AC-2: Buttons “Save changes”, “Cancel”.
AC-3: Name empty OR table empty -> “Save” disabled.
AC-4: Valid + “Save changes” -> update DB, switch to View mode.
AC-5 to 8: Click Cancel -> dialog “Do you really want to cancel? Changes will not be saved.” Yes -> switch to View mode without saving, No -> stay in Edit mode.

User Story 5: As a RECEPTIONIST I want to change specialization’s status.
Preconditions: On Specializations list or detail page.
AC-1: Change status -> update in DB immediately.
AC-2: Change to “Inactive” -> all related doctors and services get status “Inactive” in the system.

Fields validation (Create/Edit):
F-1 Name: Req, text. Empty on blur -> red border + \"Please, enter the name\".
F-2 Status: Req, radiobuttons (Active, Inactive). Default: Active."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the specializations list (Priority: P1)

A signed-in Receptionist opens the "Specializations" entry in the primary navigation and sees
the complete list of the clinic's medical specializations in a table. Each row shows the
specialization's name and its current status as an Active/Inactive radio pair, and every row
can be opened to see its details. The page also offers the entry point for creating a new
specialization.

**Why this priority**: The list is the module's home and the entry point for every other
workflow. Delivering only the list already gives the clinic a single, reliable view of its
specialization catalog and makes the remaining stories independently demonstrable.

**Independent Test**: Sign in as a Receptionist, click "Specializations" in the navigation, and
verify that the table is displayed with the columns "Specialization Name" and "Status", that
each row's status shows the stored Active/Inactive value as a radio pair, and that the
"Create specialization" button is present. Click a row and verify the detail page opens.

**Acceptance Scenarios**:

1. **Given** a signed-in Receptionist, **When** the Receptionist activates the
   "Specializations" navigation item, **Then** the Specializations page is displayed with a
   table of specializations.
2. **Given** the Specializations page is displayed, **When** the table is rendered, **Then**
   it contains exactly the columns "Specialization Name" and "Status", in that order.
3. **Given** the Specializations page is displayed, **When** a row is rendered, **Then** its
   Status cell shows an Active/Inactive radio pair with the specialization's stored status
   selected.
4. **Given** the Specializations page is displayed, **When** the page is rendered, **Then**
   it contains a "Create specialization" button.
5. **Given** the catalog contains both Active and Inactive specializations, **When** the list
   is displayed, **Then** every specialization is listed, including the Inactive ones.
6. **Given** the Specializations page is displayed, **When** the Receptionist clicks anywhere
   in a row other than its status radios, **Then** that specialization's detail page opens.
7. **Given** the Specializations page is displayed, **When** the catalog is empty, **Then** an
   explanatory empty state is shown instead of a blank table, and "Create specialization"
   remains available.
8. **Given** the list cannot be loaded, **When** the failure is reported, **Then** an error
   message is displayed with a retry action.
9. **Given** a user who is not a Receptionist, **When** they are signed in, **Then** the
   "Specializations" navigation item is not shown and the list cannot be opened.

---

### User Story 2 - Create a specialization (Priority: P2)

A signed-in Receptionist activates "Create specialization". A creation form is displayed with
the specialization name, its status (Active by default), and a services table. The Receptionist
adds one or more service rows with "Add service", fills in each service's name, price, status,
and category, and confirms. The specialization and its services are stored together and the
Receptionist returns to the list, where the new specialization appears. While the name is
empty, no services have been added, or any service row is incomplete, "Confirm" stays disabled.
"Cancel" always asks for confirmation before discarding the entered data.

**Why this priority**: Creation is the reason the catalog exists; without it the list has no
content to manage. It delivers the first complete write workflow and establishes the form and
services-table pattern reused by editing.

**Independent Test**: Sign in as a Receptionist, open "Specializations", click "Create
specialization", and verify the form contains the name field, the status radios with "Active"
selected, an empty services table, "Add service", "Confirm", and "Cancel". Verify "Confirm" is
disabled until a valid name and at least one complete service row exist. Fill valid data,
confirm, and verify the specialization appears in the list. Repeat the flow, click "Cancel",
choose "No", and verify the data is kept; then choose "Yes" and verify nothing is saved.

**Acceptance Scenarios**:

1. **Given** the Receptionist is on the Specializations page, **When** the Receptionist clicks
   "Create specialization", **Then** the specialization creation form is displayed.
2. **Given** the creation form is displayed, **When** it is rendered, **Then** it contains a
   "Name" text field, an Active/Inactive status radio pair with "Active" selected, a services
   table, an "Add service" button, a "Confirm" button, and a "Cancel" button.
3. **Given** the creation form has just opened, **When** the services table is rendered,
   **Then** it has the columns "Service Name", "Price", "Status", and "Service Category" and
   contains no rows.
4. **Given** the services table is rendered, **When** the Receptionist clicks "Add service",
   **Then** a new editable row is appended with an empty name, an empty price, no selected
   category, and status "Active".
5. **Given** a service row was added but not yet saved, **When** the Receptionist discards that
   row, **Then** the row disappears and the rest of the form is unchanged.
6. **Given** the name field is empty or contains only whitespace, **When** the form is rendered
   in any state, **Then** "Confirm" is disabled.
7. **Given** the services table contains no rows, **When** the form is rendered, **Then**
   "Confirm" is disabled.
8. **Given** at least one service row is incomplete or invalid, **When** the form is rendered,
   **Then** "Confirm" is disabled.
9. **Given** the name field is empty or whitespace-only, **When** the Receptionist leaves the
   field, **Then** the field gets a red border and the message "Please, enter the name" is shown.
10. **Given** a service row has an empty name, **When** the Receptionist leaves the field,
    **Then** the field gets a red border and the message "Please, enter the name" is shown.
11. **Given** a service row has an empty price, **When** the Receptionist leaves the field,
    **Then** the field gets a red border and the message "Please, enter the price" is shown.
12. **Given** a service row has a non-numeric price or a price of zero or less, **When** the
    Receptionist leaves the field, **Then** the field gets a red border and the message
    "You've entered an invalid price" is shown.
13. **Given** a service row has no category selected, **When** the Receptionist leaves the
    field, **Then** the field gets a red border and the message "Please, choose the service
    category" is shown.
14. **Given** a valid name, at least one complete service row, and a selected status, **When**
    the Receptionist clicks "Confirm", **Then** the specialization and all its service rows
    are saved, a success confirmation is shown, the list is displayed, and the new
    specialization is present.
15. **Given** the form is valid, **When** "Confirm" is activated more than once while the save
    is in progress, **Then** exactly one specialization is created.
16. **Given** the creation form is displayed, **When** the Receptionist clicks "Cancel",
    **Then** a dialog with the message "Do you really want to cancel? Entered data will not be
    saved." is displayed with the buttons "Yes" and "No".
17. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "Yes",
    **Then** the dialog closes, the Specializations list is displayed, and no specialization
    or service is saved.
18. **Given** the cancellation dialog is displayed and data was entered, **When** the
    Receptionist clicks "No", **Then** the dialog closes, the creation form remains displayed,
    and every entered value is preserved.
19. **Given** a valid submission fails, **When** the failure is reported, **Then** the form
    remains open with all entered values preserved, an error message is displayed, and the
    Receptionist can retry without creating duplicates.
20. **Given** the status radio pair is rendered on the creation form, **When** the Receptionist
    selects "Inactive" and saves, **Then** the specialization is created with status "Inactive".

---

### User Story 3 - View a specialization's information (Priority: P3)

A signed-in Receptionist clicks a row in the specializations list and lands on that
specialization's detail page. The page shows the name and status in read-only form and lists
the specialization's services with their name, price, status, and category. The page offers an
"Edit" action that starts the editing workflow.

**Why this priority**: The detail page is the landing state after creation and the starting
point for editing. It is independently demonstrable and delivers value as a reliable read-only
record of what a specialization contains.

**Independent Test**: Sign in as a Receptionist, open any specialization from the list, and
verify the page shows its name, its Active/Inactive status, and a services table with the
columns "Service Name", "Price", "Status", and "Service Category". Verify an "Edit" button is
present and that the name and service rows cannot be modified in view mode.

**Acceptance Scenarios**:

1. **Given** the Specializations list is displayed, **When** the Receptionist clicks a row,
   **Then** that specialization's detail page is displayed.
2. **Given** the detail page is displayed, **When** it is rendered, **Then** it shows the
   specialization's name, its status, and a services table.
3. **Given** the detail page is displayed, **When** the services table is rendered, **Then**
   it contains the columns "Service Name", "Price", "Status", and "Service Category" and lists
   every service of that specialization, including Inactive ones.
4. **Given** the detail page is displayed, **When** a service row is rendered, **Then** its
   status is shown as an Active/Inactive radio pair reflecting the stored value.
5. **Given** the detail page is displayed, **When** the page is rendered, **Then** it contains
   an "Edit" button.
6. **Given** the detail page is in View mode, **When** the Receptionist tries to change the
   name or any service row, **Then** nothing is editable and no "Add service" control is
   shown.
7. **Given** the detail page is in View mode, **When** the Receptionist changes the
   specialization's own status radio, **Then** the change is saved immediately (User Story 5).
8. **Given** the specialization has no services, **When** the detail page is displayed,
   **Then** an explanatory empty state is shown in the services area and "Edit" remains
   available.
9. **Given** the specialization cannot be found, **When** the page is opened, **Then** a
   "Specialization not found" message is displayed with a way back to the list.
10. **Given** the detail page cannot be loaded, **When** the failure is reported, **Then** an
    error message is displayed with a retry action.
11. **Given** the detail page is displayed, **When** the Receptionist uses the back action,
    **Then** the Specializations list is displayed.

---

### User Story 4 - Edit a specialization (Priority: P4)

From a specialization's detail page, a signed-in Receptionist activates "Edit". The name
becomes editable, the status radios are enabled, every service row becomes editable, and an
"Add service" action appears. The footer shows "Save changes" and "Cancel". While the name is
empty, the services table is empty, or any service row is incomplete, "Save changes" stays
disabled. Saving stores the changes and returns the page to View mode with the updated values.
"Cancel" always asks for confirmation before discarding the edits.

**Why this priority**: Correcting catalog data keeps the clinic's offering accurate. It builds
directly on the detail page and the form rules already exercised by creation, so it is smaller
than creation but still a complete, valuable workflow.

**Independent Test**: Sign in as a Receptionist, open a specialization, click "Edit", and
verify the name, status, and all service rows are editable and "Add service" is present. Clear
the name and verify "Save changes" is disabled and the inline message appears on blur. Change
values, save, and verify View mode shows the updated data. Re-enter Edit, change values, click
"Cancel", choose "No", and verify the edits remain; choose "Yes" and verify the stored values
are unchanged.

**Acceptance Scenarios**:

1. **Given** the detail page is in View mode, **When** the Receptionist clicks "Edit", **Then**
   the name becomes editable, the service rows become editable, the "Add service" button
   appears, and the footer shows "Save changes" and "Cancel".
2. **Given** the page enters Edit mode, **When** it is rendered, **Then** every field is
   pre-filled with the stored values of that specialization and its services.
3. **Given** the page is in Edit mode and the name is empty or whitespace-only, **When** the
   page is rendered, **Then** "Save changes" is disabled and, on blur, the name field gets a
   red border with the message "Please, enter the name".
4. **Given** the page is in Edit mode and the services table is empty, **When** the page is
   rendered, **Then** "Save changes" is disabled.
5. **Given** the page is in Edit mode and at least one service row is incomplete or invalid,
   **When** the page is rendered, **Then** "Save changes" is disabled and that row shows the
   same validation messages as creation.
6. **Given** the page is in Edit mode, **When** the Receptionist clicks "Add service", **Then**
   a new editable row is appended with empty name and price, no category, and status "Active".
7. **Given** a service row was added during editing but not yet saved, **When** the Receptionist
   discards that row, **Then** the row disappears and the stored services are unchanged.
8. **Given** all values are valid, **When** the Receptionist clicks "Save changes", **Then** the
   specialization and its services are updated, a success confirmation is shown, and the page
   returns to View mode with the updated values.
9. **Given** the form is valid, **When** "Save changes" is activated more than once while the
   save is in progress, **Then** only one update is applied.
10. **Given** a save fails, **When** the failure is reported, **Then** the page stays in Edit
    mode with every entered value preserved, an error message is displayed, and the Receptionist
    can retry.
11. **Given** the page is in Edit mode, **When** the Receptionist clicks "Cancel", **Then** a
    dialog with the message "Do you really want to cancel? Changes will not be saved." is
    displayed with the buttons "Yes" and "No".
12. **Given** the cancellation dialog is displayed, **When** the Receptionist clicks "Yes",
    **Then** the dialog closes, the page returns to View mode, and the stored values are
    unchanged.
13. **Given** the cancellation dialog is displayed and values were changed, **When** the
    Receptionist clicks "No", **Then** the dialog closes, the page remains in Edit mode, and
    every entered value is preserved.
14. **Given** the page is in Edit mode, **When** the Receptionist changes the specialization's
    status radios, **Then** the selection is staged and written only when "Save changes" is
    activated (unlike the immediate change outside Edit mode).
15. **Given** the Receptionist did not change any value, **When** all values are valid and
    "Save changes" is activated, **Then** saving succeeds without altering the stored data.

---

### User Story 5 - Change a specialization's status (Priority: P5)

A signed-in Receptionist changes a specialization between "Active" and "Inactive" directly from
the list or from the detail page. The new status is stored immediately, without a separate save
action. Setting a specialization to "Inactive" also makes all of its related doctors and
services inactive, so the clinic stops offering them everywhere. Setting it back to "Active"
does not automatically reactivate those related records.

**Why this priority**: Status control lets the clinic retire or restore a whole medical
direction without deleting records. It is a small, independent capability, but its cascade has
the widest business impact, so it comes after the individual CRUD flows.

**Independent Test**: Sign in as a Receptionist, change a specialization's status from the list,
reload, and verify the value persists. Change it to "Inactive" and verify that related doctors
and services now show "Inactive"; change it back to "Active" and verify they stay "Inactive"
until changed individually.

**Acceptance Scenarios**:

1. **Given** the Receptionist changes a specialization's status from the list or in View mode on
   the detail page, **When** the change is made, **Then** the new status is stored immediately
   and no separate save action is required.
2. **Given** a specialization's status was changed, **When** the page is reloaded, **Then** the
   new status is displayed.
3. **Given** the status radio pair is rendered, **When** it is displayed, **Then** it offers
   exactly "Active" and "Inactive".
4. **Given** a specialization is changed to "Inactive", **When** the change completes, **Then**
   the specialization is Inactive and every related doctor and service that was Active becomes
   Inactive as well.
5. **Given** a specialization is changed to "Inactive", **When** the change completes, **Then**
   related doctors and services that were already Inactive keep their status and are not
   reported as failures.
6. **Given** a specialization is changed to "Active", **When** the change completes, **Then**
   only the specialization's status changes; related doctors and services keep their current
   status and are not reactivated automatically.
7. **Given** a specialization's status changes, **When** the cascade is applied, **Then** only
   records related to that specialization are affected; other specializations, doctors, and
   services are unchanged.
8. **Given** a specialization's status changes, **When** the change completes, **Then** existing
   appointments and recorded appointment history are not modified.
9. **Given** a status change cannot be stored, **When** the failure is reported, **Then** the
   previously stored status is shown again, an error message is displayed, and no cascade is
   applied.
10. **Given** the Receptionist selects the status that is already set, **When** the selection is
    made, **Then** no change and no error occur.
11. **Given** a status change is in progress for a row, **When** the Receptionist tries to change
    the same row again, **Then** the second attempt is ignored until the first completes.
12. **Given** the detail page is in Edit mode, **When** the Receptionist changes the status
    radios, **Then** the change is not stored immediately but with "Save changes" (see User
    Story 4, scenario 14).

---

### Edge Cases

- **Whitespace-only name**: a specialization name consisting only of spaces is treated as empty
  and blocks saving with "Please, enter the name".
- **Name containing only spaces around text**: leading and trailing spaces are ignored when the
  name is stored.
- **Name length**: names longer than 100 characters are rejected and block saving with an inline
  message.
- **Duplicate specialization names**: two specializations may share the same name; this is not
  an error (consistent with the existing services catalog).
- **Zero services**: a specialization cannot be created or saved with an empty services table,
  even when the name is valid.
- **Incomplete service row**: a row missing a name, a price, or a category blocks "Confirm" and
  "Save changes" and shows the corresponding inline message.
- **Price formats**: `0`, negative numbers, text, and more than two fractional digits are
  rejected with "You've entered an invalid price"; a positive amount with up to two fractional
  digits is accepted. A decimal comma is accepted the same way as a decimal point.
- **Duplicate service names within one specialization**: allowed; names are not unique.
- **Status untouched**: specialization status and every service row always have exactly one
  selected value; new specializations and new service rows default to "Active".
- **Cancel with no changes**: "Cancel" still shows the confirmation dialog, even when nothing
  was typed or changed.
- **Discarding an added row**: only rows added in the current form session can be discarded;
  services that were already stored cannot be detached or deleted from the specialization by
  this feature.
- **Leaving without confirmation**: navigation away, browser back, or reload discards unsaved
  values without a prompt; only "Cancel" is confirmed.
- **Partial save**: if any part of a create or save request fails, the user is not shown a
  success state; the form stays open with all data and the operation can be retried without
  creating duplicate specializations or services.
- **Deactivation cascade and failures**: if the cascade cannot be completed, the user is told
  that the status change could not be fully applied; the specialization is not left showing a
  success state.
- **Repeated deactivation**: setting an already Inactive specialization to Inactive again does
  not duplicate any cascade or produce an error.
- **Inactive specialization visibility**: inactive specializations stay visible to clinic staff
  in the list and detail page so they can be reactivated.
- **Concurrent edits**: the last successful save wins; there is no conflict detection. If the
  specialization no longer exists, an error message is shown.
- **Stale list responses**: a slower earlier response must not overwrite a newer status selection
  shown in the list.
- **Large catalog**: the list and the services tables remain usable (scrollable, responsive)
  with hundreds of specializations or dozens of services.
- **Confirmation dialog interaction**: the dialog is keyboard operable, moves focus into the
  dialog when opened, and does not close on backdrop click unless "Yes" or "No" is chosen.

## Requirements *(mandatory)*

### Functional Requirements

**Access and navigation**

- **FR-001**: The system MUST show a "Specializations" item in the primary navigation to
  signed-in Receptionists only.
- **FR-002**: The system MUST deny the specializations screens to every role other than
  Receptionist, including direct URL access.
- **FR-003**: The system MUST provide a Specializations list page, a specialization detail page,
  and an editing mode on the detail page.

**List**

- **FR-004**: The list MUST display every specialization, regardless of status, in a table with
  the columns "Specialization Name" and "Status", in that order.
- **FR-005**: Each list row MUST show the specialization's status as an Active/Inactive radio
  pair with the stored value selected.
- **FR-006**: Each list row MUST open the specialization's detail page when activated, except
  when the activation targets its status radios.
- **FR-007**: The list MUST contain a "Create specialization" button that opens the creation
  form.
- **FR-008**: The list MUST show distinct loading, empty, and retryable error states.
- **FR-009**: The list MUST present specializations in a predictable order (alphabetical by
  name).

**Create**

- **FR-010**: The creation form MUST contain a "Name" text field, an Active/Inactive status
  radio pair defaulting to "Active", a services table, an "Add service" button, "Confirm", and
  "Cancel".
- **FR-011**: The services table MUST have the columns "Service Name", "Price", "Status", and
  "Service Category", and MUST start with no rows.
- **FR-012**: "Add service" MUST append one editable service row with an empty name and price,
  no selected category, and status "Active".
- **FR-013**: A service row added in the current session MUST be discardable before the
  specialization is saved.
- **FR-014**: "Confirm" MUST be disabled while the name is empty or whitespace-only, while the
  services table is empty, or while any service row is incomplete or invalid.
- **FR-015**: Activating "Confirm" with a valid name, at least one complete service row, and a
  selected status MUST persist the specialization and every service row together.
- **FR-016**: A successful creation MUST show a success confirmation, display the list, and
  include the new specialization in it.
- **FR-017**: Repeated activations of "Confirm" while a save is in progress MUST NOT create more
  than one specialization.
- **FR-018**: Activating "Cancel" MUST always open a confirmation dialog with the message
  "Do you really want to cancel? Entered data will not be saved." and the buttons "Yes" and
  "No".
- **FR-019**: Choosing "Yes" in the creation cancel dialog MUST discard the entered data and
  display the Specializations list without saving anything.
- **FR-020**: Choosing "No" in the creation cancel dialog MUST return to the creation form with
  every entered value preserved.
- **FR-021**: A failed creation MUST keep the form open with every entered value, show an error
  message, and allow a retry without creating duplicates.

**Detail**

- **FR-022**: The detail page MUST display the specialization's name, its status, and its
  services table with the columns "Service Name", "Price", "Status", and "Service Category".
- **FR-023**: The detail page MUST list every service of the specialization, including Inactive
  ones, with its status shown as an Active/Inactive radio pair reflecting the stored value.
- **FR-024**: The detail page MUST contain an "Edit" button and a way back to the list.
- **FR-025**: In View mode, the name and service rows MUST NOT be editable and no "Add service"
  control MUST be shown.
- **FR-026**: The detail page MUST show distinct loading, not-found, retryable error, and empty
  services states.

**Edit**

- **FR-027**: Activating "Edit" MUST make the name editable, enable the service row fields, show
  the "Add service" button, and replace the page actions with "Save changes" and "Cancel".
- **FR-028**: Edit mode MUST be pre-filled with the stored specialization and service values.
- **FR-029**: "Save changes" MUST be disabled while the name is empty or whitespace-only, while
  the services table is empty, or while any service row is incomplete or invalid.
- **FR-030**: "Add service" and row discarding in Edit mode MUST behave as in creation.
- **FR-031**: A valid "Save changes" MUST persist the specialization and all its service rows,
  show a success confirmation, and return the page to View mode with the updated values.
- **FR-032**: Repeated activations of "Save changes" while a save is in progress MUST apply at
  most one update.
- **FR-033**: A failed save MUST keep the page in Edit mode with every entered value, show an
  error message, and allow a retry.
- **FR-034**: Activating "Cancel" in Edit mode MUST always open a confirmation dialog with the
  message "Do you really want to cancel? Changes will not be saved." and the buttons "Yes" and
  "No".
- **FR-035**: Choosing "Yes" in the edit cancel dialog MUST discard the edits and return the page
  to View mode showing the stored values.
- **FR-036**: Choosing "No" in the edit cancel dialog MUST keep the page in Edit mode with every
  entered value preserved.
- **FR-037**: Detaching, deleting, or archiving existing services from a specialization is out of
  scope; only their values can be edited and new services can be added.

**Status and cascade**

- **FR-038**: The specialization's status MUST be changeable from the list and from the detail
  page in View mode, and the new value MUST be persisted immediately without a separate save
  action.
- **FR-039**: While the detail page is in Edit mode, status selections MUST be staged and
  persisted only with "Save changes".
- **FR-040**: Changing a specialization to "Inactive" MUST set every related doctor and every
  related service that is Active to "Inactive".
- **FR-041**: Changing a specialization to "Active" MUST NOT automatically reactivate related
  doctors or services.
- **FR-042**: The cascade MUST affect only records related to the changed specialization.
- **FR-043**: Existing appointments and appointment history MUST NOT be modified by a status
  change.
- **FR-044**: A failed status change MUST restore the previously displayed status, show an error
  message, and leave the related records unchanged.
- **FR-045**: Selecting the status that is already set MUST NOT trigger a change or an error.
- **FR-046**: A status control MUST ignore further changes while its own update is in progress.

**Validation and feedback**

- **FR-047**: An empty or whitespace-only specialization name MUST show a red border and the
  message "Please, enter the name" once the field is left, and MUST block saving.
- **FR-048**: A name longer than 100 characters MUST be rejected with an inline message and MUST
  block saving.
- **FR-049**: Service rows MUST follow the clinic's existing service rules: name required, price
  required and greater than zero, category required, status required and defaulting to "Active".
- **FR-050**: Service row validation MUST use the messages "Please, enter the name",
  "Please, enter the price", "You've entered an invalid price", and
  "Please, choose the service category", shown with a red border after the field is left.
- **FR-051**: Validation messages MUST remain visible until the corresponding value becomes valid,
  and invalid controls MUST be exposed to assistive technology.
- **FR-052**: The system MUST report every failed operation with a user-readable message and keep
  the user's entered data intact.
- **FR-053**: The creation form, edit mode, confirmation dialogs, status radios, and "Add service"
  actions MUST be operable with a keyboard alone.

### Field Validation Rules

| Field | Required | Rule | Message (exact) |
|-------|----------|------|-----------------|
| Specialization name | Yes | Text; trimmed; not whitespace-only; at most 100 characters | `Please, enter the name` |
| Specialization status | Yes | Exactly one of `Active`, `Inactive`; defaults to `Active` | — (always selected) |
| Service name | Yes | Text; not whitespace-only | `Please, enter the name` |
| Service price | Yes | Numeric, greater than zero, at most two fractional digits | `Please, enter the price` when empty; `You've entered an invalid price` when invalid |
| Service category | Yes | One of `Analyses`, `Consultations`, `Diagnostics` | `Please, choose the service category` |
| Service status | Yes | Exactly one of `Active`, `Inactive`; defaults to `Active` | — (always selected) |
| Services table | Yes | At least one row, and every row valid | — ("Confirm"/"Save changes" disabled) |

### Key Entities

- **Specialization**: A medical direction offered by the clinic. Key attributes: name and status
  (`Active`/`Inactive`). It owns a collection of services. It has no price or category of its
  own.
- **Service**: A billable item offered within a specialization. Key attributes: name, price,
  status (`Active`/`Inactive`), and service category. Each service belongs to exactly one
  specialization.
- **Service category**: The fixed classification of a service: `Analyses`, `Consultations`, or
  `Diagnostics`.
- **Doctor**: A clinic staff member associated with one specialization. A doctor has a status
  that includes `Inactive`. Many doctors may be associated with one specialization; they are
  affected by the specialization's deactivation cascade.
- **Appointment**: A booked visit that references a doctor and a service. Appointments and their
  recorded history are not changed by status changes in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Receptionist can open the specializations list from sign-in in at most 2 actions,
  and the table is visible within 2 seconds for a catalog of up to 200 specializations.
- **SC-002**: A Receptionist can create a specialization with three services in under 2 minutes
  from opening the creation form.
- **SC-003**: 100% of attempts to save with an empty name, no services, or an incomplete service
  row are blocked; no invalid specialization is stored.
- **SC-004**: 0 duplicate specializations are produced by repeated or double submissions of the
  same creation or edit form.
- **SC-005**: A status change is visible in the list immediately and remains after a reload in
  100% of successful changes.
- **SC-006**: After a specialization is set to Inactive, 100% of its related doctors and services
  show "Inactive" the next time they are viewed, within 5 seconds of the change completing.
- **SC-007**: 100% of cancellations follow the dialog contract: "Yes" never saves and "No" never
  discards entered data.
- **SC-008**: A Receptionist can open a specialization's detail view in a single action from the
  list.
- **SC-009**: 100% of specialization and service records saved through this module are retrievable
  after a reload.
- **SC-010**: 95% of first-time users complete specialization creation without assistance or
  support requests.
- **SC-011**: All five workflows (list, create, view, edit, change status) can be completed using
  only a keyboard.

## Assumptions

- **Create surface**: "Create specialization" opens a modal dialog over the Specializations
  list (the module's "modal/page" choice), while the detail view is a dedicated page and editing
  happens in place on that page. After a successful creation the Receptionist returns to the
  list.
- **Navigation**: The "Specializations" entry is added to the primary navigation alongside the
  existing "Appointments", "Doctors", and "Services" entries; existing entries are not removed
  by this feature.
- **List behavior**: The list shows all specializations in one view, alphabetically by name, with
  no search, filter, sort, or pagination controls; those capabilities are out of scope.
- **Duplicate names**: Specialization names are not unique; duplicates are permitted, matching
  the existing services catalog.
- **Name length**: Names are limited to 100 characters, trimmed before storage.
- **Specialization attributes**: The specialization itself carries only a name and a status;
  price and category belong to its services, not to the specialization.
- **Service rows**: Service rows created or edited inside the specialization form follow the same
  rules and messages as the existing clinic services capability (name, positive price, three
  categories, Active/Inactive status defaulting to Active).
- **Row editing and removal**: Existing service rows are editable in Edit mode; rows added in the
  current session can be discarded before saving; detaching, deleting, or archiving stored
  services is out of scope.
- **Status timing**: Outside Edit mode, specialization status changes apply immediately from the
  list and from the detail view. In Edit mode, status changes are part of the form and persist
  with "Save changes".
- **Status vocabulary**: Only the two values "Active" and "Inactive" exist for specializations and
  services in this module.
- **Cascade direction**: The deactivation cascade is one-way. Reactivating a specialization does
  not reactivate its doctors or services; each must be reactivated individually in its own
  module.
- **Cascade propagation**: The cascade may complete shortly after the status change; the next
  view of an affected doctor or service reflects the new status.
- **Appointments**: Existing appointments and recorded results remain intact after a
  specialization or service is deactivated.
- **No confirmation for status changes**: Status changes are saved without a confirmation dialog;
  only "Cancel" actions are confirmed.
- **Concurrency**: The last successful save wins; there is no conflict detection or locking
  beyond preventing duplicate in-flight submissions from the same screen.
- **Currency and locale**: Prices are shown in the clinic's single currency using the same
  formatting as the existing services pages.
- **Roles**: Only the Receptionist role uses this module; other roles, including Doctor and
  Patient, have no access to these screens in the admin application.
- **Devices**: The module is responsive and usable on mobile widths, including small-screen
  layouts for the list, detail, and creation form.
