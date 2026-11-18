# Bug Assessment: Appointment slots are always empty

- **Slug**: appointment-slots-empty
- **Created**: 2026-11-16
- **Source**: pasted text (no URL)
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> No available time slots for the selected date. Выдает это сообщение на любую дату

Condensed: in the appointment creation modal, choosing any date leaves the time-slot
grid empty and shows `No available time slots for the selected date.`, so an appointment
cannot be created.

## Symptom

After a specialization, a service and a date are selected, the modal renders the
empty-slots message for every date instead of the server's `HH:mm` slots. Expected: the
free slots returned by `GET /appointments/Schedule/available-time-slots` are shown.

## Reproduction

1. Sign in to `AdminApp` as a Receptionist and open `/appointments`.
2. Click **Create an appointment**, wait for the catalogs, then choose a specialization
   and one of its services.
3. Pick any date (today or a future date) in the **Date** field.
4. Observe `No available time slots for the selected date.` for every date.

Backend evidence collected from the running local Gateway (`http://localhost:5137`):

| Request | Result |
|---|---|
| `GET /appointments/Services` | `200 {"data":[],"isSuccess":true,"message":null,"errors":[]}` |
| `GET /appointments/Offices` | `200` with one office |
| `GET /appointments/Doctors` | `200` with several doctors |
| `GET /appointments/Schedule/available-time-slots?doctorId=897468a8-5c72-4f87-ab3c-bd538b95a529&serviceId=22222222-2222-2222-2222-222222222222&date=2026-11-20` | `200 {"data":[],...}` |
| same request with `date=2026-11-21` | `200 {"data":[],...}` |
| same request with `date=2026-12-01` | `200 {"data":[],...}` |

The three dates all return `200` with an empty `data` array, which also rules out a
date-format/HTTP failure: the `yyyy-MM-dd` value the frontend sends is accepted.

`[NEEDS CLARIFICATION: Was this reproduced against the same Gateway the AdminApp uses (http://localhost:5137)? The probes above were run against that Gateway.]`

## Suspected Code Paths

Frontend:

- `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.html:201-204` — renders `No available time slots for the selected date.` whenever `slots().length === 0`.
- `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts:151-182` — the single effect that turns `slotsEnabled` into a `SlotQuery`.
- `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts:341-365` — `loadSlots()` probes every candidate doctor with `forkJoin`.
- `AdminApp/src/app/features/appointments/services/appointment-availability.service.ts:32-55` — calls the generated `ScheduleService.scheduleAvailableTimeSlotsGet({ doctorId, serviceId, date })` and reads the envelope.
- `AdminApp/src/app/features/appointments/services/appointment-catalog.service.ts:251-281` — service ids come from the Services API (`/Specialization/{id}` details), not from the Appointments API.

Backend:

- `Backend/AppointmentsAPI/AppointmentsAPI.Presentation/Controllers/ScheduleController.cs:17-28` — returns `200` with `formattedSlots`; an unknown service produces an empty list.
- `Backend/AppointmentsAPI/AppontmentsAPI.Application/Services/Schedules/ScheduleService.cs:35-36` — `if (service == null) return Enumerable.Empty<TimeSpan>();` — the service must exist in the AppointmentsAPI database or no slot is generated, regardless of date.
- `Backend/AppointmentsAPI/AppointmentsAPI.Presentation/Controllers/ServicesController.cs:19-28` — reads the locally synchronized `Services` table; observed empty.
- `Backend/AppointmentsAPI/AppointmentsAPI.Infrastructure/Consumers/Services/ServiceCreatedConsumer.cs:19-30` and `ServiceSyncService.cs:17-30` — the only path that inserts services into the AppointmentsAPI database.
- `Backend/ServicesAPI/Services.Application/Handlers/CreateServiceHandler.cs:47-55` — publishes `IServiceCreatedEvent` when a service is created.
- `Backend/AppointmentsAPI/AppointmentsAPI.Infrastructure/AppointmentsAPI.Infrastructure.csproj` (Contracts `1.1.1`) vs `Backend/ServicesAPI/Services.Application/Services.Application.csproj` (Contracts `1.0.0`) — mismatched shared-contract versions on the producer/consumer pair.

## Root Cause Hypothesis

**High confidence** for the immediate cause: the AppointmentsAPI's synchronized `Services`
table is empty. `ScheduleService.GetAvailableTimeSlotsAsync` resolves the requested
`serviceId` against that table first and returns an empty list when the row is missing, so
every service/date combination yields `data: []`; the frontend then correctly renders its
empty-state message. The live probes confirm the table is empty (`/appointments/Services`
returns `[]`) while doctors and offices are present.

**Medium confidence** for why the sync failed: the service-created events never reached
the AppointmentsAPI consumer (e.g. the consumer queue was created after the services were
published, or a broker/contract mismatch dropped them). The contract-version mismatch
(`InnoClinic.Contracts` 1.0.0 in ServicesAPI vs 1.1.1 in AppointmentsAPI) is a corroborating
risk: ProfilesAPI (doctors) uses 1.1.1 and is synchronized, while ServicesAPI (services)
is the only producer still on 1.0.0. A version difference alone does not prove a URN
mismatch, but it makes the services event the most likely one to be undelivered.

## Proposed Remediation

**Preferred (data/backend — required to restore slots)**: re-populate the AppointmentsAPI
`Services` table from the ServicesAPI source of truth, preserving the same GUIDs. Either
re-publish `IServiceCreatedEvent` for the existing services, add a one-off backfill
(HTTP pull from the ServicesAPI or a startup sync), or re-create the services through the
ServicesAPI after the AppointmentsAPI consumer is running. Align the shared-contract
package versions (ServicesAPI to `InnoClinic.Contracts` 1.1.1) and verify the consumer
queue is bound before services are created. Success criteria:
`GET /appointments/Services` returns the same ids as the ServicesAPI catalog and
`GET /appointments/Schedule/available-time-slots` returns non-empty `data`.

This fix lives outside the AdminApp workspace and must be applied by the backend/owner of
the AppointmentsAPI.

**Frontend mitigation (this workspace)**: make the failure diagnosable and avoid a
misleading message:

- Cross-check the selected service against the AppointmentsAPI scheduling catalog
  (`ServicesService.servicesGet()` from the generated appointments client) and use the
  scheduling id for `ServiceOption`. If the service is missing there, show
  `The selected service is not available for scheduling. Please contact an administrator.`
  instead of `No available time slots for the selected date.`
- Track `slotsError` separately from an empty result; show a retryable
  `Could not load time slots.` state when the request fails or the response fails the
  envelope guard, rather than claiming the date has no slots.
- In `AppointmentAvailabilityService`, isolate per-doctor probe failures with
  `catchError(() => of([]))` (or an explicit failure marker) so one bad candidate does not
  erase slots for every other candidate; propagate an error only when all probes fail.
- Do not cache failed/empty-because-of-error results.

**Alternatives**:
- Temporarily seed the AppointmentsAPI `Services` table with the ServicesAPI rows for
  local/demo environments; fast, but it masks the sync defect and must not be the only fix.
- Resolve the service from the ServicesAPI inside `ScheduleService` when the local row is
  missing; restores slots but adds a synchronous cross-service dependency and duplicates
  the sync responsibility.

**Files likely to change**:
- `AdminApp/src/app/features/appointments/services/appointment-catalog.service.ts`
- `AdminApp/src/app/features/appointments/services/appointment-availability.service.ts`
- `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts`
- `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.html`
- Backend: `Backend/AppointmentsAPI/**` and `Backend/ServicesAPI/**` (sync/backfill, contract version)

**Tests to add or update**:
- New `appointment-availability.service.spec.ts`: envelope parsing, per-doctor error
  isolation, no cache on error, empty `data` handled as an empty list.
- `appointment-create-modal.component.spec.ts`: empty state vs error state, retry action,
  and the query payload (`serviceId` must be the scheduling catalog id).
- `appointment-catalog.service.spec.ts` (new or extended): services are matched to the
  AppointmentsAPI catalog and unavailable services are excluded with an explicit error.
- Backend integration test: `GET /Schedule/available-time-slots` with a service that is
  absent from the AppointmentsAPI table returns a distinguishable failure (or is
  prevented by a backfill), and with a synchronized service returns the expected slots.

## Risks & Considerations

- Matching ServicesAPI services to AppointmentsAPI services by name is fragile (renames,
  duplicates, localization). Prefer id equality after a proper sync.
- Switching the service id source to the AppointmentsAPI `/Services` endpoint temporarily
  hides services that have not been synchronized, so the modal may show fewer options
  until the backfill completes.
- Changing `ServiceOption.id` semantics affects the cascade, create payload and the
  `serviceId` sent to `available-time-slots`; all three must stay consistent.
- Bumping the shared contract package can change MassTransit message URNs/payloads and
  requires coordinated redeploys; test the consumer binding explicitly.
- The slot endpoint currently returns `200 []` for an unknown service; a distinguishable
  error code/message would make future diagnosis much faster.
- No client-side slot arithmetic may be introduced (P-4); slots must remain
  server-provided.

## Open Questions

- `[NEEDS CLARIFICATION: Are the clinic services created through the ServicesAPI UI, or inserted/seeded directly into its database?]`
- `[NEEDS CLARIFICATION: Was the AppointmentsAPI started before or after the services were created (i.e. could the ServiceCreated events have been published before the consumer queue existed)?]`
- `[NEEDS CLARIFICATION: Should the appointments `/Services` catalog become the authoritative source for scheduling ids, or is the ServicesAPI id contract guaranteed by the sync?]`
