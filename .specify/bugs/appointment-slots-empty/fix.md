# Bug Fix: Appointment slots are always empty

- **Slug**: appointment-slots-empty
- **Fixed**: 2026-11-16
- **Assessment**: ./assessment.md
- **Status**: partial

## Summary

Applied the frontend mitigation from the assessment: the appointment form now
cross-checks the selected service against the Appointments API scheduling catalog and
shows a specific diagnostic instead of a misleading "no slots for this date" message
when the service is not schedulable. Slot loading now has a separate retryable error
state, and per-doctor probe failures are isolated. The functional fix — repopulating
the Appointments API `Services` table and aligning the `InnoClinic.Contracts`
versions — lives in the backend workspace and was not applied here, so slots remain
empty until that sync is restored.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `AdminApp/src/app/features/appointments/models/appointment-catalog.model.ts` | modified | Added `schedulableServiceIds: ReadonlySet<string> \| null` to `AppointmentCatalogs`; `null` means the check could not be performed. |
| `AdminApp/src/app/features/appointments/services/appointment-catalog.service.ts` | modified | Reads the generated Appointments API `ServicesService.servicesGet()` catalog in the same `forkJoin` as the other catalogs; exposes the id set; degrades a failed request to `null`. |
| `AdminApp/src/app/features/appointments/services/appointment-availability.service.ts` | modified | Added `getSlotsForCandidates()` with per-doctor `catchError`, deduplication and `SlotLoadError` when every probe fails; `getDoctorAvailability()` now treats a failed probe as "not available" instead of failing the whole set. Added exported `SLOT_LOAD_ERROR_MESSAGE`. |
| `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts` | modified | Added `serviceSchedulable` computed, `slotsLoadError` signal and `retrySlots()`; slot queries are skipped for unschedulable services; slot-query failures stay inside the stream so the retry works. |
| `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.html` | modified | Added the "selected service is not available for scheduling" state and the retryable "Could not load time slots." state with a **Try again** button. |
| `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.spec.ts` | modified | Added `getSlotsForCandidates` to the mock and three regression tests. |
| `AdminApp/src/app/features/appointments/services/appointment-cascade.spec.ts` | modified | Added the new catalog field to the fixture. |
| `AdminApp/src/app/features/appointments/services/appointment-availability.service.spec.ts` | added | Envelope parsing, caching, no cache on failure, candidate merge and error isolation. |
| `AdminApp/src/app/features/appointments/services/appointment-catalog.service.spec.ts` | added | Scheduling catalog matching, empty catalog, degraded `null` on request failure. |

## Diff Highlights

Slot-query pipeline — failures no longer tear down the subscription, so **Try again**
can re-issue the last query:

```ts
switchMap((query) =>
  this.loadSlots(query).pipe(
    map((slots): SlotLoadResult => ({ ok: true, slots })),
    catchError((error: unknown) => of<SlotLoadResult>({ ok: false, error }))
  )
)
```

Per-doctor isolation, with an error only when every probe failed:

```ts
forkJoin(
  doctorIds.map((doctorId) =>
    this.getSlots(doctorId, serviceId, date).pipe(
      map((slots): SlotProbeResult => ({ ok: true, slots })),
      catchError(() => of<SlotProbeResult>({ ok: false, slots: [] }))
    )
  )
).pipe(
  map((results) => {
    const succeeded = results.filter((result) => result.ok);
    if (succeeded.length === 0) throw new SlotLoadError();
    /* merge + sort */
  })
);
```

Scheduling cross-check (template):

```html
} @else if (!serviceSchedulable()) {
  <p role="alert">
    The selected service is not available for scheduling. Please contact an administrator.
  </p>
} @else if (isLoadingSlots()) { … }
} @else if (slotsLoadError(); as loadError) {
  … {{ loadError }} … <button (click)="retrySlots()">Try again</button>
}
```

## Tests Added or Updated

- `AdminApp/src/app/features/appointments/services/appointment-availability.service.spec.ts`
  - `requests the slots for the doctor, the service and the date` — pins the query payload.
  - `treats an empty data array as no free slots` — empty `data` is not an error.
  - `reuses a cached successful result` — 30 s cache behaviour.
  - `does not cache a failed request` — failure is retried on the next call.
  - `merges the candidate slots and removes duplicates` — candidate aggregation.
  - `keeps the slots of healthy candidates when one probe fails` — per-doctor isolation.
  - `propagates an error only when every candidate probe failed` — `SlotLoadError`.
  - `does not let one failed probe hide the doctors of the healthy probes` — availability isolation.
- `AdminApp/src/app/features/appointments/services/appointment-catalog.service.spec.ts`
  - `marks the services present in the Appointments API catalog as schedulable`.
  - `reports an empty scheduling catalog while keeping the Services API options visible`.
  - `degrades to an unknown scheduling catalog when the request fails`.
- `AdminApp/src/app/features/appointments/components/appointment-create-modal/appointment-create-modal.component.spec.ts`
  - `queries the schedule with the selected service id` — the scheduling id is what reaches the schedule endpoint.
  - `explains that the selected service cannot be scheduled instead of claiming an empty date`.
  - `shows a retryable error instead of an empty date when the slot request fails` — error state, no misleading empty message, retry recovers.

## Local Verification

- Commands run: `npm test -- --watch=false` → 32 files, 244/244 passing (was 230/230).
- Commands run: `npm run build` → success, `dist/AdminApp` emitted.
- Manual checks: none performed against the running Gateway. The live `GET
  /appointments/Services` still returns `data: []`, so the UI is expected to show the
  new service-not-schedulable diagnostic until the backend table is repopulated.

## Deviations from Assessment

- **Unsynced services stay in the dropdown instead of being excluded.** The assessment
  suggested excluding unavailable services and showing an explicit error. Excluding
  them would have produced a service list that silently lacks entries (or is empty when
  the scheduling catalog is empty) with no explanation. Instead the Services API list is
  kept intact and `schedulableServiceIds` is used to block the slot query and show
  `The selected service is not available for scheduling. Please contact an administrator.`
  This also makes the current backend state self-explanatory.
- **A failed scheduling-catalog request degrades to `null`** (check skipped) instead of
  failing the whole catalog load. Blocking the entire appointment form on a diagnostic
  endpoint would be a regression; the form then falls back to the previous behaviour and
  surfaces the load error if the schedule request itself fails.
- **Per-doctor isolation moved into `AppointmentAvailabilityService.getSlotsForCandidates()`**
  rather than staying in the component. While doing this, a latent bug was found and
  fixed: a slot-query error escaped `switchMap`, terminating the `slotQuery`
  subscription, so no later query (date change or retry) would ever run.
- **Backend remediation not applied.** The Appointments API `Services` table backfill,
  the `InnoClinic.Contracts` version alignment and the backend integration test are
  outside this workspace and remain with the backend owner.

## Follow-ups

- Backend: re-publish `IServiceCreatedEvent` or run a one-off backfill so
  `GET /appointments/Services` returns the ServicesAPI ids; align ServicesAPI to
  `InnoClinic.Contracts` 1.1.1; verify the consumer queue exists before publishing.
- Once slots return, re-check `GET /appointments/Schedule/available-time-slots` for a
  real service/date and verify the grid renders.
- Consider returning a distinguishable error (instead of `200 []`) from the schedule
  endpoint for an unknown service, so future diagnosis does not require reading the
  frontend.
- Manual quickstart checks T030/T043/T047/T053 remain open; they are only meaningful
  after the service sync is restored.
