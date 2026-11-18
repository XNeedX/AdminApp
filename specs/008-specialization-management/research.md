# Phase 0 Research: Specialization Management

**Feature**: `008-specialization-management` | **Date**: 2026-11-18

All Technical Context unknowns are resolved. Each decision lists the choice, the rationale, and the
alternatives considered.

---

## D1. Typed `FormArray` syntax (context7 unavailable)

**Context**: The task asked to verify typed `FormArray` syntax with context7 before planning.

**Tool status**: `context7` `resolve-library-id` and `query-docs` both failed with
`Monthly quota exceeded. Create a free API key at https://context7.com/dashboard for more
requests.` No documentation was returned. This is recorded here instead of being silently
skipped.

**Verification substitute**: The project pins Angular 21.2 (`@angular/forms` 21.2) and
TypeScript 5.9. Typed forms (`FormControl<T>`, `FormGroup<T>`, `FormArray<T>`) have been the
stable public API since Angular 14 and are unchanged in the installed version. The existing
feature code already uses the same pattern (`features/services/components/service-form/
service-form.component.ts`), which compiles under `strict` and `strictTemplates`.

**Decision**: Use `FormArray<FormGroup<ServiceRowControls>>`, created with
`new FormArray<FormGroup<ServiceRowControls>>([])`. Row groups are built with
`new FormGroup<ServiceRowControls>({ ... })`. Read values with `getRawValue()`, mutate with
`push()` / `removeAt()`, and read state through `controls`, `length`, `valid`, `valueChanges`,
and `markAllAsTouched()`.

**Canonical shape** (single source for the implementation):

```ts
export interface ServiceRowControls {
  name: FormControl<string>;
  price: FormControl<number | null>;
  category: FormControl<ServiceCategory | ''>;
  status: FormControl<SpecializationStatus>;
}

export interface SpecializationFormControls {
  name: FormControl<string>;
  status: FormControl<SpecializationStatus>;
  services: FormArray<FormGroup<ServiceRowControls>>;
}

const form = new FormGroup<SpecializationFormControls>({
  name: new FormControl('', { nonNullable: true, validators: [Validators.required, nonBlankValidator] }),
  status: new FormControl<SpecializationStatus>('Active', { nonNullable: true, validators: [Validators.required] }),
  services: new FormArray<FormGroup<ServiceRowControls>>([]),
});
```

Notes that matter for implementation:

- The array itself is never replaced; only mutated, so template bindings to
  `form.controls.services.controls` stay valid.
- `FormArray` accepts array-level validators as the second constructor argument. The plan uses a
  `minLength(1)` array validator **and** an explicit `length === 0` submit guard, because the
  specification calls out emptiness separately from row validity.
- `price` is intentionally `FormControl<number | null>` (not `nonNullable`): an empty price must
  map to `null`, not `0`, so the required validator can distinguish "empty" from "invalid".
- Each row group is addressed by index in the template with `$index` and `track` by the control
  instance, which keeps focus and validation state stable when a middle row is removed.

**Alternatives considered**:
- Untyped `FormArray` with `AbstractControl` traversal - rejected: needs casts, conflicts with the
  no-`any`/strong-typing constitution.
- `FormRecord` keyed by service id - rejected: order and duplicate handling are simpler with an
  array, and new rows have no id yet.
- Template-driven forms with `ngModel` - rejected: array-level validation and disabled logic are
  markedly harder and the codebase standard is typed reactive forms.

---

## D2. Reacting to form validity under `OnPush`

**Problem**: `[disabled]="form.invalid"` is read during change detection. User input triggers CD,
but programmatic `push`/`removeAt` inside the component does not always schedule a new CD pass in
a way that keeps a `computed` value honest.

**Decision**: Keep a `formRevision` signal incremented from a single subscription to
`form.valueChanges` (bounded with `takeUntilDestroyed`). Derive:

```ts
readonly canSubmit = computed(() => {
  this.formRevision();
  return this.form.valid
    && this.form.controls.services.length > 0
    && !this.submitting();
});
```

`form.valueChanges` emits on `push`/`removeAt`/`reset`, so the revision covers control edits and
array structure changes. `markAllAsTouched()` is called on a blocked submit so messages appear.

**Alternatives considered**:
- `toSignal(form.statusChanges, { initialValue: form.status })` - works, but does not fire on
  structural array changes in every case and does not express `length === 0` explicitly.
- Calling `ChangeDetectorRef.markForCheck()` after each mutation - imperative and easy to forget.

---

## D3. View/Edit mode via signals

**Decision**: The detail page owns `readonly isEditMode = signal(false)`. View mode renders the
read-only definition list, the services table and the immediate status group. Edit mode mounts one
`<app-specialization-form mode="edit" [initialValue]="view()">` instance. `enterEdit()` flips the
signal; a successful save or a confirmed cancel flips it back.

The form component is remounted per Edit session, so no manual form reset is needed and no stale
dirty state can survive. The loaded view model stays the single source of truth for View mode.

**Rationale**: Matches the shipped `ServiceInfoComponent` behaviour (consistency), keeps the form
dumb, and makes "Cancel restores stored values" free - the page simply stops rendering the form.

**Alternatives considered**:
- One form always mounted with `disable()`/`enable()` - rejected: more state, more edge cases, and
  the template still needs both layouts.
- Editing in a dialog - rejected: the specification explicitly edits in place on the detail page.

---

## D4. Cancellation dialogs

**Decision**: Reuse `shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component.ts`
opened with CDK `Dialog.open<boolean, CancelConfirmDialogData>`; `disableClose: true`,
`restoreFocus: true`, `ariaLabelledBy: 'cancel-confirm-dialog-message'`. Exact messages:

- Create: `Do you really want to cancel? Entered data will not be saved.`
- Edit: `Do you really want to cancel? Changes will not be saved.`

`closed` resolving `true` means discard; `false` (or dismissal) means stay.

**Rationale**: Already used by the services and appointments features; CDK provides the focus trap,
`aria-modal` semantics and focus restoration the spec requires (FR-053, accessibility edge case).
No new dialog component or dependency is introduced.

**Alternatives considered**:
- Native `confirm()` - rejected: not styleable, blocks the thread, poor a11y control.
- A new bespoke dialog - rejected: duplicates an existing shared primitive.

---

## D5. Immediate status change and the cascade

**Decision**: In the list and in detail View mode, changing a radio updates the local signal
optimistically, then calls `SpecializationService.specializationIdStatusPatch({ id, body: {
status: fromSpecializationStatus(next) } })`. Success shows a toast; failure restores the previous
value, shows the error, and leaves dependent records untouched (backend did not run the cascade).
A per-row `statusSavingId` signal (single `statusSaving` flag on the detail page) disables the
group and ignores further changes while the request is in flight.

**Cascade**: The frontend never enumerates doctors or services. `EditSpecializationStatusCommand`
already publishes `ISpecializationStatusUpdatedEvent`; propagation is a backend responsibility.
Gap G-4 in `plan.md` records that the current backend does not yet cascade to services or doctors.

**Rationale**: The task explicitly requires the cascade confirmation to live on the backend and the
frontend to only invoke the generated method. Optimistic UI plus rollback satisfies SC-005/FR-044.

**Alternatives considered**:
- Refetch the row after PATCH - rejected: slower, causes visible flicker, no benefit.
- Client-side cascade (call every service/doctor status endpoint) - rejected: violates the stated
  requirement and would be non-atomic and slow.

---

## D6. Saving a specialization with nested services using only generated clients

**Problem**: There is no atomic "specialization + services" endpoint. Services are created through
`POST /Service` with `specializationId`, and existing services are updated through
`PUT /Service/{id}`. There is no delete endpoint for stored services.

**Decision**: Implement `SpecializationWriterService` - an application service inside the feature
that composes generated client calls. It is not an HTTP client and defines no transport types.

- **Create**: `specializationPost` → obtain the new id (blocked by gate G-2) → `servicePost` once per
  form row, sequentially, passing `specializationId`.
- **Edit**: `specializationIdPut` for the specialization, then `serviceIdPut` for every pre-existing
  row, then `servicePost` for rows added in this session. Stored services are never removed
  (FR-037).
- **Retry safety**: the writer accepts a session state object
  (`{ specializationId: string | null; createdServiceIds: readonly string[] }`) and returns an
  updated one. On retry it updates instead of re-creating the specialization and skips rows whose
  ids are already recorded, so a partial failure never produces duplicates (FR-021, FR-017,
  FR-032).
- **Failure semantics**: the first failing call stops the sequence, the error is propagated, and
  the form stays open with all values. The partial state is kept in memory and shown as a
  non-blocking notice so the user knows retry will continue from where it stopped.

**Rationale**: This is the only way to honour "the specialization and its service rows are saved
together" with the available API, without hand-written HTTP or fabricated data.

**Alternatives considered**:
- Ask the backend for a nested create/update command - **preferred long term**, captured as gate
  G-1; the writer is designed so it can later collapse into a single call without changing the
  components.
- Fire all service calls in parallel - rejected: partial failures become ambiguous and the retry
  bookkeeping is harder.
- Optimistically pretend success - rejected: violates FR-021/FR-033 and SC-003.

---

## D7. List loading, ordering and stale responses

**Decision**: Load with `specializationGet({ Page: 1, PageSize: 200 })` (constant
`SPECIALIZATION_PAGE_SIZE = 200`), validate the envelope, map with a type guard, sort
case-insensitively by name, and render. A monotonically increasing `requestId` guards against an
older response overwriting newer state after a status change or retry. Status patches do not
trigger a list reload; the signal is updated locally and confirmed by the PATCH result.

**Rationale**: The specification declares search/filter/sort/pagination out of scope, so one request
with a generous page size is the simplest deterministic behaviour; the backend still pages, so the
constant is documented as a deliberate bound. Sorting client-side satisfies FR-009 without adding
server parameters.

**Alternatives considered**:
- Loop all pages - rejected: unnecessary requests for the expected catalog size.
- No page parameters (backend defaults) - rejected: default page size is unknown and could silently
  truncate the list.

---

## D8. Status presentation mapping

**Decision**: The generated `Status` and `Category` enums are numeric. UI models use the string
unions `'Active' | 'Inactive'` and `'Analyses' | 'Consultations' | 'Diagnostics'`, converted with
exhaustive `switch` mappers that throw on unknown values. The feature owns small mappers in
`models/specialization.model.ts` rather than importing from `features/services`, to keep features
independent.

**Rationale**: Matches the existing convention (`ServiceStatus`, `ServiceCategory`), keeps templates
readable, and rejects unexpected API values instead of rendering `undefined`.

**Trade-off**: A few enum-mapping lines are duplicated with the services feature. Accepted for
feature isolation; unifying them into a shared model is a separate refactor and out of scope.

**Alternatives considered**:
- Use numeric enums directly in templates - rejected: unreadable and brittle.
- Import the services feature mappers - rejected: creates a feature-to-feature dependency the
  constitution's modular architecture discourages.

---

## D9. Testing strategy

**Decision**: Vitest with `TestBed`; generated services are provided as `vi.fn()` doubles; dialogs
are exercised through a mocked `Dialog.open`; `ActivatedRoute` is stubbed with `convertToParamMap`.
Coverage targets:

- **Form**: typed `FormArray` starts empty, `push` adds a row, `removeAt` removes it, `canSubmit`
  is false when the array is empty or a row is invalid, messages appear on blur, exact strings.
- **Create dialog**: `specializationPost` then `servicePost` ordering, duplicate-submit guard,
  cancel dialog Yes/No, partial-failure retry reuses the created id.
- **List page**: mapping/sorting, empty state, error+retry, immediate status patch, rollback on
  error, in-flight guard, row click navigation.
- **Detail page**: load/not-found/error states, Edit pre-fill, save, cancel Yes/No, staged status in
  Edit mode, immediate status in View mode.

**Rationale**: Mirrors the existing specs in `features/services` and `features/doctors`; no new test
runner or pattern is introduced.

**Alternatives considered**:
- Browser E2E - out of scope for this feature; `quickstart.md` covers manual end-to-end checks.

---

## D10. Accessibility, responsive layout and keyboard support

**Decision**: Radios are native inputs inside labelled fieldsets with per-row `name` groups; the
table exposes column headers with `scope="col"`; row activation is a real focusable element
(a `<button>`/link in the name cell plus a clickable row, with `stopPropagation` on the status cell)
rather than a `div` with a click handler only; validation messages are linked with `aria-describedby`
and invalid controls carry `aria-invalid`; dialogs rely on CDK focus trap and restoration. Layouts
use Tailwind mobile-first breakpoints, with the services table horizontally scrollable on small
screens.

**Rationale**: Satisfies FR-051/FR-053, SC-011 and the constitution's CDK/Tailwind rules.

**Alternatives considered**:
- Custom ARIA radio widget - rejected: native radios are correct and keyboard-free to implement.
- Card layout instead of table on mobile - deferred; scrolling table keeps column semantics for
  tests and is the least complex compliant option.
