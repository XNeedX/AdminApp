# Contract: Appointment Form Cascade

**Feature**: `006-appointment-management` | **Date**: 2026-11-15

Pure-function contract implemented in `features/appointments/services/appointment-cascade.ts`. It has no Angular or HTTP dependency and is the single place where field interdependencies are defined.

## 1. Inputs and outputs

```ts
reduceAppointmentCascade(input: CascadeInput): CascadePlan
```

- `value` — normalized form snapshot (`*Id` fields only; empty string means unset).
- `catalogs` — already loaded and already filtered to active/at-work records.
- `lastEditedField` — the field the user (or an auto-fill) has just changed. Used solely to decide the winner when two rules conflict.
- `availableDoctors` — set of doctor ids with a free slot at the selected date/time, or `null` when not resolved.

Outputs:

| Output | Meaning |
|---|---|
| `options.*` | Exactly the options each combobox may display right now |
| `autoFill` | Writes the store must apply (doctor→specialization/office, service→specialization, single-doctor auto-fill) |
| `clear` | Writes that remove selections invalidated by the current state |
| `dateEnabled` | `specializationId !== '' && serviceId !== ''` |
| `slotsEnabled` | `dateEnabled && date !== ''` |
| `isComplete` | All required ids present, all still present in `options`, date and slot set, and the doctor is consistent with every filter |

The reducer **never** emits a write for `lastEditedField`. Writes are applied with `emitEvent: false` and compared by value before writing, which makes the cascade idempotent and loop-free.

## 2. Option filtering (all lists contain only active/at-work records)

| Combobox | Base set | Additional filters |
|---|---|---|
| Patient | active patients | none |
| Specialization | active specializations | if office set → only specializations of doctors in that office; if doctor set → only the doctor's specialization; if service set → only the service's specialization |
| Doctor | doctors with status `At work` | if specialization set → same specialization; if service set → doctors whose specialization matches the service; if office set → same office; if date+slot set and availability resolved → doctors available then |
| Service | active services | if specialization set → same specialization; if doctor set → doctor's specialization; if office set → services of specializations of doctors in that office |
| Office | active offices | if specialization or service set → offices of doctors with that specialization; if doctor set → the doctor's office |

Options are computed in this fixed order: **doctor → service → specialization → office**, so a later filter can only narrow, never widen, a set that a stronger rule constrained.

## 3. Auto-fill rules

| ID | Trigger | Effect | Spec AC |
|---|---|---|---|
| A1 | `doctor` set | `specializationId = doctor.specializationId` | AC-13 |
| A2 | `doctor` set | `officeId = doctor.officeId` when the doctor's office is resolvable | AC-25 |
| A3 | `service` set | `specializationId = service.specializationId` | AC-14 |
| A4 | date + slot set, exactly one doctor in `options.doctors` | `doctorId = that doctor` | AC-20 |
| A5 | `office` set and exactly one specialization remains | no auto-fill (office is a filter, not a selector) | — |

Auto-fill always targets a field other than the one just edited, so A1/A2 cannot overwrite the user's doctor choice, and A3 cannot overwrite the user's service choice.

## 4. Clear rules (conflict resolution)

| ID | Condition after the edit | Cleared | Rationale |
|---|---|---|---|
| C1 | `specializationId` set and the selected doctor's specialization differs | doctor | doctor must belong to the chosen specialization |
| C2 | `specializationId` set and the selected service's specialization differs | service | service must belong to the chosen specialization |
| C3 | `officeId` set and the selected doctor's office differs | doctor | doctor must work in the chosen office |
| C4 | `officeId` set and no doctor of the selected specialization/service works there | specialization and/or service that cannot be satisfied in that office | prevent an impossible combination |
| C5 | `serviceId` set and the selected doctor's specialization differs from the service's | doctor (unless the edit was the service's own A3 auto-fill) | doctor cannot perform the service |
| C6 | `doctorId` cleared while a slot is selected | time slot | availability belongs to a doctor |
| C7 | `date` cleared | time slot | a slot has no meaning without a date |
| C8 | `specializationId` or `serviceId` cleared | date and time slot | AC-12 |
| C9 | date + slot set and the selected doctor is not available | doctor | AC-19 |
| C10 | selected value no longer exists in its catalog (became inactive/deleted) | that value | AC-26, edge case |

Clearing cascades: clearing a doctor also clears the slot (C6) and may clear the office if A2 had filled it; clearing specialization/service clears the date and slot (C8). The reducer applies clears before auto-fills so the final state is always consistent.

## 5. Precedence examples

| Sequence | Result |
|---|---|
| Select doctor | specialization + office auto-fill; services narrow to that specialization; conflicting service is cleared (C5) |
| Then change office to a different one | doctor is cleared (C3); specialization/service remain only if a doctor of that specialization works in the new office, otherwise cleared (C4) |
| Select service | specialization auto-fills (A3); a doctor of a different specialization is cleared (C5); offices narrow |
| Select specialization after a doctor | if the doctor matches, both stay; otherwise doctor is cleared (C1) |
| Select date then slot, four doctors available | nothing auto-fills; doctor list shows four |
| Select date then slot, one doctor available | doctor auto-fills (A4), office auto-fills from that doctor (A2) |
| Clear service | date and slot clear; doctor stays if specialization is still set and consistent |

## 6. Slot and availability strategy

1. `date` is enabled only when specialization and service are set.
2. On date selection with a doctor: request `available-time-slots(doctorId, serviceId, date)`.
3. On date selection without a doctor: probe every candidate doctor after all other filters, take the **union** of returned times, and cache per `doctorId|serviceId|date`. The union is displayed; selecting a time narrows doctors to those whose probe contained it.
4. On slot selection: `availableDoctors` = ids whose cached slots contain the time. If the selected doctor is absent → C9.
5. On modal open, catalogs load in parallel. Slot requests are debounced (250 ms) and cancelled when inputs change; results are cached for 30 seconds so revisiting the same date does not re-query.
6. Slot labels are the server's `HH:mm` strings; the row's end time comes from the list DTO, never from client-side arithmetic (P-4).

## 7. Required-value completeness

`isComplete === true` only when:

- every `*Id` is non-empty;
- every selected id exists in the corresponding `options` set;
- `specializationId` equals both the selected doctor's and the selected service's specialization;
- `officeId` equals the selected doctor's office (when the doctor's office is resolvable);
- `date` and `timeSlot` are set and the slot is in the current slot list;
- no write is pending (`autoFill`/`clear` empty).

`Confirm` is enabled = `form.valid && cascade.isComplete && !isSubmitting`.

## 8. Test matrix (Vitest, pure functions)

| Case | Expected |
|---|---|
| Doctor with office selected first | specialization + office filled, doctor preserved |
| Doctor without resolvable office | specialization filled, office stays empty, form incomplete |
| Office incompatible with selected doctor | doctor cleared |
| Service of another specialization | doctor cleared, specialization follows the service |
| Clearing specialization | date + slot cleared, date disabled |
| One available doctor | auto-filled, office follows |
| Zero available doctors | doctor cleared, slot kept, form incomplete |
| Same input twice (idempotence) | zero writes |
| Catalog record deactivated | selection cleared, form incomplete |
| Every option list | contains only active/at-work records |
