# Feature Specification: Receptionist Management

**Feature Branch**: `009-receptionist-management`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Создай спецификацию для модуля Receptionists (Create, View List, View Profile, Edit, Delete).

User Story 1: As a RECEPTIONIST I want to view receptionists (List).
Preconditions: Signed in.
AC-1: Click “Receptionists” menu item -> page with table is displayed.
AC-2: Table columns: full name, office address.
AC-3: Every row contains “Delete” button.
AC-4: Page contains “Create receptionist” button.

User Story 2: As a RECEPTIONIST I want to create profile for another receptionist.
AC-1: Click “Create receptionist” -> modal/page displayed.
AC-2: Fields: photo (file), first/last name (req), middle name, email (req), office (dropdown). Buttons: Confirm, Cancel.
AC-3: Invalid/empty -> Confirm disabled.
AC-4/5: Valid + Confirm -> add to DB, system generates password, send email with credentials.
AC-6 to 10: Click Cancel -> dialog “Do you really want to cancel? Entered data will not be saved.” Yes -> return to Receptionists page, No -> stay on creation page.

User Story 3: As a RECEPTIONIST I want to view receptionist’s profile.
AC-1/2: Click on list row OR profile icon -> profile page displayed.
AC-3: Fields displayed: photo, first name, last name, middle name, office.
AC-4: Contains “Edit” button.

User Story 4: As a RECEPTIONIST I want to edit profile.
Preconditions: On Profile page.
AC-1: Click “Edit” -> fields become editable.
AC-2: Buttons: “Save changes”, “Cancel”.
AC-3: Invalid/empty -> Save disabled.
AC-4: Valid + Save -> update DB, switch to View mode.
AC-6 to 9: Click Cancel -> dialog “Do you really want to cancel? Changes will not be saved.” Yes -> switch to View mode (changes lost), No -> stay in Edit mode.

User Story 5: As a RECEPTIONIST I want to delete receptionist.
Preconditions: On Receptionists page.
AC-1: Click “Delete” -> dialog “Do you really want to delete? Data will be lost.”
AC-2: Buttons: “Yes”, “No”.
AC-3: Click "Yes" -> close dialog, remove row, delete profile/account/photo from DB.
AC-4: Click "No" -> close dialog.

Fields validation (Create/Edit):
F-1 Photo: Not req, file-uploader.
F-2/3 First & Last name: Req, text. Empty on blur -> red border, "Please, enter the [first/last] name".
F-5 Email (Create only): Req, text. Empty on blur -> "Please, enter the email". Invalid format -> "You've entered an invalid email". Exists in DB -> "User with this email already exists".
F-6 Office: Req, dropdown. Empty on blur -> "Please, choose the office". "

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the receptionists list (Priority: P1)

A signed-in Receptionist opens the "Receptionists" menu item and sees a page listing every receptionist employed by the clinic. The table shows each receptionist's full name and office address. Every row offers a "Delete" action, and the page offers a "Create receptionist" action. The list is the hub of the module: it is the entry point for creating, opening, and deleting receptionist profiles.

**Why this priority**: The list is the minimum viable deliverable. Without it, there is no place to find receptionists, no target for the profile navigation, and no context for creation or deletion. Delivering only this story lets staff audit who works in which office.

**Independent Test**: Sign in as a Receptionist, click the "Receptionists" menu item, and verify a table appears with the columns "Full name" and "Office address", a "Delete" action on every row, and a "Create receptionist" action on the page. Verify the listed people and office addresses match the stored data, and that the page shows a clear empty state when no receptionists exist.

**Acceptance Scenarios**:

1. **Given** the Receptionist is signed in, **When** the Receptionist clicks the "Receptionists" menu item, **Then** the Receptionists page is displayed with a table of receptionists.
2. **Given** the Receptionists page is displayed, **When** the table is rendered, **Then** it contains exactly the columns "Full name" and "Office address" for each receptionist, plus a row action area.
3. **Given** the Receptionists page is displayed, **When** the Receptionist inspects any row, **Then** that row contains a "Delete" action.
4. **Given** the Receptionists page is displayed, **When** the Receptionist inspects the page actions, **Then** the page contains a "Create receptionist" action.
5. **Given** receptionists exist with a first name, last name, and middle name, **When** the list is rendered, **Then** each row shows the receptionist's full name and the address of the office assigned to that receptionist.
6. **Given** no receptionists exist, **When** the list is rendered, **Then** an empty state is displayed instead of table rows, and the "Create receptionist" action remains available.
7. **Given** a receptionist has no middle name, **When** the list is rendered, **Then** the full name is displayed without an empty gap or a stray separator.
8. **Given** receptionists exist, **When** the Receptionists page is reloaded, **Then** the list reflects the currently stored data.

---

### User Story 2 - Create a receptionist profile (Priority: P2)

A signed-in Receptionist activates "Create receptionist" on the Receptionists page. A creation form is displayed with a photo uploader, first name, last name, middle name, email, and office dropdown, plus "Confirm" and "Cancel". While any required field is empty or invalid, "Confirm" stays disabled. Once all values are valid, "Confirm" creates the receptionist profile and account, the system generates an initial password, and the credentials are sent to the entered email address. The new receptionist then appears in the list. Activating "Cancel" asks for confirmation before leaving and discarding the entered data.

**Why this priority**: Onboarding staff is the core business value of the module. Without creation there is nothing new to view, edit, or delete, and the clinic cannot grant a new receptionist access.

**Independent Test**: Sign in as a Receptionist, click "Create receptionist", and verify "Confirm" is disabled on the empty form. Leave each required field empty on blur and verify the exact inline messages and red borders. Enter an invalid email, then an email that already exists, and verify the corresponding messages block submission. Fill a valid first name, last name, email, and office, optionally attach a photo, click "Confirm", and verify the profile is created, appears in the list, and a credentials email is sent to the entered address. Repeat the flow, type values, click "Cancel", choose "No", and verify values are preserved; then choose "Yes" and verify the Receptionists page is shown and nothing was created.

**Acceptance Scenarios**:

1. **Given** the Receptionists page is displayed, **When** the Receptionist clicks "Create receptionist", **Then** the receptionist creation form is displayed.
2. **Given** the creation form is displayed, **When** it is rendered, **Then** it contains the fields photo, first name, last name, middle name, email, and office, and the buttons "Confirm" and "Cancel".
3. **Given** the creation form is displayed with every field empty, **When** the form is rendered, **Then** "Confirm" is disabled.
4. **Given** the creation form is displayed, **When** first name, last name, email, or office is empty or invalid, **Then** "Confirm" is disabled.
5. **Given** all required fields contain valid values, **When** the Receptionist clicks "Confirm", **Then** the receptionist profile is stored, a system-generated password is created for the new account, and credentials are sent to the entered email address.
6. **Given** a valid form is submitted successfully, **When** the operation completes, **Then** the new receptionist appears in the Receptionists list with the entered full name and office address.
7. **Given** the photo field is left empty, **When** a valid form is submitted, **Then** the profile is created without a photo and no photo-related error is shown.
8. **Given** the middle name is left empty, **When** a valid form is submitted, **Then** the profile is created with no middle name and no middle-name error is shown.
9. **Given** the creation form is displayed, **When** the Receptionist clicks "Cancel", **Then** a dialog with the message "Do you really want to cancel? Entered data will not be saved." is displayed with the buttons "Yes" and "No".
10. **Given** the creation cancellation dialog is displayed, **When** the Receptionist clicks "Yes", **Then** the dialog closes, the Receptionists page is displayed, and no receptionist was created.
11. **Given** the creation cancellation dialog is displayed, **When** the Receptionist clicks "No", **Then** the dialog closes, the creation form remains displayed, and every entered value and the selected photo are preserved.
12. **Given** the creation form is displayed, **When** the Receptionist leaves first name empty on blur, **Then** the field gets a red border and the message "Please, enter the first name" is shown.
13. **Given** the creation form is displayed, **When** the Receptionist leaves last name empty on blur, **Then** the field gets a red border and the message "Please, enter the last name" is shown.
14. **Given** the creation form is displayed, **When** the Receptionist leaves email empty on blur, **Then** the field gets a red border and the message "Please, enter the email" is shown.
15. **Given** the creation form is displayed, **When** the Receptionist enters a malformed email address and leaves the field, **Then** the field gets a red border and the message "You've entered an invalid email" is shown.
16. **Given** the creation form is displayed, **When** the Receptionist enters an email that already belongs to an existing user, **Then** the field gets a red border, the message "User with this email already exists" is shown, and "Confirm" remains disabled.
17. **Given** the creation form is displayed, **When** the Receptionist leaves the office unselected on blur, **Then** the field gets a red border and the message "Please, choose the office" is shown.
18. **Given** the office dropdown is opened, **When** it is rendered, **Then** it offers the existing clinic offices with their addresses and allows exactly one office to be selected.
19. **Given** the Receptionist selected a photo, **When** the photo field is rendered, **Then** a preview of the selected image is shown and the photo can be replaced or removed before submission.
20. **Given** the Receptionist selected a file that is not an accepted image or exceeds the accepted size, **When** the file is validated, **Then** an inline message is shown, the file is not attached, and "Confirm" remains disabled while the field is in error.
21. **Given** the Receptionist activates "Confirm" while a creation request is already in progress, **When** the second activation happens, **Then** no duplicate receptionist is created.
22. **Given** a creation request fails, **When** the failure is reported, **Then** the form remains displayed with every entered value preserved, an error notification is shown, and the Receptionist can retry.
23. **Given** the profile was created but the credentials email could not be delivered, **When** the failure is reported, **Then** the profile remains created, the Receptionist is informed that the email was not sent, and no duplicate profile is created on retry.

---

### User Story 3 - View a receptionist profile (Priority: P3)

A signed-in Receptionist opens a receptionist from the list, either by clicking the row or by using that row's profile action. The receptionist's profile page is displayed in read-only mode with the photo, first name, last name, middle name, and office, and offers an "Edit" action.

**Why this priority**: The profile is the reference record for staff and the starting point for editing. It delivers immediate value as a reliable read-only view and is independently demonstrable once the list exists.

**Independent Test**: Sign in as a Receptionist, open the Receptionists page, and verify that both clicking a row and activating the row's profile action open that receptionist's profile page. Verify the photo, first name, last name, middle name, and office are displayed with an "Edit" action, and that no value can be changed until "Edit" is activated.

**Acceptance Scenarios**:

1. **Given** the Receptionists page is displayed, **When** the Receptionist clicks a receptionist row, **Then** that receptionist's profile page is displayed.
2. **Given** the Receptionists page is displayed, **When** the Receptionist activates the profile action on a row, **Then** that receptionist's profile page is displayed.
3. **Given** the profile page is displayed, **When** it is rendered, **Then** it shows the receptionist's photo, first name, last name, middle name, and office.
4. **Given** the profile page is displayed, **When** it is rendered, **Then** it contains an "Edit" action.
5. **Given** the profile page is displayed in View mode, **When** the Receptionist inspects the values, **Then** no field is editable.
6. **Given** a receptionist has no photo, **When** the profile is displayed, **Then** a default avatar or placeholder is shown instead of a broken image.
7. **Given** a receptionist has no middle name, **When** the profile is displayed, **Then** the middle name is shown as not provided rather than as a broken value.
8. **Given** the receptionist's profile page is opened, **When** the page is reloaded, **Then** the profile shows the currently stored values.
9. **Given** the profile page is open, **When** the Receptionist uses the available back action, **Then** the Receptionists page is displayed again.
10. **Given** the receptionist no longer exists, **When** the profile page is opened, **Then** an error state is shown with a way back to the Receptionists page.

---

### User Story 4 - Edit a receptionist profile (Priority: P4)

From the receptionist's profile page, a signed-in Receptionist activates "Edit". The fields become editable and are pre-filled with the stored values, and the page shows "Save changes" and "Cancel". While any required field is empty or invalid, "Save changes" stays disabled. When every required value is valid, "Save changes" stores the changes and returns the page to View mode showing the updated data. Activating "Cancel" asks for confirmation before discarding the edits.

**Why this priority**: Keeping names, office assignments, and photos accurate is essential for staff records. It builds directly on the profile page and the same field rules as creation, so it is smaller than creation but still a complete, valuable workflow.

**Independent Test**: Sign in as a Receptionist, open a receptionist, click "Edit", clear the first name, and verify "Save changes" is disabled and the inline message appears on blur. Enter valid values, change the office and photo, click "Save changes", and verify the page returns to View mode with the new values. Re-enter Edit, change values, click "Cancel", choose "No", and verify the edits remain; choose "Yes" and verify the stored values are unchanged.

**Acceptance Scenarios**:

1. **Given** the profile page is in View mode, **When** the Receptionist clicks "Edit", **Then** the photo, first name, last name, middle name, and office become editable and are pre-filled with the stored values; email is not shown in Edit mode.
2. **Given** the profile page is in Edit mode, **When** it is rendered, **Then** it shows the buttons "Save changes" and "Cancel".
3. **Given** the profile page is in Edit mode and at least one required field is empty or invalid, **When** the page is rendered, **Then** "Save changes" is disabled.
4. **Given** all required fields contain valid values, **When** the Receptionist clicks "Save changes", **Then** the profile is updated and the page returns to View mode showing the updated values.
5. **Given** the Receptionist changed only the office, **When** "Save changes" is activated, **Then** the new office address is stored and displayed on the profile and in the Receptionists list.
6. **Given** the Receptionist changed the photo, **When** "Save changes" is activated, **Then** the new photo is stored and displayed on the profile.
7. **Given** the Receptionist removed the photo, **When** "Save changes" is activated, **Then** the profile is stored without a photo and the default placeholder is displayed.
8. **Given** the profile page is in Edit mode, **When** the Receptionist leaves first name empty on blur, **Then** the field gets a red border and the message "Please, enter the first name" is shown.
9. **Given** the profile page is in Edit mode, **When** the Receptionist leaves last name empty on blur, **Then** the field gets a red border and the message "Please, enter the last name" is shown.
10. **Given** the profile page is in Edit mode, **When** the Receptionist leaves the office unselected on blur, **Then** the field gets a red border and the message "Please, choose the office" is shown.
11. **Given** the profile page is in Edit mode, **When** the Receptionist clicks "Cancel", **Then** a dialog with the message "Do you really want to cancel? Changes will not be saved." is displayed with the buttons "Yes" and "No".
12. **Given** the edit cancellation dialog is displayed, **When** the Receptionist clicks "Yes", **Then** the dialog closes, the page returns to View mode, and none of the entered changes are stored.
13. **Given** the edit cancellation dialog is displayed, **When** the Receptionist clicks "No", **Then** the dialog closes and the page remains in Edit mode with every entered value preserved.
14. **Given** the profile page is in Edit mode and nothing was changed, **When** all required fields are valid, **Then** "Save changes" is enabled and saving completes successfully without altering the stored data.
15. **Given** a save fails, **When** the failure is reported, **Then** the page remains in Edit mode with all entered values preserved, an error notification is displayed, and the Receptionist can retry.
16. **Given** the Receptionist activates "Save changes" while a save request is already in progress, **When** the second activation happens, **Then** no duplicate save is sent and the page is not switched twice.

---

### User Story 5 - Delete a receptionist (Priority: P5)

A signed-in Receptionist activates "Delete" on a row of the Receptionists page. A confirmation dialog warns that the data will be lost. Confirming removes the row from the list and permanently deletes the receptionist's profile, account, and photo. Declining closes the dialog and changes nothing.

**Why this priority**: Offboarding staff is a complete, independent operation that keeps the directory accurate and revokes access for people who no longer work at the clinic. It is lower priority because it is destructive and depends on the list.

**Independent Test**: Sign in as a Receptionist, open the Receptionists page, click "Delete" on a row, and verify the dialog text and the "Yes"/"No" buttons. Choose "No" and verify the row remains. Choose "Delete" again, then "Yes", and verify the row disappears, the profile and account can no longer be used, and the stored photo is gone.

**Acceptance Scenarios**:

1. **Given** the Receptionists page is displayed, **When** the Receptionist clicks "Delete" on a row, **Then** a dialog with the message "Do you really want to delete? Data will be lost." is displayed.
2. **Given** the deletion dialog is displayed, **When** it is rendered, **Then** it contains the buttons "Yes" and "No".
3. **Given** the deletion dialog is displayed, **When** the Receptionist clicks "Yes", **Then** the dialog closes, the row is removed from the list, and the receptionist's profile, account, and photo are deleted.
4. **Given** the deletion dialog is displayed, **When** the Receptionist clicks "No", **Then** the dialog closes, the row remains, and nothing is deleted.
5. **Given** the receptionist is deleted successfully, **When** the page is reloaded, **Then** the receptionist is absent from the list and the profile can no longer be opened.
6. **Given** deleting the last receptionist in the list, **When** the deletion completes, **Then** the list shows its empty state and the "Create receptionist" action remains available.
7. **Given** a deletion request fails, **When** the failure is reported, **Then** the row remains in the list, an error notification is displayed, and the Receptionist can retry.
8. **Given** the Receptionist activates "Yes" while a deletion request is already in progress, **When** the second activation happens, **Then** no duplicate deletion request is sent.

---

### Edge Cases

- **Whitespace-only names**: a first name or last name consisting only of spaces is treated as empty and blocks saving with the corresponding message.
- **Whitespace-only email**: an email consisting only of spaces is treated as empty and shows "Please, enter the email".
- **Whitespace around values**: leading and trailing spaces in first name, last name, middle name, and email are trimmed before validation and storage.
- **Email capitalisation**: an email differing only in letter case from an existing email is treated as the same address and is rejected as already existing.
- **Office list empty**: when no offices exist, the dropdown has no options, "Confirm" stays disabled, and a message explains that an office must be created before a receptionist can be added.
- **Selected office removed**: if the office assigned to a receptionist is no longer available, the profile still displays the stored office and the list shows an explicit "not assigned" indicator instead of an empty cell.
- **Photo too large or unsupported**: an unsupported file type or an oversized image is rejected inline, is not uploaded, and blocks submission until replaced or removed.
- **Photo upload fails during save**: the profile changes are not applied, the form stays open with the entered values, and an error notification is shown.
- **Duplicate submission**: repeated activations of "Confirm", "Save changes", or the deletion "Yes" while a request is in progress are ignored.
- **Create or save failure**: the form stays open with all entered values preserved, an error notification is shown, and the user can retry.
- **Email delivery failure after creation**: the profile and account exist, the success state is shown with a warning that credentials were not emailed, and no duplicate profile is created.
- **Email uniqueness conflict discovered at submission**: "User with this email already exists" is shown on the email field, "Confirm" becomes disabled until the email changes, and all other entered values are preserved.
- **Profile changed or deleted by another user**: the next successful save wins; if the profile no longer exists, an error notification is shown with a way back to the list.
- **Leaving without confirmation**: navigation away through the menu, browser back, or page reload discards unsaved values without a prompt; only "Cancel" is confirmed.
- **Very long values**: names or email above the accepted maximum length are rejected with inline messages that block saving.
- **Long office address**: a long address wraps or truncates in the table without breaking the row layout.
- **Large list**: when more receptionists exist than fit on one page, the list remains usable through paging or scrolling, and the header stays readable.
- **Confirmation dialogs**: each dialog is keyboard operable, moves focus into the dialog when opened, and does not close on backdrop click without an explicit "Yes" or "No" choice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a "Receptionists" menu item for signed-in Receptionists that opens the Receptionists page.
- **FR-002**: The Receptionists page MUST display a table listing every receptionist.
- **FR-003**: The table MUST show exactly the columns "Full name" and "Office address" for each receptionist, plus a row action area.
- **FR-004**: The full name MUST be composed of the receptionist's first name, last name, and middle name, omitting the middle name when it is not provided.
- **FR-005**: Each row MUST contain a "Delete" action.
- **FR-006**: The Receptionists page MUST contain a "Create receptionist" action.
- **FR-007**: The Receptionists page MUST show an empty state when no receptionists exist while keeping the "Create receptionist" action available.
- **FR-008**: The Receptionists page MUST reflect the currently stored receptionists after a reload.
- **FR-009**: Selecting "Create receptionist" MUST open a receptionist creation form.
- **FR-010**: The creation form MUST contain the fields photo, first name, last name, middle name, email, and office, and the buttons "Confirm" and "Cancel".
- **FR-011**: The photo field MUST be optional and MUST allow exactly one image to be attached, previewed, replaced, or removed before submission.
- **FR-012**: The first name field MUST be required and MUST accept free text.
- **FR-013**: The last name field MUST be required and MUST accept free text.
- **FR-014**: The middle name field MUST be optional and MUST accept free text.
- **FR-015**: The email field MUST be required on the creation form and MUST accept a single email address.
- **FR-016**: The office field MUST be required and MUST be a dropdown offering the existing clinic offices by address, with exactly one office selectable.
- **FR-017**: "Confirm" MUST be disabled whenever any required field is empty or invalid, and MUST be enabled only when first name, last name, email, and office are all valid.
- **FR-018**: The system MUST validate first name, last name, email format, and office selection when those fields lose focus, and MUST show a red border together with the following messages:
  - First name empty — "Please, enter the first name".
  - Last name empty — "Please, enter the last name".
  - Email empty — "Please, enter the email".
  - Email malformed — "You've entered an invalid email".
  - Office not selected — "Please, choose the office".
- **FR-019**: The system MUST reject a file that is not an accepted image type or exceeds the accepted size, MUST show an inline message, and MUST NOT attach that file.
- **FR-020**: When "Confirm" is activated with all required fields valid, the system MUST store the new receptionist profile with the entered first name, last name, optional middle name, optional photo, and office.
- **FR-021**: On successful creation, the system MUST create an account for the receptionist, generate an initial password, and send the credentials to the entered email address.
- **FR-022**: The generated password MUST NOT be displayed in the management interface.
- **FR-023**: On successful creation, the new receptionist MUST appear in the Receptionists list with the entered full name and office address.
- **FR-024**: The system MUST ensure that an email address identifies at most one user, and MUST reject creation when the email already belongs to an existing user, displaying "User with this email already exists" on the email field as soon as the conflict is detected, whether on field validation or on submission.
- **FR-025**: Activating "Cancel" on the creation form MUST display a confirmation dialog containing exactly "Do you really want to cancel? Entered data will not be saved." with the buttons "Yes" and "No".
- **FR-026**: Activating "Yes" in the creation cancellation dialog MUST close the dialog, return the user to the Receptionists page, and discard the entered data without creating a profile or account.
- **FR-027**: Activating "No" in the creation cancellation dialog MUST close the dialog, keep the creation form open, and preserve every entered value and the selected photo.
- **FR-028**: Clicking a receptionist row in the list MUST open that receptionist's profile page.
- **FR-029**: Each row MUST offer a profile action that opens the same profile page as clicking the row.
- **FR-030**: The profile page MUST display, in View mode, the receptionist's photo, first name, last name, middle name, and office.
- **FR-031**: The profile page MUST display a placeholder when the receptionist has no photo and an explicit "not provided" value when the middle name is absent.
- **FR-032**: The profile page MUST display an "Edit" action in View mode and MUST keep every field non-editable until "Edit" is activated.
- **FR-033**: Activating "Edit" MUST switch the profile page to Edit mode, pre-fill every editable field with the stored value, and make the photo, first name, last name, middle name, and office editable.
- **FR-034**: Edit mode MUST present the buttons "Save changes" and "Cancel".
- **FR-035**: Edit mode MUST apply the same required-field and photo validation rules and messages as the creation form, and MUST NOT display the email field, because email is only captured when the profile is created.
- **FR-036**: "Save changes" MUST be disabled whenever any required field is empty or invalid, and MUST be enabled only when first name, last name, and office are valid.
- **FR-037**: When "Save changes" is activated with all required fields valid, the system MUST store the changes and return the page to View mode showing the updated values.
- **FR-038**: A successful save MUST make the updated full name and office address visible on the profile page and in the Receptionists list without a manual reload.
- **FR-039**: Activating "Cancel" in Edit mode MUST display a confirmation dialog containing exactly "Do you really want to cancel? Changes will not be saved." with the buttons "Yes" and "No".
- **FR-040**: Activating "Yes" in the edit cancellation dialog MUST close the dialog, discard all entered changes, leave the stored profile unchanged, and return the page to View mode.
- **FR-041**: Activating "No" in the edit cancellation dialog MUST close the dialog, keep the page in Edit mode, and preserve every entered value.
- **FR-042**: Activating "Delete" on a row MUST display a confirmation dialog containing exactly "Do you really want to delete? Data will be lost." with the buttons "Yes" and "No".
- **FR-043**: Activating "Yes" in the deletion dialog MUST close the dialog, remove the row from the list, and permanently delete the receptionist's profile, account, and photo.
- **FR-044**: Activating "No" in the deletion dialog MUST close the dialog, keep the row, and delete nothing.
- **FR-045**: A deleted receptionist MUST NOT be openable from the list and MUST NOT be able to sign in.
- **FR-046**: When a deletion removes the last row, the list MUST display its empty state and keep the "Create receptionist" action available.
- **FR-047**: The system MUST preserve all entered values and keep the form open when a creation or save fails, MUST display an error notification, and MUST allow the user to retry.
- **FR-048**: If the profile is created but the credentials email cannot be delivered, the system MUST keep the created profile, MUST inform the Receptionist that the email was not sent, and MUST NOT create a duplicate profile on retry.
- **FR-049**: The system MUST ignore repeated "Confirm", "Save changes", or deletion "Yes" activations while a request is already in progress, so that no duplicate profile is created, no duplicate save is sent, and no duplicate deletion request is sent.
- **FR-050**: If a creation, save, or deletion request fails, the system MUST keep the interface in a usable state with the user's data intact and MUST display an error notification.
- **FR-051**: Only a signed-in Receptionist may list, create, view, edit, or delete receptionists; users without that role MUST NOT reach these capabilities.
- **FR-052**: The system MUST trim leading and trailing spaces from name and email values before validating and storing them.
- **FR-053**: The system MUST treat an email that differs only in letter case from an existing email as already registered.
- **FR-054**: When no offices exist, the office dropdown MUST be empty, the form MUST remain unsavable, and a message MUST explain that an office must be created before a receptionist can be added.
- **FR-055**: If a receptionist's office is no longer available, the list and profile MUST show an explicit "not assigned" indicator instead of an empty cell.
- **FR-056**: The confirmation dialogs MUST be keyboard operable and MUST move focus into the dialog when they open.
- **FR-057**: The forms MUST accept names and email addresses up to the accepted maximum length and MUST reject longer values with inline messages that block saving.

### Key Entities

- **Receptionist Profile**: A staff member who works at the front desk of the clinic. Attributes: photo, first name, last name, middle name, email, and assigned office. Each receptionist has exactly one profile and one assigned office.
- **Receptionist Account**: The sign-in identity tied to a receptionist profile. It is created together with the profile, uses the profile's email address as its identifier, receives a system-generated initial password, and is removed together with the profile.
- **Office**: A clinic location identified by its address. It is the assignment target for a receptionist and provides the "Office address" value shown in the list and on the profile.
- **Credential Email**: The message sent to a newly created receptionist containing their sign-in credentials. It is generated and delivered once per successful creation and is never shown in the management interface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Receptionist can open the Receptionists list and see all receptionists with their full names and office addresses in under 2 seconds for a directory of up to 500 receptionists.
- **SC-002**: A Receptionist can create a complete, valid receptionist profile in under 2 minutes from opening the creation form.
- **SC-003**: 100% of attempts to create or save a receptionist with at least one empty or invalid required field are blocked, and the corresponding action button is disabled in every such case.
- **SC-004**: 100% of "Cancel" → "Yes" actions leave the stored receptionist data exactly as it was before the form was opened.
- **SC-005**: 100% of "Cancel" → "No" actions keep the form open with every entered value preserved.
- **SC-006**: 100% of successful creations send exactly one credentials email to the entered address, and no generated password is visible anywhere in the management interface.
- **SC-007**: 100% of successful edits display the updated values in View mode and in the list immediately, without a manual page reload.
- **SC-008**: 100% of confirmed deletions remove the profile, account, and photo, and the deleted receptionist can no longer sign in.
- **SC-009**: Zero duplicate receptionist profiles are created by repeated activations of "Confirm" during a single creation.
- **SC-010**: 100% of failed creation, save, and deletion attempts keep the user's data intact and offer a retry path.
- **SC-011**: A Receptionist can go from the list to a profile and from a profile into edit mode in at most two actions each.
- **SC-012**: 100% of validation messages appear on blur and match the specified wording exactly.

## Assumptions

- The acting user is a signed-in user with the Receptionist role, as delivered by the sign-in feature; all other roles are out of scope for this module.
- The "Receptionists" menu item and the page shell that hosts it are part of this feature. The same applies to the profile page reachable from the list.
- The creation form is presented as a modal dialog over the Receptionists page; the cancellation and deletion dialogs are modal as well. The profile edit happens in place on the profile page.
- The office dropdown lists the existing clinic offices and displays each office's address, matching the "Office address" value shown in the list. Only offices available to staff assignments are offered.
- Email is the receptionist's account identifier. It is required and unique at creation and is not displayed in Edit mode because it is create-only and changing it would change the sign-in identity; email changes are out of scope.
- The system generates the initial password and sends it by email; the password is never displayed to the acting Receptionist and there is no "resend credentials" capability in this feature.
- The full name is displayed as the first name, last name, and middle name joined by single spaces, with the middle name omitted when it is not provided.
- The backend list is paged; the application loads every page and renders a single table, following the existing staff-directory convention. Sorting follows the existing list conventions; search and filtering are out of scope.
- Deleting the signed-in Receptionist's own profile is not a special case in this feature; the deletion follows the same flow, and the session is revalidated on the next protected request.
- Photos are single images in common web image formats, within the accepted size limit used elsewhere in the application. Photo cropping, galleries, and multiple photos are out of scope.
- The email address is treated case-insensitively for uniqueness, and names and emails are trimmed of leading and trailing spaces.
- The maximum lengths for names and email follow the existing staff profile conventions; where no convention exists, a reasonable limit is applied and reported inline.
- Error wording, validation messages, empty states, and confirmation wording follow the existing staff management conventions. The messages listed in this specification are authoritative for the new forms.
- There is no audit history, change log, approval workflow, or concurrency conflict resolution for receptionist profiles; the last successful change wins.
- Receptionists are not soft-deleted: deletion is permanent and removes the profile, account, and photo. Deactivation or archiving is out of scope.
- Only the management interface for receptionists is in scope. Patient-facing and appointment-facing behaviour of receptionists is unchanged.
- Users have an active network connection and a supported modern browser.

## Dependencies

- An existing authenticated session and role information for Receptionists, as delivered by the sign-in feature.
- An existing receptionist directory store that supports listing, reading, creating, updating, and deleting receptionist profiles, and that returns a stable identifier for every listed receptionist.
- An existing office directory that provides the addresses offered in the office dropdown and the "Office address" shown in the list and profile.
- An existing account and credential provisioning capability that can create a sign-in identity with a generated password and deliver it by email.
- Existing photo storage used by staff profiles, including removal of a stored photo when a profile is deleted, exposed to the application through a generated API client.
- Existing global error notification behaviour used to report failed creation, saving, deletion, and email delivery.
