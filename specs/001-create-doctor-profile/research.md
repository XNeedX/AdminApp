# Phase 0 Research: Technical Decisions for Create Doctor Profile

## Decision 1: Form Architecture & Strongly-Typed Reactive Forms
- **Decision**: Use Angular 21's strictly-typed `FormGroup` and `FormBuilder` (via `NonNullableFormBuilder` or explicit `FormControl<T>` definitions).
- **Rationale**: 
  - Provides compile-time type safety across all form controls and values.
  - Aligns with the project constitution prohibiting `any` and ensuring robust TypeScript compliance.
  - Controls can track their validation status, touched/dirty states, and pending asynchronous validation seamlessly.
- **Alternatives Considered**:
  - Template-driven forms: Rejected because they lack strict compile-time type checking, are harder to unit test independently, and make complex cross-field and async validation cumbersome.
  - Signal-based forms: Angular's experimental Signal Forms are not yet stable/standard; standard Reactive Forms with `toSignal()` bridge provide the most robust, battle-tested solution.

## Decision 2: Field Validation Strategy on Blur & Error Display
- **Decision**: Bind error visibility in template to `control.invalid && control.touched`. Form controls mark themselves `touched` automatically on `blur`.
- **Rationale**: 
  - Satisfies requirement F-1 through F-10: errors appear only after user interaction and loss of focus (`blur`).
  - Native Angular reactive form behavior marks controls as `touched` on the standard DOM `blur` event without requiring intrusive custom blur directives.
  - Tailwind styling can conditionally apply error borders and text: `class="border-red-500 focus:ring-red-500"` when `control.invalid && control.touched`.
- **Alternatives Considered**:
  - Custom `(blur)` event listeners manually toggling local flags: Rejected as redundant boilerplate since Angular's `FormControl.touched` already tracks blur state natively.
  - Validation on submit only: Rejected because requirement specifically states validation feedback triggers on blur.

## Decision 3: Custom Date Validator (<= Current Date)
- **Decision**: Implement a reusable validator function `maxDateValidator(maxDate: () => Date)` and `maxYearValidator(maxYear: () => number)`.
- **Rationale**: 
  - Directly fulfills AC-6: date fields (Date of Birth, Career start year) must not exceed the current date/year.
  - Using a factory function accepting a date-getter ensures the validator always compares against the current date dynamically at runtime (avoiding static time staleness).
  - Returns `{ futureDate: { max: maxDate, actual: controlValue } }` if invalid, and `null` if valid.
- **Alternatives Considered**:
  - HTML5 `max` attribute alone: Rejected because native browser validation does not guarantee programmatic form validity in Angular `FormGroup` or custom datepicker components.

## Decision 4: Asynchronous Email Uniqueness Validation
- **Decision**: Implement an `AsyncValidatorFn` that injects the generated API client service. It pipes the email value through `timer(300)` (debounce), `distinctUntilChanged()`, `switchMap()`, and returns `{ emailTaken: true }` if the backend indicates the email exists.
- **Rationale**: 
  - Meets AC-4, F-6 requirement: "User with this email already exists".
  - Debouncing prevents overwhelming backend microservices with intermediate keystrokes.
  - Proper handling with `catchError` ensures network failures do not hang the form in a permanent pending state.
- **Alternatives Considered**:
  - Checking uniqueness only on form submit: Rejected because acceptance criteria F-6 specifically requires on-blur validation for existing email before submission.

## Decision 5: Modal & Confirmation Dialog Architecture
- **Decision**: Implement `ConfirmCancelDialogComponent` as a reusable presentational dialog component, controlled by `DoctorCreateComponent` or Angular CDK Dialog overlay.
- **Rationale**: 
  - Meets AC-7 through AC-10 cleanly: dialog renders "Do you really want to cancel? Entered data will not be saved." with "Yes" and "No".
  - Keeps dialog purely dumb/presentational: emits confirmation via `output<boolean>()` or CDK Dialog reference.
  - `DoctorCreateComponent` acts as the Smart Container managing whether to close the modal or keep the form state intact.
- **Alternatives Considered**:
  - Browser native `window.confirm()`: Rejected due to poor UX, lack of styling consistency with Tailwind, and inability to match exact acceptance criteria wording and styling.

## Decision 6: Backend API Integration Layer
- **Decision**: Inject generated client services (e.g. `DoctorService`, `SpecializationService`, `OfficeService`) located in `src/app/api/`.
- **Rationale**: 
  - Strictly follows Constitution Principle II: "Automated Backend API Integration (Zero Manual API Code)".
  - UI only maps form values to the expected DTO (`DoctorCreateDto`); password generation and credential email dispatch are handled entirely by backend ASP.NET microservices as specified in AC-4 and AC-5.
