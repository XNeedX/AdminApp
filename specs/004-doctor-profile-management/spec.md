# Feature Specification: Doctor Profile Management

**Feature Branch**: `004-doctor-profile-management`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Создай спецификацию для функционала управления профилем врача (View/Edit Profile, Change Status).

User Story 1: As a DOCTOR, RECEPTIONIST I want to edit profile so as I can correct some mistakes.
Preconditions: Signed in, on “Profile page”.
Acceptance criteria:
AC-1: Click “Edit” -> fields become editable.
AC-2: Show footer buttons: “Save changes”, “Cancel”.
AC-3: If any required field is empty or invalid -> “Save changes” is disabled.
AC-4: All required valid + click “Save changes” -> update profile in DB, display View mode with updated data.
AC-5: Date fields <= current date.
AC-6: Click "Cancel" -> show dialog “Do you really want to cancel? Changes will not be saved.”
AC-7: Dialog buttons: “Yes”, “No”.
AC-8: Dialog "Yes" -> close dialog, switch to View mode, changes not saved.
AC-9: Dialog "No" -> close dialog, stay in Edit mode with entered data.
Fields:
F-1 Photo: Not req, file-uploader.
F-2 First name: Req, text. Empty on blur -> red border, “Please, enter the first name”.
F-3 Last name: Req, text. Empty on blur -> red border, “Please, enter the last name”.
F-4 Middle name: Not req, text.
F-5 Date of birth: Req, datepicker. Empty on blur -> red border, “Please, select the date”.
F-6 Specialization: Req, combobox. Autocomplete (type -> filter list), select -> fill. Invalid (doesn't exist) on blur -> “Invalid specialization name”. Empty on blur -> “Please, choose the specialisation”.
F-7 Office: Req, dropdown. Autocomplete (type -> filter list), select -> fill. Empty on blur -> “Please, choose the office”.
F-8 Career start year: Req, year datepicker. Empty on blur -> “Please, select the year”.
F-9 Status: Req, dropdown. List: “At work”, “On vacation”, “Sick Day”, “Sick Leave”, “Self-isolation”, “Leave without pay”, “Inactive”.

User Story 2: As a DOCTOR I want to view my profile.
Preconditions: Doctor is signed in.
AC-1: Click profile icon -> profile page displayed.
AC-2: Fields: photo, first name, last name, middle name, date of birth, specialization, office, career start year.
AC-3: Page has “Edit” button.

User Story 3: As a RECEPTIONIST I want to change doctor’s status.
Preconditions: Receptionist signed in, on “Doctors” page.
AC-1: Change status -> system changes status in DB.
Fields: F-1 Status (same as F-9 above)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit a doctor profile (Priority: P1)

A signed-in Doctor opens their own profile page, or a signed-in Receptionist opens a doctor's profile page from the "Doctors" page. The profile is displayed in View mode. The user clicks "Edit", the fields become editable and are pre-filled with the current profile values, and the page switches to Edit mode with "Save changes" and "Cancel" in the footer. The user corrects the values. While any required field is empty or invalid, "Save changes" stays disabled. Once every required field is valid, "Save changes" becomes enabled; activating it stores the changes and returns the page to View mode showing the updated data. Activating "Cancel" always asks for confirmation before discarding the edits.

**Why this priority**: Correcting profile mistakes is the core business value of this feature and the reason the profile page becomes editable at all. Delivering only this story already gives users a complete, usable correction workflow.

**Independent Test**: Sign in as a Doctor, open the profile page, click "Edit", clear the first name, and confirm "Save changes" is disabled and the error appears on blur. Restore a valid value, change the middle name and status, click "Save changes", and confirm the page returns to View mode with the new values. Re-open Edit, change a value, click "Cancel", then "Yes", and confirm the stored values are unchanged. Repeat the edit flow as a Receptionist on a doctor's profile opened from the "Doctors" page.

**Acceptance Scenarios**:

1. **Given** the user is on the doctor's profile page in View mode, **When** the user clicks "Edit", **Then** all editable fields become editable and are pre-filled with the currently stored values.
2. **Given** the profile page is in Edit mode, **When** the footer is rendered, **Then** it shows the buttons "Save changes" and "Cancel".
3. **Given** the profile page is in Edit mode and at least one required field is empty or invalid, **When** the page is rendered, **Then** "Save changes" is disabled.
4. **Given** all required fields contain valid values, **When** the user clicks "Save changes", **Then** the updated profile is stored and the page returns to View mode displaying the updated values.
5. **Given** the profile page is in Edit mode, **When** the user clicks "Cancel", **Then** a dialog with the message "Do you really want to cancel? Changes will not be saved." is displayed with the buttons "Yes" and "No".
6. **Given** the cancellation dialog is displayed, **When** the user clicks "Yes", **Then** the dialog closes, the page returns to View mode, and none of the entered changes are saved.
7. **Given** the cancellation dialog is displayed, **When** the user clicks "No", **Then** the dialog closes and the page remains in Edit mode with all entered values preserved.
8. **Given** the profile page is in Edit mode, **When** the user leaves the first name empty on blur, **Then** the field gets a red border and the message "Please, enter the first name" is shown.
9. **Given** the profile page is in Edit mode, **When** the user leaves the last name empty on blur, **Then** the field gets a red border and the message "Please, enter the last name" is shown.
10. **Given** the profile page is in Edit mode, **When** the user leaves the date of birth empty on blur, **Then** the field gets a red border and the message "Please, select the date" is shown.
11. **Given** the profile page is in Edit mode, **When** the user leaves the specialization empty on blur, **Then** the field gets a red border and the message "Please, choose the specialisation" is shown; **When** the entered text does not match an existing specialization, **Then** the message "Invalid specialization name" is shown.
12. **Given** the profile page is in Edit mode, **When** the user leaves the office empty on blur, **Then** the field gets a red border and the message "Please, choose the office" is shown.
13. **Given** the profile page is in Edit mode, **When** the user leaves the career start year empty on blur, **Then** the field gets a red border and the message "Please, select the year" is shown.
14. **Given** the profile page is in Edit mode, **When** the user enters a date of birth or a career start year later than the current date, **Then** the value is rejected and "Save changes" stays disabled.
15. **Given** the profile page is in Edit mode and the user did not change any value, **When** all required fields are valid, **Then** "Save changes" is enabled and saving completes successfully without altering the stored data.
16. **Given** the user is a Doctor, **When** the user attempts to open another doctor's profile for editing, **Then** access is denied and no profile data is exposed.

---

### User Story 2 - View my profile (Priority: P2)

A signed-in Doctor clicks the profile icon in the application and is taken to their profile page, which displays their photo, first name, last name, middle name, date of birth, specialization, office, and career start year in read-only form. The page offers an "Edit" button that starts the editing flow described in User Story 1.

**Why this priority**: A trustworthy read-only view is required before any change can be reviewed, and it is the landing state after every save or cancel. It is independently demonstrable but delivers less value than the ability to correct data.

**Independent Test**: Sign in as a Doctor, click the profile icon, and verify that the profile page opens in View mode with every listed attribute and an "Edit" button, and that no field can be modified until "Edit" is clicked.

**Acceptance Scenarios**:

1. **Given** the Doctor is signed in, **When** the Doctor clicks the profile icon, **Then** the profile page is displayed.
2. **Given** the profile page is displayed, **When** it is rendered, **Then** it shows the doctor's photo, first name, last name, middle name, date of birth, specialization, office, and career start year.
3. **Given** the profile page is displayed, **When** it is rendered, **Then** it contains an "Edit" button.
4. **Given** the profile page is displayed in View mode, **When** the Doctor tries to change any field, **Then** the field is not editable until "Edit" is clicked.
5. **Given** the Doctor has no photo or no middle name, **When** the profile page is displayed, **Then** the page still renders successfully and indicates that the optional value is absent instead of showing an error.

---

### User Story 3 - Change a doctor's status from the Doctors page (Priority: P3)

A signed-in Receptionist working on the "Doctors" page changes a doctor's status using the same status list that appears in the profile edit form. The new status is stored immediately and is reflected for that doctor everywhere the status is displayed.

**Why this priority**: Receptionists need a fast way to keep doctor availability accurate without opening each profile. It is an operational convenience built on the same status model as the profile edit form.

**Independent Test**: Sign in as a Receptionist, open the "Doctors" page, change one doctor's status to each of the seven values in turn, and confirm the displayed value updates and persists after reloading the page. Open the same doctor's profile and confirm the status matches.

**Acceptance Scenarios**:

1. **Given** the Receptionist is on the "Doctors" page, **When** the Receptionist changes a doctor's status, **Then** the new status is stored.
2. **Given** the Receptionist changes a doctor's status, **When** the change is stored, **Then** the "Doctors" page displays the new status for that doctor.
3. **Given** a doctor's status was changed from the "Doctors" page, **When** the doctor's profile page is opened afterwards, **Then** the profile reflects the same status.
4. **Given** the status control on the "Doctors" page is opened, **When** it is rendered, **Then** it offers exactly "At work", "On vacation", "Sick Day", "Sick Leave", "Self-isolation", "Leave without pay", and "Inactive".
5. **Given** the Receptionist selects the status that is already set, **When** the selection is confirmed, **Then** no unintended change occurs and no error is shown.
6. **Given** the status change cannot be stored, **When** the failure is reported, **Then** the previously stored status is shown again and an error notification is displayed.

---

### Edge Cases

- **Saving without changes**: all required fields are valid, so "Save changes" is enabled; saving succeeds and leaves the stored profile unchanged.
- **Unsaved edits abandoned by navigation or reload**: leaving the profile page (navigation, browser back, page reload) discards Edit mode without a confirmation prompt; only the "Cancel" action is guarded by the confirmation dialog.
- **Concurrent editing**: if a Doctor and a Receptionist edit the same profile at the same time, the last successful save wins; no conflict detection or merge is performed.
- **Stored specialization or office no longer exists in the catalog**: the stored name is displayed, but in Edit mode it is treated as invalid, "Save changes" stays disabled, and the user must select a value from the current list.
- **Stored value is missing for a required field** (for example a legacy profile without a career start year): View mode shows the value as absent, and Edit mode requires it to be filled before saving.
- **Future date or year already stored** (data anomaly): View mode still displays the profile, but Edit mode flags the value as invalid and blocks saving until it is corrected.
- **Photo replaced or removed**: the photo is optional; replacing it does not block saving, and saving without any photo remains allowed.
- **Unsupported or oversized photo**: a non-image file or a file above the accepted size limit is rejected with an inline error and is not attached.
- **Save failure**: the user remains in Edit mode with all entered values preserved, an error notification is shown, and "Save changes" becomes available for retry.
- **Repeated save activation**: while a save is in progress, additional activations are ignored so the profile is not submitted twice.
- **Status changed while the doctor is editing**: the status field is refreshed only after the profile is reloaded; the last successful save wins, as with any other concurrent edit.
- **Doctor's status set to "Inactive" by a Receptionist while the Doctor is signed in**: session behaviour is governed by the sign-in rules and is outside this feature.
- **Very long text values**: the profile edit form accepts the same maximum lengths as the doctor creation form and shows the corresponding inline error when exceeded.
- **Confirmation dialog interaction**: the dialog is keyboard operable, moves focus into the dialog when opened, and does not close on backdrop click unless "Yes" or "No" is chosen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a profile page for a signed-in Doctor when the Doctor activates the profile icon.
- **FR-002**: The profile page MUST display, in View mode, the doctor's photo, first name, last name, middle name, date of birth, specialization, office, and career start year.
- **FR-003**: The profile page MUST display an "Edit" button in View mode.
- **FR-004**: The system MUST allow a signed-in Receptionist to open any doctor's profile page from the "Doctors" page and view the same profile attributes.
- **FR-005**: Activating "Edit" MUST switch the profile page to Edit mode, pre-fill every editable field with the currently stored value, and make those fields editable.
- **FR-006**: Edit mode MUST present a footer containing the buttons "Save changes" and "Cancel".
- **FR-007**: Edit mode MUST provide the following fields:
  - Photo — optional, file uploader.
  - First name — required, text.
  - Last name — required, text.
  - Middle name — optional, text.
  - Date of birth — required, date picker.
  - Specialization — required, autocomplete combobox that filters the list while the user types and fills the field when an option is selected.
  - Office — required, dropdown with autocomplete that filters the list while the user types and fills the field when an option is selected.
  - Career start year — required, year picker.
  - Status — required, dropdown.
- **FR-008**: The status dropdown MUST offer exactly "At work", "On vacation", "Sick Day", "Sick Leave", "Self-isolation", "Leave without pay", and "Inactive", and MUST always have exactly one value selected.
- **FR-009**: "Save changes" MUST be disabled whenever any required field is empty or invalid, and MUST be enabled only when all required fields are valid.
- **FR-010**: When "Save changes" is activated with all required fields valid, the system MUST persist the changes to the doctor's profile and return the page to View mode showing the updated values.
- **FR-011**: The system MUST reject a date of birth later than the current date and a career start year later than the current year; such values MUST prevent saving.
- **FR-012**: The system MUST validate required fields when they lose focus and MUST show a red border together with the following messages:
  - First name empty — "Please, enter the first name".
  - Last name empty — "Please, enter the last name".
  - Date of birth empty — "Please, select the date".
  - Specialization empty — "Please, choose the specialisation".
  - Specialization text that does not match an existing specialization — "Invalid specialization name".
  - Office empty — "Please, choose the office".
  - Career start year empty — "Please, select the year".
- **FR-013**: The system MUST only allow saving a specialization that exists in the current specialization catalog; free text that does not match a catalog entry is invalid.
- **FR-014**: The system MUST only allow saving an office that exists in the current office list.
- **FR-015**: The photo MUST be optional; attaching, replacing, or omitting a photo MUST NOT by itself disable "Save changes", and a rejected photo file MUST be reported inline without blocking the rest of the form.
- **FR-016**: The system MUST accept the same maximum text lengths and the same supported photo formats and size limit as the doctor creation form.
- **FR-017**: Activating "Cancel" in Edit mode MUST display a confirmation dialog containing exactly "Do you really want to cancel? Changes will not be saved." with the buttons "Yes" and "No".
- **FR-018**: Activating "Yes" in the confirmation dialog MUST close the dialog, discard all entered changes, leave the stored profile unchanged, and return the page to View mode.
- **FR-019**: Activating "No" in the confirmation dialog MUST close the dialog, keep the page in Edit mode, and preserve every entered value.
- **FR-020**: The system MUST preserve all entered values and remain in Edit mode when saving fails, MUST display an error notification, and MUST allow the user to retry.
- **FR-021**: The system MUST ignore repeated "Save changes" activations while a save is already in progress.
- **FR-022**: The system MUST allow a signed-in Receptionist to change a doctor's status from the "Doctors" page, and MUST store the new status immediately.
- **FR-023**: The status list on the "Doctors" page MUST be identical to the status list in the profile edit form.
- **FR-024**: A status changed from the "Doctors" page MUST be reflected on the doctor's profile page, and a status saved from the profile edit form MUST be reflected on the "Doctors" page, without requiring the user to make the change twice.
- **FR-025**: If a status change from the "Doctors" page cannot be stored, the system MUST restore the previously displayed status and show an error notification.
- **FR-026**: Only a signed-in Doctor may view and edit their own profile, and only a signed-in Receptionist may view and edit any doctor's profile; a Doctor MUST NOT access another doctor's profile.
- **FR-027**: The confirmation dialog MUST be keyboard operable and MUST move focus into the dialog when it opens.

### Key Entities

- **Doctor Profile**: The doctor's personal and professional identity. Attributes: photo (optional), first name, last name, middle name (optional), date of birth, specialization, office, career start year, and status. The e-mail address and credentials are not part of this feature.
- **Doctor Status**: The doctor's current availability, one of "At work", "On vacation", "Sick Day", "Sick Leave", "Self-isolation", "Leave without pay", "Inactive". The same value is shown and changed from the profile edit form and from the "Doctors" page.
- **Specialization**: A medical discipline selected from the current catalog; only existing catalog values are accepted.
- **Office**: A clinic location selected from the current office list; only existing offices are accepted.
- **Profile Photo**: An optional image attached to the doctor profile and stored as part of the profile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Doctor reaches their own profile page from the profile icon in under 10 seconds, without help.
- **SC-002**: A user can complete a profile correction (open profile, click "Edit", change a value, save) in under 2 minutes when the correct information is available.
- **SC-003**: 100% of save attempts with at least one empty or invalid required field are blocked, and "Save changes" is disabled in every such case.
- **SC-004**: 100% of successful saves display the updated values in View mode immediately after saving, without a manual page reload.
- **SC-005**: 100% of "Cancel" → "Yes" actions leave the stored profile exactly as it was before editing.
- **SC-006**: 100% of "Cancel" → "No" actions return the user to Edit mode with every entered value preserved.
- **SC-007**: Zero future dates of birth and zero future career start years are accepted, verified across 100% of tested boundary values.
- **SC-008**: 100% of doctor status changes made from the "Doctors" page are visible after reloading the page and on the doctor's profile page.
- **SC-009**: 100% of profile save failures leave the user in Edit mode with no data loss and with a retry path available.
- **SC-010**: The profile page and the "Doctors" page show the same status for the same doctor in 100% of checks, with no stale values after a successful change.

## Assumptions

- "Profile page" means a doctor profile page: a Doctor opens their own profile via the profile icon, and a Receptionist opens a doctor's profile from the "Doctors" page. A separate self-service profile for a Receptionist's own account is out of scope because the listed fields (specialization, office, career start year, status) are doctor-specific.
- The status field is part of the editable doctor profile (F-9) and is available to both roles in Edit mode; the Receptionist additionally has the fast status change on the "Doctors" page described in User Story 3. Both paths update the same stored status.
- The View mode shows the attributes enumerated in User Story 2 and also shows the status, because status is a required profile attribute that can be changed in Edit mode.
- The e-mail address, password, and credentials of a doctor are not part of this feature and cannot be changed on the profile page.
- The profile page is reachable only by signed-in users; unauthenticated access is handled by the existing sign-in behaviour.
- "Save changes" is enabled whenever all required fields are valid, even if nothing was changed; saving unchanged data is a successful no-op.
- Leaving the page through navigation, browser back, or reload discards unsaved changes without a confirmation prompt; only the "Cancel" action is confirmed.
- There is no audit history, change log, approval workflow, or concurrency conflict resolution for profile edits; the last successful save wins.
- Profile photo formats, maximum file size, and maximum text lengths reuse the rules of the doctor creation feature (JPEG, PNG, and WebP up to 5 MB by default).
- Error wording not specified in the input uses reasonable defaults: "Date cannot be in the future" for a future date of birth, "Year cannot be in the future" for a future career start year, and a neutral notification when a save or status change cannot be completed.
- The offices and specializations catalogs are the existing ones used by doctor creation; this feature does not add, edit, or remove catalog entries.
- The "Doctors" page already exists and already displays each doctor's status; this feature adds the ability to change that status in place.
- Users have an active network connection and a supported modern browser.

## Dependencies

- An existing authenticated session and role information for Doctors and Receptionists, as delivered by the sign-in feature.
- An existing doctor profile store that supports reading and updating a doctor's personal and professional attributes, including the status.
- Existing office and specialization catalogs that can be searched and selected.
- An existing photo storage capability used by doctor profile creation.
- The existing "Doctors" page and doctor list, which must expose each doctor's current status.
- Existing doctor profile creation rules for field validation, supported photo formats, and size limits, which this feature reuses for consistency.
