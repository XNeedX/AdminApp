# Contract: UI Components

**Feature**: `006-appointment-management` | **Date**: 2026-11-15

All components are `standalone: true` with `ChangeDetectionStrategy.OnPush`. Dumb components receive data through `input()`/`@Input()` and report through `output()`/`@Output()`; only the page, the create modal, and the shared dialog service may inject services.

## 1. Routing and navigation

| Contract | Value |
|---|---|
| Route path | `appointments` (child of the authenticated layout route) |
| Guard | `authGuard`, `roleGuard('Receptionist')` |
| Lazy import | `features/appointments/pages/appointments-page/appointments-page.component` |
| Header nav item | label "Appointments", path `/appointments`, visible for `Receptionist` only |
| Entry points | Header nav; "Create an appointment" on the page opens the modal |

## 2. `AppointmentsPageComponent` (smart)

Hosts the filter panel, the table, and the create modal. Owns `AppointmentFilterState` and delegates to `AppointmentsFacade`.

```ts
readonly filters: WritableSignal<AppointmentFilterState>;
readonly rows: Signal<readonly AppointmentRow[]>;
readonly isLoading: Signal<boolean>;
readonly loadError: Signal<string | null>;
readonly isCreateOpen: WritableSignal<boolean>;

onGenerate(): void;        // sets hasGenerated = true, loads rows
onFiltersChange(next: AppointmentFilterState): void;
onDateChange(date: string): void;  // reloads only when hasGenerated
onApprove(row: AppointmentRow): void;
onCancel(row: AppointmentRow): void;   // opens cancel dialog
onCreateRequested(): void;             // opens modal
onAppointmentCreated(): void;          // reloads if hasGenerated
```

Behavior:

- First visit: filters visible, table hidden, `Generate` enabled.
- `Generate` shows the table; later filter/date changes refresh it automatically.
- Load failure keeps previous rows and shows the notification from `NotificationService`.
- Cancel opens a CDK dialog with the exact cancellation message (section 6) and only deletes on `Yes`.

## 3. `AppointmentFiltersComponent` (dumb)

```ts
readonly state = input.required<AppointmentFilterState>();
readonly specializations = input<readonly SpecializationOption[]>([]);
readonly services = input<readonly ServiceOption[]>([]);
readonly doctors = input<readonly DoctorOption[]>([]);
readonly offices = input<readonly OfficeOption[]>([]);
readonly isLoading = input<boolean>(false);

readonly generate = output<void>();
readonly filterChange = output<AppointmentFilterState>();
readonly dateChange = output<string>();
readonly createRequested = output<void>();
```

- Fields: date (`input[type=date]`, default today), doctor full-name combobox, service-name combobox, status select (`Approved` / `Not Approved` / `All`, default `All`), office select, `Generate`, and `Create an appointment`.
- Uses Tailwind grid with `sm:grid-cols-2 lg:grid-cols-5`; every control has a visible label and an `aria-label` fallback.
- Emits a complete new state object, never mutates the input.

## 4. `AppointmentTableComponent` (dumb)

```ts
readonly rows = input.required<readonly AppointmentRow[]>();
readonly isLoading = input<boolean>(false);
readonly hasGenerated = input<boolean>(false);
readonly loadError = input<string | null>(null);

readonly approve = output<AppointmentRow>();
readonly cancel = output<AppointmentRow>();
readonly rescheduleRequested = output<AppointmentRow>();
```

- Native `<table>` inside `overflow-x-auto`; columns: Time, Doctor, Patient, Phone, Service, Actions.
- `@for (row of rows(); track row.id)`.
- Approved rows get `bg-emerald-50` and a `<app-appointment-status-badge>`; `Approve` is `disabled` with `aria-disabled="true"`.
- `Cancel` always enabled (unless `row.isDeleting`), `Reschedule` always `disabled` with `title="Reschedule is not available yet"`.
- Empty states: not generated → "Choose filters and generate the list."; generated but empty → "No appointments found for the selected filters."; error → error text plus a retry button emitted as `generate` is owned by the page.

## 5. `AppointmentCreateModalComponent` (smart)

Rendered through `AppDialogService.openCreateAppointment()` inside a CDK dialog (or inline when the dialog host mounts it). Owns `AppointmentFormStore`.

```ts
readonly created = output<void>();
readonly closed = output<void>();
```

- Fields and buttons exactly as AC-2: patient, specialization, doctor, service (comboboxes), office (dropdown), date, time slots, "Create patient", "Confirm", "x" top right.
- `Confirm` disabled while invalid, incomplete, or submitting.
- `x` always opens the exit confirmation (section 6), regardless of dirtiness (FR-022).
- "Create patient" opens the patient creation dialog over this modal and, on success, selects the returned patient while keeping every other value.
- On success emits `created` and `closed`; on failure stays open with all values and a notification.

## 6. Dialog contracts

| Dialog | Message (exact) | Buttons | Result |
|---|---|---|---|
| Exit appointment creation | `Do you really want to exit? Appointment will not be saved.` | `Yes`, `No` | `true` closes modal without saving; `false` returns with values intact |
| Cancel appointment | `Do you really want to cancel the appointment? It will be permanently deleted.` | `Yes`, `No` | `true` deletes; `false` leaves the table unchanged |

`AppDialogService` API:

```ts
openCreateAppointment(): DialogRef<void>;
confirmExit(): Promise<boolean>;    // resolves false on Esc/backdrop-safe close
confirmCancelAppointment(): Promise<boolean>;
openPatientCreation(): Promise<PatientOption | null>;
```

All dialogs use `@angular/cdk/dialog` with `autoFocus: 'first-tabbable'`, `restoreFocus: true`, `ariaLabelledBy` pointing at the title, and `disableClose: true` for confirmation dialogs (only the buttons resolve them). Escape resolves confirmations to `false`; it never deletes or discards silently.

## 7. `AppComboboxComponent` (shared, dumb)

```ts
readonly inputId = input<string>(`combobox-${nextId++}`);
readonly options = input.required<readonly AutocompleteOption[]>();
readonly placeholder = input<string>('');
readonly invalid = input<boolean>(false);
readonly describedBy = input<string | null>(null);
readonly disabled = input<boolean>(false);
readonly emptyText = input<string>('No matches');

readonly optionSelected = output<AutocompleteOption>();
readonly textChange = output<string>();
readonly blurred = output<void>();
```

- Implements `ControlValueAccessor` for the visible text (same contract as the existing `app-autocomplete`), while the selected **id** is owned by the consumer.
- Suggestion panel is rendered in a CDK overlay connected to the input: `matchWidth`, `reposition`, `closeOnScroll`, `hasBackdrop: false`.
- Keyboard: ArrowUp/Down, Home/End, Enter, Escape; `aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="option"`/`aria-selected`.
- Typing that matches no option and blurring marks the control invalid; the consumer supplies the message.

## 8. `AppDialogComponent` (shared)

```ts
readonly title = input<string>('');
readonly subtitle = input<string | null>(null);
readonly showClose = input<boolean>(true);
readonly closeLabel = input<string>('Close');
readonly close = output<void>();
```

Renders a Tailwind overlay panel with a header slot, `<ng-content>` body, and a footer slot (`[dialogFooter]`). Used by the creation modal and both confirmations so modal chrome and focus behavior are consistent.

## 9. Accessibility and responsive requirements

- Every combobox has a `<label for>`; error text is linked with `aria-describedby` and `aria-invalid` is set.
- Dialogs trap focus, restore focus to the trigger, and are dismissible only through their declared buttons (confirmations) or the `x` (creation modal).
- Table actions are buttons with `aria-label` including the row's time and patient ("Approve appointment 11:00 for Ivanov Ivan").
- Layout is mobile-first: filters stack, the table scrolls horizontally, dialog content scrolls with `max-h-[90vh]`.
- No component stylesheets; Tailwind utilities only, no `@apply`.

## 10. Validation messages

| Field | Empty | Invalid |
|---|---|---|
| Patient | `Please, choose the patient` | `Invalid patient name` |
| Specialization | `Please, choose the specialization` | — (selection-only) |
| Doctor | `Please, choose the doctor` | — |
| Service | `Please, choose the service` | — |
| Office | `Please, choose the office` | — |
| Date | `Please, choose the date` | — |
| Time slot | `Please, choose the time slot` | — |

Only the two patient messages are mandated by the spec; the rest follow the existing project wording pattern and must stay consistent with `doctor-create`.
