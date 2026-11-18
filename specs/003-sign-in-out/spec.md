# Feature Specification: Sign In / Sign Out

**Feature Branch**: `003-sign-in-out`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Создай спецификацию для функционала аутентификации (Sign in / Sign out).

User Story 1: As a DOCTOR, RECEPTIONIST I want to sign in so as I can do my work using the system.
Preconditions: User isn’t signed in, User opened the system/application.
Acceptance criteria:
AC-1: When the User opens the system Then the modal window to sign in is displayed
AC-2: The modal window must contain: e-mail (text, req), password (text, req), button “Sign in”.
AC-3: On “Sign in” click -> check if account exists in system.
AC-4: If account exists And profile status is “At work”, “On vacation”, “Sick Day”, “Sick Leave”, “Self-isolation”, “Leave without pay” -> show notification "You've signed in successfully" and display home page.
AC-5: If account doesn’t exist Or profile status is “Inactive” -> show notification “Either an email or a password is incorrect”.
AC-6: User can’t use the system while not signed in.

Fields:
F-1 E-mail: Req. Validation on blur:
- Empty -> red border, “Please, enter the email”
- No '@' -> red border, “You've entered an invalid email”
- Doesn't exist in system -> red border, “User with this email doesn't exist”
F-2 Password: Req. Min 6, Max 15. Validation on blur:
- Empty -> red border, “Please, enter the password”
- Hidden symbols, eye icon to toggle visibility.

User Story 2: As a DOCTOR, RECEPTIONIST I want to sign out so as I can end work with system.
Preconditions: User is signed in.
Acceptance criteria:
AC-1: On “Sign out” click -> user token must be deleted, modal window to sign in is displayed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in to the system (Priority: P1)

A Doctor or Receptionist who is not signed in opens the application. Instead of any working screen, a blocking sign-in modal is shown. The user enters their e-mail and password and confirms. If the account exists and its profile status permits work, the user sees a success notification and lands on the home page. If the account does not exist, the password is wrong, or the profile status is not permitted (including `Inactive`), the user sees the generic message "Either an email or a password is incorrect" and stays on the sign-in modal.

**Why this priority**: Without sign-in no other capability of the application can be used — every business feature depends on an authenticated session. This story alone delivers the minimum viable access control.

**Independent Test**: With no active session, open the application and confirm the sign-in modal appears. Enter credentials of a Doctor/Receptionist account with an allowed status and confirm the success notification and the home page. Repeat with an unknown e-mail, a wrong password, and an `Inactive` account and confirm the generic error each time. Can be fully tested without any other feature.

**Acceptance Scenarios**:

1. **Given** the user is not signed in, **When** the user opens the application, **Then** the sign-in modal is displayed and no application page content is usable behind it.
2. **Given** the sign-in modal is displayed, **When** it is rendered, **Then** it contains an e-mail field, a password field, and a "Sign in" button, with e-mail and password marked as required.
3. **Given** the user entered a registered e-mail and the correct password and the profile status is one of "At work", "On vacation", "Sick Day", "Sick Leave", "Self-isolation", "Leave without pay", **When** the user clicks "Sign in", **Then** the notification "You've signed in successfully" is shown and the home page is displayed.
4. **Given** the e-mail is not registered in the system, **When** the user clicks "Sign in", **Then** the notification "Either an email or a password is incorrect" is shown and the sign-in modal remains displayed.
5. **Given** the account exists and its profile status is "Inactive", **When** the user clicks "Sign in", **Then** the notification "Either an email or a password is incorrect" is shown and the sign-in modal remains displayed.
6. **Given** the account exists and its profile status is not one of the statuses listed in scenario 3, **When** the user clicks "Sign in", **Then** the generic sign-in error is shown and no session is created.
7. **Given** the user is not signed in, **When** the user tries to reach any application screen directly (for example via a saved link), **Then** the sign-in modal is displayed instead of that screen.
8. **Given** the sign-in modal was just opened, **When** the user attempts to dismiss it (close button, backdrop click, Escape key), **Then** the modal stays displayed.
9. **Given** the e-mail field loses focus, **When** it is empty, **Then** the field gets a red border and the message "Please, enter the email" is shown.
10. **Given** the e-mail field loses focus, **When** the value contains no '@', **Then** the field gets a red border and the message "You've entered an invalid email" is shown.
11. **Given** the e-mail field loses focus, **When** the value is well-formed but no account with that e-mail exists, **Then** the field gets a red border and the message "User with this email doesn't exist" is shown.
12. **Given** the password field loses focus, **When** it is empty, **Then** the field gets a red border and the message "Please, enter the password" is shown.
13. **Given** the password field contains a value, **When** it is rendered, **Then** the characters are masked and an eye icon toggles their visibility.
14. **Given** both fields contain valid values, **When** the user presses Enter inside the form, **Then** sign-in is attempted exactly as if "Sign in" was clicked.

---

### User Story 2 - Sign out of the system (Priority: P2)

A signed-in Doctor or Receptionist finishes work and clicks "Sign out". The session is ended, the access token is removed from the device, and the sign-in modal is shown again so the next person cannot continue using the previous session.

**Why this priority**: Sign-out is required to end a session securely and to protect patient data on shared workstations. It is only meaningful once sign-in exists, hence P2.

**Independent Test**: While signed in, click "Sign out" and confirm that the sign-in modal appears, that the stored access token is gone, and that navigating back or refreshing does not restore access.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** the user clicks "Sign out", **Then** the user's access token is deleted from the device and the sign-in modal is displayed.
2. **Given** the user has signed out, **When** the user navigates back or reloads the application, **Then** no authenticated screen is shown and the sign-in modal is displayed.
3. **Given** the user has signed out, **When** the same user signs in again with valid credentials, **Then** sign-in behaves exactly as in User Story 1.

---

### Edge Cases

- **E-mail with surrounding spaces**: leading/trailing spaces are ignored, so `" doctor@clinic.com "` is treated as `doctor@clinic.com`.
- **E-mail letter case**: `Doctor@Clinic.com` and `doctor@clinic.com` are treated as the same account.
- **Password outside 6–15 characters**: the password field shows a validation error and sign-in is not attempted; no session is created.
- **Password intentionally hidden→shown→hidden**: the entered value is preserved when toggling visibility.
- **Repeated failed attempts**: each attempt shows the same generic error and no session is created; no attempt counter is exposed to the user.
- **Account becomes disallowed after sign-in** (for example the profile is set to `Inactive` by an administrator while the user is working): on the next action the user is returned to the sign-in modal, consistent with "User can’t use the system while not signed in".
- **Sign-in service temporarily unavailable**: the user sees a neutral failure message, the sign-in modal stays open with the entered e-mail preserved, and no session is created.
- **Sign-out while the network is unavailable**: the local session is still ended and the sign-in modal is shown.
- **Session expires or is invalidated**: the user is returned to the sign-in modal on the next interaction instead of seeing an error page.
- **Bookmarked/deep link to a protected screen**: after a successful sign-in the user lands on the home page, as required by acceptance scenario 3, not on the bookmarked screen.
- **Role other than Doctor or Receptionist** (for example a Patient account): sign-in is rejected with the same generic message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present a blocking sign-in modal to any user who is not signed in, before any application content is usable.
- **FR-002**: The sign-in modal MUST contain an e-mail field, a password field, and a "Sign in" button; both fields MUST be required.
- **FR-003**: The system MUST verify, on "Sign in", that an account with the entered e-mail exists and that the supplied password is correct.
- **FR-004**: The system MUST check the profile status of the account after credentials are verified.
- **FR-005**: The system MUST grant access and show the notification "You've signed in successfully" when credentials are valid and the profile status is one of "At work", "On vacation", "Sick Day", "Sick Leave", "Self-isolation", "Leave without pay", and MUST then display the home page.
- **FR-006**: The system MUST reject sign-in and show exactly "Either an email or a password is incorrect" when the account does not exist, when the password is wrong, when the profile status is "Inactive", or when the profile status is any value other than those listed in FR-005.
- **FR-007**: The system MUST NOT reveal, in the sign-in result message, whether the e-mail, the password, or the profile status caused the rejection.
- **FR-008**: The system MUST prevent an unauthenticated user from reaching any application screen, including by direct navigation, saved links, or page reload.
- **FR-009**: The system MUST validate the e-mail field when it loses focus and, in order of precedence, show a red border with "Please, enter the email" when empty, "You've entered an invalid email" when the value contains no '@', and "User with this email doesn't exist" when no account is registered for a well-formed value.
- **FR-010**: The system MUST validate the password field when it loses focus and show a red border with "Please, enter the password" when empty; it MUST reject passwords shorter than 6 or longer than 15 characters.
- **FR-011**: The system MUST mask password characters by default and MUST provide an eye icon that toggles visibility without losing the entered value.
- **FR-012**: The system MUST allow sign-in to be triggered from the keyboard (Enter) as well as by clicking "Sign in".
- **FR-013**: The sign-in modal MUST NOT be dismissible by a close control, backdrop click, or Escape key.
- **FR-014**: The system MUST keep the signed-in session available across page reloads until the user signs out or the session expires.
- **FR-015**: The system MUST provide a "Sign out" action to every signed-in user; activating it MUST delete the stored access token from the device and display the sign-in modal.
- **FR-016**: After sign-out, the system MUST NOT restore access through browser history, back navigation, or page reload.
- **FR-017**: The system MUST end the session locally and show the sign-in modal when a session expires or is rejected by the server.
- **FR-018**: If the sign-in verification cannot be completed because of a temporary system failure, the system MUST show a neutral failure message, keep the sign-in modal open with the entered e-mail preserved, and MUST NOT create a session.

### Key Entities

- **Account**: The credentials a person uses to sign in — a unique e-mail and a secret password. E-mail comparison is case-insensitive and ignores surrounding whitespace.
- **User Profile**: The clinic profile attached to an account, carrying the person's role (Doctor or Receptionist for this application) and status. Statuses that permit work are "At work", "On vacation", "Sick Day", "Sick Leave", "Self-isolation", "Leave without pay"; "Inactive" and any other value do not permit work.
- **Session**: The authenticated state created by a successful sign-in, represented by an access token held on the device. It is removed on sign-out, on expiry, or when the server rejects it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user holding valid credentials reaches the home page in under 30 seconds from opening the application, without help.
- **SC-002**: 100% of users without an active session cannot reach any application screen — zero unauthenticated page views in test runs.
- **SC-003**: 100% of sign-in attempts by accounts with the "Inactive" status, or with any other non-permitted status, are rejected and create no session.
- **SC-004**: Every sign-in attempt ends unambiguously: either the home page is shown or an explicit message is displayed; zero silent failures observed.
- **SC-005**: Field validation feedback (red border and message) appears within 1 second of the field losing focus in 100% of tested cases.
- **SC-006**: After "Sign out", the user reaches the sign-in modal in under 5 seconds and cannot perform any further action in the previous session.
- **SC-007**: The sign-in failure message never differs between an unknown e-mail, a wrong password, and a non-permitted profile status — verified across 100% of the tested combinations.

## Assumptions

- Existing clinic accounts are reused; this feature does not create, edit, delete, or invite accounts, and has no password-reset or "forgot password" flow.
- Only the Doctor and Receptionist roles may use this application; any other role is rejected with the same generic sign-in error.
- Permission to work is determined solely by the profile status: every status except "Inactive" and unknown values is allowed, per the acceptance criteria.
- A session persists across page reloads in the same browser until sign-out, session expiry, or server rejection. Concurrent sessions in multiple browsers are allowed.
- Failed-attempt throttling, account lockout, multi-factor authentication, "remember me", and audit logging of sign-in events are outside the scope of this feature.
- The e-mail existence check (F-1) intentionally reveals whether an e-mail is registered, while the sign-in result (AC-5) is intentionally generic; both behaviours are required as written.
- Validation messages for the password length rule are not specified in the input; the default wording "Password must be between 6 and 15 characters" is used.
- The generic message for a temporary system failure is not specified in the input; the default wording "Sign-in is temporarily unavailable. Please try again." is used.
- The home page is the existing landing page of the application; its content is out of scope.
- Users have an active network connection and a supported modern browser.

## Dependencies

- An existing account store and credential-verification capability that can confirm e-mail/password pairs.
- An existing user profile source that exposes the profile status and role for a given account.
- An existing session mechanism that can persist an authenticated state on the device and invalidate it.
- The application's existing authenticated API access, which must stop working once a session is removed.
