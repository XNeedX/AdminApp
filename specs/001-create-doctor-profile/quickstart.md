# Quickstart Validation Guide: Create Doctor Profile

This guide describes step-by-step verification procedures to validate the doctor creation feature end-to-end.

## Prerequisites

1. Frontend admin app running:
   ```bash
   cd AdminApp
   npm start
   ```
2. User is signed in with Receptionist role.
3. User is navigated to the Doctors page (`/doctors`).

---

## Validation Scenario 1: Happy Path - Create Doctor with Valid Data

1. On `/doctors`, click the **"Create doctor"** button.
2. Verify the `DoctorCreateComponent` modal opens with:
   - Form fields: Photo uploader, First Name, Last Name, Middle Name, Date of Birth, Email, Specialization, Office, Career Start Year, Status.
   - Status defaults to `"At work"`.
   - Footer buttons: **"Confirm"** (disabled) and **"Cancel"** (enabled).
3. Fill in the form:
   - First Name: `"Gregory"`
   - Last Name: `"House"`
   - Middle Name: `"Vincent"` (optional)
   - Date of Birth: select any date in the past (e.g. `1970-05-15`).
   - Email: enter an unregistered email (e.g. `house.md@hospital.org`).
   - Specialization: type `"Diag"` and select `"Diagnostics"`.
   - Office: select `"Room 101"`.
   - Career Start Year: enter a past year (e.g. `1995`).
   - Status: keep `"At work"`.
4. Observe that the **"Confirm"** button automatically transitions from disabled to **enabled**.
5. Click **"Confirm"**.
6. Verify:
   - Submission payload matches `CreateDoctorRequestDto`.
   - Modal closes.
   - User returns to the Doctors list.
   - The new doctor profile is present in the list.

---

## Validation Scenario 2: Blur Validation & Disabled Submission

1. Open the "Create doctor" modal.
2. Focus the **First Name** input and immediately press Tab (blur) without typing.
   - Expected: Red border around the input (`border-red-500`) and message `"Please, enter the first name"`.
3. Focus and blur **Last Name**:
   - Expected: `"Please, enter the last name"`.
4. Focus and blur **Date of Birth**:
   - Expected: `"Please, select the date"`.
5. Enter a future date for **Date of Birth** (e.g. tomorrow):
   - Expected: `"Date of birth cannot be in the future"`.
6. Focus and blur **Email**:
   - Expected: `"Please, enter the email"`.
7. Type `"notanemail"` and blur:
   - Expected: `"You've entered an invalid email"`.
8. Type an existing doctor's email (e.g. `existing.doctor@hospital.org`) and blur:
   - Expected: `"User with this email already exists"`.
9. In **Specialization**, type random characters `"xyz"` and blur:
   - Expected: `"Invalid specialization name"`.
10. Verify: **"Confirm"** button remains strictly **disabled** throughout.

---

## Validation Scenario 3: Cancellation Guarding Flow

1. Open the "Create doctor" modal.
2. Enter `"Gregory"` in First Name and `"House"` in Last Name.
3. Click the **"Cancel"** button.
4. Verify the `ConfirmCancelDialogComponent` modal appears with:
   - Text: `"Do you really want to cancel? Entered data will not be saved."`
   - Buttons: `"Yes"` and `"No"`.
5. Click **"No"**:
   - Verify the confirmation dialog closes.
   - Verify the creation modal remains open with `"Gregory"` and `"House"` still present.
6. Click **"Cancel"** again, then click **"Yes"**:
   - Verify both dialogs close.
   - Verify user is back on the Doctors list page.
   - Re-open the modal and verify fields are reset.
