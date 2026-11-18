# Research: Doctor Profile Management

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This document records the technical decisions that resolve the open questions in the plan. No `NEEDS CLARIFICATION` items remain.

---

## D1. View/Edit state ownership

**Decision**: `ProfilePageComponent` is the single Smart container. It owns `isEditMode = signal(false)`, the loaded `DoctorProfile`, the catalogs, the typed form, and all saving flags. It renders `ProfileViewComponent` in View mode and `ProfileEditComponent` in Edit mode.

**Rationale**:
- The user's architectural requirement explicitly asks for one Smart component switching Dumb children.
- Keeping the form and the persisted profile in one place makes "discard on cancel" a pure state reset instead of a cross-component negotiation.
- The Dumb children stay trivially testable with inputs and outputs.

**Alternatives considered**:
- *Two routed pages (`/profile` and `/profile/edit`)*: rejected — the spec describes a mode switch on the same page; routing would require a dirty-check guard and would complicate the "Cancel → View" requirement.
- *Form state inside `ProfileEditComponent`*: rejected — the page would then need to read the child form to enable/disable the footer, violating the Dumb boundary.

---

## D2. Reactive form shape and reactive validity

**Decision**: Use a typed `FormGroup<DoctorProfileForm>` built with `FormBuilder`. Bridge form status to a signal:

```ts
private readonly formStatus = toSignal(
  this.profileForm.statusChanges.pipe(startWith(this.profileForm.status)),
  { initialValue: this.profileForm.status }
);

readonly canSave = computed(() => this.formStatus() === 'VALID' && !this.isSaving());
```

**Rationale**:
- `FormGroup.valid` is not a signal; a `computed()` that reads it would not re-evaluate when the form changes. `toSignal(statusChanges)` makes the derived `canSave` genuinely reactive.
- The template can bind `[disabled]="!canSave()"` without calling methods on every change-detection cycle.
- `startWith` covers the initial status before any value change.

**Alternatives considered**:
- *Reading `profileForm.valid` directly in the template*: works, but the footer button also needs the `isSaving` flag and the logic would be duplicated in the template.
- *A manual `valueChanges` subscription that updates a signal*: equivalent but leaks a subscription and requires `takeUntilDestroyed`; `toSignal` handles teardown.

---

## D3. Cancellation dialog implementation (Angular CDK)

**Decision**: Use `@angular/cdk/dialog` (`Dialog`, `DialogRef`, `DIALOG_DATA`, `DialogConfig`). Add `@angular/cdk@^21.2.0` and import `@angular/cdk/overlay-prebuilt.css` in `src/styles.css`.

Opening the dialog from `ProfilePageComponent`:

```ts
const dialogRef = this.dialog.open<boolean, CancelEditDialogData>(
  CancelEditDialogComponent,
  {
    data: { message: 'Do you really want to cancel? Changes will not be saved.' },
    ariaLabelledBy: 'cancel-edit-dialog-message',
    disableClose: true,
    autoFocus: 'first-tabbable',
    restoreFocus: true,
    panelClass: 'app-dialog-panel',
  }
);

dialogRef.closed
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((confirmed) => {
    if (confirmed === true) {
      this.isEditMode.set(false);
      this.profileForm.reset(this.toFormValue(this.profile()));
    }
  });
```

The dialog content component closes itself:

```ts
readonly data = inject<CancelEditDialogData>(DIALOG_DATA);
private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

confirm(): void { this.dialogRef.close(true); }
dismiss(): void { this.dialogRef.close(false); }
```

**Verified syntax source**: Context7 was called first, as required, but returned `Monthly quota exceeded`. The official Angular CDK dialog documentation (`src/cdk/dialog/dialog.md` in `angular/components`) and the `Dialog` service source were read directly. Confirmed facts:
- `Dialog.open(componentOrTemplateRef, config)` returns a `DialogRef`.
- `DialogRef.closed` is an `Observable` that completes when the dialog closes; the close value is forwarded.
- Components opened by the dialog can inject `DialogRef` and `DIALOG_DATA`.
- `DialogConfig` supports `ariaLabelledBy`, `disableClose`, `autoFocus` (`'first-tabbable'`, `'first-header'`, `'dialog'`, or a CSS selector), and `restoreFocus`.
- `Dialog` is injectable without a module import in Angular 21; no `DialogModule` is required.
- Overlay structural styles come from `@angular/cdk/overlay-prebuilt.css` (or the `cdk.overlay` Sass mixin).

**Behaviour mapping**:
- AC-6: clicking "Cancel" always opens the dialog (even when nothing changed).
- AC-7: the dialog shows "Yes" and "No".
- AC-8: "Yes" → `close(true)` → page returns to View mode; the form is reset from the persisted profile.
- AC-9: "No" → `close(false)` → page stays in Edit mode; no form reset.
- `disableClose: true` implements the spec edge case that backdrop click and Escape do not dismiss the dialog without a choice.

**Alternatives considered**:
- *Native `<dialog>` element*: valid per the user's requirement, but requires manual focus trap, focus restoration, backdrop handling, and scroll locking. CDK provides all of it and is the constitution's preferred primitive.
- *Reusing `ConfirmCancelDialogComponent` as CDK content*: rejected — it renders its own `fixed inset-0 bg-black/50` backdrop, so opening it inside a CDK overlay would nest two backdrops and couple the create flow to the dialog service.
- *Inline conditional rendering (current create-form pattern)*: rejected for this feature because the spec requires an accessible modal and the page already has two modes; a real overlay keeps the dialog out of the form layout.

---

## D4. Specialization and Office controls

**Decision**: Create a reusable Dumb `AutocompleteComponent` in `shared/components/autocomplete/`:
- Native `<input type="text" role="combobox">` with `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"`.
- A Tailwind-styled `<ul role="listbox">` with `<li role="option">`.
- Implements `ControlValueAccessor` for the visible text value.
- Emits `optionSelected: AutocompleteOption` when the user picks an entry.
- Keyboard support: `ArrowDown`, `ArrowUp`, `Enter`, `Escape`, `Home`, `End`.
- Calls `onTouched()` on blur so the parent's blur validation runs.

The form keeps a pair of controls per field:
- `specializationText` (visible, `required` + `specializationCatalogValidator`)
- `specializationId` (hidden, `required`, set only by `optionSelected`)
- `officeText` / `officeId` follow the same pattern.

**Rationale**:
- The pair distinguishes the two required messages: empty text → "Please, choose the specialisation"; non-empty text with no matching catalog entry → "Invalid specialization name".
- A single nullable option value cannot distinguish "empty" from "typed garbage" without custom error mutation.
- Native elements avoid a second overlay implementation and are fully styleable with Tailwind, which satisfies the user's "CDK or native" requirement.
- The create form's combobox logic remains untouched; the profile feature gets a tested, reusable control.

**Alternatives considered**:
- *CDK Overlay-based combobox*: more code, more focus-management edge cases, no benefit for a short in-page list.
- *Angular Material autocomplete*: not installed; adds a second design system and a large dependency.
- *Single `FormControl<AutocompleteOption | null>` with manual `setErrors`*: brittle when validators change and hard to unit test.

---

## D5. Date and year validation (AC-5)

**Decision**: Reuse the existing custom validators in `core/validators/max-date.validator.ts`:
- `maxDateValidator(() => new Date())` on `dateOfBirth` → error key `futureDate`.
- `maxYearValidator(() => new Date().getFullYear())` on `careerStartYear` → error key `futureYear`.

Both normalize to local midnight and compare against the current date/year, so "today" and "this year" are accepted while "tomorrow" and "next year" are rejected.

**Rationale**:
- The validators already exist, are unit-tested, and are used by doctor creation; reusing them guarantees the two features agree on AC-5.
- No new validator is needed. The plan requirement to "write a custom validator" is satisfied by these project-owned validators; the profile work adds tests for their boundary behaviour in this form.

**Alternatives considered**:
- *HTML `max` attribute only*: not sufficient — typed/pasted values and programmatic changes bypass it, and the save button must be disabled by form validity.
- *Duplicating the validators inside the profile feature*: rejected — violates the single-source rule and risks divergent messages.

---

## D6. Resolving the Doctor's own profile

**Decision**: Use `GET /profiles/doctors/account/{accountId}` with `accountId = AuthService.user().accountId` (the Keycloak `sub`). There is no `GET /me`. The response must be the full profile including `id` and `status`.

**Rationale**:
- The JWT `sub` is a Keycloak account id, not the doctor profile GUID. The frontend cannot call `GET /profiles/doctors/{id}` without first resolving the profile id.
- `GET /profiles/doctors?SearchName=...` is restricted to `Patient, Receptionist`, so a Doctor cannot use it.
- `DoctorProfile.AccountId` exists in the backend model, so a by-account lookup is a small backend addition. The agreed linking rule is `AccountId = sub`.
- The endpoint and the link are currently missing. The frontend is implemented against the contract and shows a clear "Profile not found" state until they land.

**Alternatives considered**:
- *`GET /me` derived from the token*: rejected by the agreed decision; the identity is already in `AuthService`.
- *Store the profile id in the token during sign-in*: requires a Keycloak mapper and backend changes; not available today.
- *Search the doctors table by e-mail*: blocked by role and exposes other doctors' data to the client.
- *Derive the id from the e-mail local part*: unsafe and incorrect.

---

## D7. Receptionist status change

**Decision**: A plain `<select>` per row on the "Doctors" page, bound with `[value]` and `(change)`. The select is rendered only when `AuthService.user()?.roles` includes `Receptionist`. On change:
1. Validate the value with `isDoctorStatus`.
2. Optimistically update the row signal.
3. Read the full profile with `GET /profiles/doctors/{id}` (E2), build the full `UpdateDoctorDto` with only `status` replaced, and send `PUT /profiles/doctors/{id}` (E3).
4. On success, show a success toast; on failure, restore the previous status and show an error toast.
5. Disable the select for that row while the request is in flight (a `Set<string>` signal).

**Rationale**:
- The user explicitly asked for a simple select with `(change)` and an immediate request.
- There is no status-only endpoint and no `PATCH` (agreed decision). `PUT` requires the full `UpdateDoctorDto`, and the table row does not contain `careerStartYear`, split names, or the photo, so the client reads the full profile first.
- Reading the full profile before `PUT` preserves every field and avoids the data corruption risk of reconstructing names from `fullName`.
- Optimistic UI keeps the interaction instant; rollback satisfies FR-025.

**Alternatives considered**:
- *`PATCH /profiles/doctors/{id}/status`*: rejected by the agreed decision to reuse the existing `PUT`.
- *Reuse `PUT` with data reconstructed from the table row*: would corrupt names and reset `careerStartYear`/`photoPath`.
- *Navigate to the profile page to change status*: violates US3's "on Doctors page" and the user's requirement.

---

## D8. Routing and role access

**Decision**: Add a functional `roleGuard(...allowed: readonly AuthRole[])` in `core/guards/role.guard.ts` and two routes inside the existing authenticated parent:

```ts
{ path: 'profile', canActivate: [roleGuard('Doctor')], loadComponent: ... }
{ path: 'doctors/:id/profile', canActivate: [roleGuard('Receptionist')], loadComponent: ... }
```

The parent already applies `authGuard`. `roleGuard` reads `AuthService.user()?.roles`, redirects unauthenticated users to `/sign-in`, and redirects wrong roles to `/`.

**Rationale**:
- US2 is Doctor-only; US1's Receptionist path is per-doctor. Separate routes make the intent explicit and keep the Smart page's loading logic simple (`route.paramMap` presence = receptionist mode).
- A functional guard matches the existing `authGuard` style and avoids class-based boilerplate.

**Alternatives considered**:
- *A single `/profile/:id?` route with component-level checks*: weaker security boundary and more branching in the page.
- *Hiding the profile icon only*: not sufficient; direct URL access must be blocked.

---

## D9. Photo handling

**Decision**:
- `photo` control holds a `File | null` for a newly selected file only.
- Keep the loaded `photoPath` in the profile model.
- On save, if a new file exists, call the generated documents upload first; otherwise reuse the existing `photoPath`.
- Show a local preview with `URL.createObjectURL` and revoke it in `ngOnDestroy` (or on replace).
- No remove-photo action (not in the spec).

**Rationale**:
- Sending `photoPath: null` for an unchanged photo could erase the stored photo.
- Uploading before the profile update keeps the update payload small and matches the create flow.

**Alternatives considered**:
- *Send the `File` in the profile update*: the Profiles API expects a storage path, not multipart.
- *Always upload a placeholder*: unnecessary and risks orphaned blobs.

---

## D10. Error handling and data preservation

**Decision**: Rely on the existing global interceptors for 401/403/5xx. In the page:
- `loadError` signal + retry button for profile load failures.
- `isSaving` signal; on save failure, keep Edit mode, keep all values, show `NotificationService.showError(...)`.
- On status failure, roll back and toast.
- Use the existing `extractErrorMessage` helper from `api-error.interceptor.ts` for contextual messages.

**Rationale**:
- Matches the established create-form behaviour and the constitution's centralized error rule.
- FR-020/FR-025 require no data loss and a retry path.

**Alternatives considered**:
- *Navigate away on error*: loses user input.
- *Inline error banner only*: inconsistent with the rest of the app, which uses toasts.

---

## D11. Catalog data and fallbacks

**Decision**: The profile feature must use real catalog responses. The offline fallbacks that used to live in `SpecializationService` and `OfficeService` were removed. The typed clients surface catalog errors; the page then shows a warning and keeps "Save changes" disabled rather than allowing a fake selection.

**Rationale**:
- Saving a fallback specialization or office would corrupt the doctor record.
- The spec's edge case "stored specialization/office no longer exists" requires the real catalog to decide validity.

**Alternatives considered**:
- *Keep fallbacks*: unacceptable for a write path.
- *Hard-code the catalog in the profile feature*: drifts from the backend and bypasses the catalog contract.

---

## D12. Testing strategy

**Decision**:
- **Unit (Vitest + TestBed)**:
  - `ProfilePageComponent`: loads profile; `Edit` enters edit mode; `Cancel` opens the dialog; `Yes` resets to View; `No` preserves values; save builds the correct `UpdateDoctorDto`; save failure keeps Edit mode.
  - `ProfileEditComponent`: renders each error message on blur; disables save through the parent's `canSave`.
  - `AutocompleteComponent`: filters, selects, keyboard navigation, `onTouched` on blur.
  - `DoctorsPageComponent`: status change calls the client, optimistic update, rollback on error.
  - `roleGuard`: Doctor/Receptionist/unauthorized redirects.
  - `maxDateValidator` / `maxYearValidator`: today/current year accepted; tomorrow/next year rejected.
- **HTTP**: `HttpTestingController` for the typed `src/app/api/` clients; verify envelope parsing, guards, and error propagation.
- **Manual**: `quickstart.md` covers the full AC matrix, including the CDK dialog focus behaviour.

**Rationale**: Covers every testable FR without duplicating the implementation.

**Alternatives considered**:
- *E2E only*: too slow and brittle for form validation; the project has no Playwright/Cypress setup.

---

## D13. Styling and responsiveness

**Decision**: Tailwind utilities only. View mode uses a responsive two-column grid (`md:grid-cols-3`) with a photo card; Edit mode uses a single-column form on mobile and a two-column grid from `md`. Error state is `border-red-500` + `text-red-600` with `aria-describedby` pointing at the message id. Status badges use a small `@switch` over the status value.

**Rationale**: Matches Principle IV and the existing visual language (gray/white cards, blue primary, red destructive).

**Alternatives considered**:
- *Component SCSS*: prohibited by the constitution.
- *`@apply` classes*: prohibited.
