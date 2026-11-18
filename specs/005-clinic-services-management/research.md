# Phase 0 Research: Clinic Services Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Date**: 2026-11-12

This document records the technical decisions that resolve every unknown in the plan's Technical Context. There are no remaining `NEEDS CLARIFICATION` items.

---

## R1. Reusable form: one dumb `ServiceFormComponent` for Create and Edit

**Decision**: Build `features/services/components/service-form/service-form.component.ts` as a standalone, `OnPush`, presentational component. It exposes signal inputs `mode: 'create' | 'edit'`, `initialValue: ServiceFormValue | null`, `submitting: boolean`, and signal outputs `submitted: ServiceFormValue` and `cancelled: void`. It owns the typed `FormGroup` and renders the fields and the mode-specific footer buttons ("Confirm" vs "Save changes", plus "Cancel"). It never injects an API service, router, or dialog.

**Rationale**: The field set, validation rules, and messages are identical for Create and Edit (spec F-1…F-4, FR-019). A single dumb component guarantees that the two modes cannot drift apart, satisfies the constitution's Smart/Dumb rule, and keeps the component independently testable.

**Alternatives considered**:

- *Two separate form components* — duplicates validation and messages, which the spec explicitly shares. Rejected.
- *Reusing the doctor create form* — different fields and a different submit flow. Rejected.
- *A generic schema-driven form builder* — over-engineered for four fields and would hide the exact error messages the spec requires. Rejected.

---

## R2. Strictly typed reactive forms

**Decision**: Use `ReactiveFormsModule` with a typed `FormGroup<ServiceFormControls>` built from non-nullable controls where the value is always present:

- `name: FormControl<string>` (`nonNullable`, `Validators.required`, `Validators.maxLength(100)`).
- `price: FormControl<number | null>` (`Validators.required` + custom `positivePriceValidator`).
- `category: FormControl<ServiceCategory | ''>` (`nonNullable`, `Validators.required`).
- `status: FormControl<ServiceStatus>` (`nonNullable`, default `ServiceStatus.Active`).

The form reads/writes via `getRawValue()` and `reset(value)`, so disabled controls never produce `undefined` values. `FormGroup.value` is avoided in favour of `getRawValue()` because the type is `Partial<...>`.

**Rationale**: Angular reactive forms are strictly typed by default since v14; explicit control types keep the code free of `any` and make `toUpdateServiceDto` exhaustive. `nonNullable` prevents the `null` that `reset()` would otherwise introduce into the name and status controls. This was verified against the official Angular "Strictly typed reactive forms" guide (`https://angular.dev/guide/forms/typed-forms`).

**Alternatives considered**:

- *Template-driven forms* — weaker typing and harder dynamic validation. Rejected.
- *Signal Forms* — available in Angular 21 as experimental/new API, but the project standard and existing code use reactive forms. Rejected for consistency and stability.
- *`UntypedFormGroup`* — violates the no-`any` rule in spirit. Rejected.

---

## R3. Custom price validator (`Price > 0`)

**Decision**: Add `core/validators/positive-price.validator.ts` exporting `positivePriceValidator: ValidatorFn`. It returns `{ invalidPrice: true }` when the value is not a finite number, is `<= 0`, or has more than two fractional digits. Empty is left to `Validators.required` so the two messages stay distinct.

**Rationale**: The spec requires two different messages: "Please, enter the price" for empty and "You've entered an invalid price" for non-numeric or `<= 0` (F-2). Splitting the rules keeps the message selection unambiguous. A native `type="number"` input can still yield `null` for unparsable text, so the validator must treat `null`/`NaN` as invalid rather than rely on the browser.

**Alternatives considered**:

- *A single validator for empty and invalid* — cannot produce the two required messages. Rejected.
- *`Validators.min(0.01)`* — accepts `0.001` and cannot express the precision rule. Rejected.
- *Pattern validation on a text input* — loses the numeric keyboard and native stepper. Rejected.

---

## R4. View/Edit state with signals in `ServiceInfoComponent`

**Decision**: `features/services/pages/service-info/service-info.component.ts` is the smart page. It holds `service = signal<ServiceView | null>(null)`, `isEditMode = signal(false)`, `isLoading`, `isSaving`, `statusSaving`, `loadError`. `isEditMode` toggles between the read-only view and the reused `ServiceFormComponent` in `edit` mode. Save success sets `service` to the returned/merged value and flips `isEditMode` back to `false`.

**Rationale**: Signals give synchronous, glitch-free template rendering without `AsyncPipe`, matching the constitution's signal-first rule. The page is the only place that knows about routing, the API client, dialogs, and notifications, keeping the form dumb.

**Alternatives considered**:

- *A separate edit route* — the spec requires an in-page View/Edit switch (US3 AC-1). Rejected.
- *A component store / NgRx* — unnecessary for a single page. Rejected.

---

## R5. Cancel confirmation via `@angular/cdk/dialog`

**Decision**: Extract the existing profile-specific `CancelEditDialogComponent` into a shared `shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component.ts` (standalone, `OnPush`). It injects `DIALOG_DATA` (`{ message, confirmText?, cancelText? }`) and `DialogRef<boolean>`, and closes with `true`/`false`. Both the create dialog and the service info page open it with `Dialog.open<boolean, CancelConfirmDialogData>(...)` using `disableClose: true`, `ariaLabelledBy`, and `restoreFocus: true`.

**Rationale**: CDK supplies the backdrop, focus trap, `aria-modal` semantics, and focus restoration, which the spec requires (FR-033). The pattern already works in `ProfilePageComponent` (`Dialog.open<boolean, { message: string }>`), so this reuses a proven in-repo approach instead of inventing a new one. Extracting it to `shared/` avoids a cross-feature import.

**Alternatives considered**:

- *The existing output-based `ConfirmCancelDialogComponent`* — it is rendered inline, not opened through CDK, so it has no focus trap or `DialogRef`. It also has a different API (`output<boolean>`). Kept for the doctor-create flow; not used here. Rejected.
- *Native `<dialog>`* — lacks the CDK focus management and consistent styling primitives. Rejected.

**Documentation note**: The requested `context7` lookup could not be completed — the Context7 API returned "Monthly quota exceeded" for both `@angular/cdk/dialog` and Angular Reactive Forms queries. The decision was therefore verified against (a) the working CDK usage already in `profile-page.component.ts` / `cancel-edit-dialog.component.ts`, and (b) the official Angular typed-forms guide. The CDK dialog syntax used in the plan is the same as the code that already compiles and passes tests in this repository.

---

## R6. API layer: generated OpenAPI client only

**Decision**: All Services API access goes through the generated OpenAPI client. Add `ng-openapi-gen` as a dev dependency, generate from the live Services API definition (`http://localhost:5095/swagger/v1/swagger.json`, or the Gateway Swagger aggregation), and emit into `src/app/api/generated/services/`. Configure the generated `ApiConfiguration` (or the generated base URL token) with `${environment.apiUrl}/services`, because the Gateway route `/services/{everything}` maps to the service's `/api/{everything}`.

**Rationale**: The constitution (Principle II) forbids hand-written HTTP services, DTOs, and models. The user's plan input reiterates this. The generator produces typed request models (`CreateServiceCommand`, `EditServiceDTO`, `EditStatusDTO`) and an injectable Angular service, removing manual transport code.

**Blocking prerequisite (contract gap)**: The current Services API Swagger has **no response schemas** for the Service endpoints (`IActionResult` without `[ProducesResponseType]`), and the `Category`/`Status` enums are documented as bare integers without names. A generator can therefore type requests but not responses. Per the constitution's "Missing Contract Protocol", implementation of the API-dependent parts pauses until the backend publishes typed responses (see [contracts/services-api.contract.md](./contracts/services-api.contract.md) §5). The plan includes this as task `T0`, owned by the backend team, before any feature task that touches the API.

**Alternatives considered**:

- *Hand-written `service.service.ts` with `unknown` guards* — the approach used by the earlier doctor feature, but explicitly forbidden by the user's plan input and by the constitution. Rejected.
- *`@hey-api/openapi-ts`* — a valid alternative, but `ng-openapi-gen` emits idiomatic Angular `HttpClient` services and DI-friendly modules that match this codebase. Chosen generator: `ng-openapi-gen`; the alternative is noted in case the team prefers fetch-based clients.

---

## R7. Immediate status change (User Story 4 / input User Story 2)

**Decision**: On the service information page in View mode, the status control is an Active/Inactive radio group. Changing it calls the generated status operation (`PATCH /api/Service/{id}/status` with `EditStatusDTO`) immediately, with an optimistic UI update and rollback plus an error toast on failure. In Edit mode the status is part of `ServiceFormComponent` and is persisted by the "Save changes" operation (`PUT /api/Service/{id}`), matching the shared field rules F-4/FR-019.

**Rationale**: The user's plan input explicitly requires the status change to call the API immediately, and the backend already exposes a dedicated status operation. The optimistic update keeps the interaction instant; the rollback satisfies FR-030.

**Alternatives considered**:

- *Status only through the edit form* — would not satisfy "changes status in DB" as an immediate action. Rejected.
- *Status toggle on the specialization service list* — the status toggle lives on the service information page this feature owns; the `/services` list stays read-only. A list-level toggle can reuse the same operation later.

---

## R8. Enum mapping (numeric API values → business labels)

**Decision**: Keep a single mapping module in `features/services/models/service.model.ts`:

- `ServiceStatus`: `0 → 'Active'`, `1 → 'Inactive'`.
- `ServiceCategory`: `0 → 'Analyses'`, `1 → 'Consultations'`, `2 → 'Diagnostics'`.

The UI uses string-literal union types (`'Active' | 'Inactive'`, `'Analyses' | 'Consultations' | 'Diagnostics'`) and converts at the boundary with exhaustive `switch` functions that throw on an unknown value. The generated client's numeric enum type is narrowed through these functions, never cast.

**Rationale**: The Services API does not register a string enum converter, so it serializes enums as integers. Using readable labels in the UI keeps templates and validation messages clear, while a single boundary mapper prevents numeric values from leaking into components. Exhaustive switches keep the code `any`-free.

**Alternatives considered**:

- *Using the numeric enum directly in templates* — unreadable and error-prone. Rejected.
- *Asking the backend to serialize enums as strings* — a valid long-term improvement; it is listed as a contract gap but not required for this plan.

---

## R9. Error handling and notifications

**Decision**: Reuse the global `apiErrorInterceptor` for 401/403/5xx and the `NotificationService` for user-facing failures. The feature adds no new global error handling; it only translates validation failures (HTTP 400 with `errors[]`) into the existing toast pattern.

**Rationale**: The constitution requires centralized error interception. Reusing `extractErrorMessage` keeps wording consistent with the rest of the app.

**Alternatives considered**:

- *Per-component HTTP error formatting* — duplicates logic. Rejected.

---

## R10. Testing approach

**Decision**: Use the existing Vitest + Angular TestBed setup (`npm test -- --watch=false`).

- `ServiceFormComponent`: validation and message tests for name, price, category; `Confirm`/`Save changes` disabled/enabled; `touched`-driven error visibility; mode-specific button labels.
- `ServiceInfoComponent`: View → Edit toggle, save flow with a stubbed generated client, cancel → Yes/No via a stubbed `Dialog`, optimistic status change and rollback.
- `ServiceCreateDialogComponent`: successful create closes with the id; failure keeps the form open and shows an error.
- Model mappers: exhaustive enum mapping and DTO conversion.

**Rationale**: Component-level tests cover the acceptance criteria without requiring the backend. The generated client is injected, so it is replaced with a typed stub in tests (no `any`).

**Alternatives considered**:

- *End-to-end tests* — valuable but outside the current toolchain (no Playwright/Cypress configured). Manual scenarios are captured in [quickstart.md](./quickstart.md). Rejected for this phase.
