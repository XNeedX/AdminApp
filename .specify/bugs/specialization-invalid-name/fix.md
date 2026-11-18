# Bug Fix: Specialization combobox reports "Invalid specialization name" for names that exist in ServicesAPI

- **Slug**: specialization-invalid-name
- **Fixed**: 2026-11-11T14:55:00+03:00
- **Assessment**: ./assessment.md (not present — see Deviations)
- **Status**: applied

## Summary

The doctor form always showed `Invalid specialization name` because
`SpecializationService` read the wrong part of the Services API response. The live Gateway
returns a nested envelope (`{ data: { items: [...] }, isSuccess: true }`), while the client
only looked at `res.items` / `res.value.items`, so the combobox was always empty and no typed
name could ever match an option.

## Root Cause

Live response from the Gateway (with a valid bearer token):

```http
GET http://localhost:5137/services/specialization?Page=1&PageSize=50
```

```json
{
  "data": {
    "items": [
      { "id": "886d110b-…", "name": "string", "status": 0 },
      { "id": "591ea647-…", "name": "Hirurg", "status": 0 }
    ],
    "totalCount": 4
  },
  "isSuccess": true,
  "message": null,
  "errors": []
}
```

Old mapping (`res?.items || res?.value?.items || []`) matched neither path, so
`specializations()` was `[]`. `DoctorCreateComponent.onSpecializationInput` sets
`specializationId` only when the typed text exactly matches a loaded option; with no options,
`specializationId` stayed `''`, the control became invalid, and the template rendered
`Invalid specialization name` (doctor-create.component.html:197).

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/app/api/specialization.service.ts` | modified | Reads `data.items` (plus flat / `value.items` envelopes), filters malformed entries, keeps the offline fallback for request failure only |
| `src/app/api/specialization.service.spec.ts` | added tests | Pins the live envelope and the fallback behaviour |

## Diff Highlights

```ts
// specialization.service.ts
getSpecializations(page = 1, pageSize = 50): Observable<Specialization[]> {
  return this.http
    .get<unknown>(`${this.baseUrl}/services/specialization?Page=${page}&PageSize=${pageSize}`)
    .pipe(
      map((payload) => extractSpecializations(payload)),
      catchError(() => of([...FALLBACK_SPECIALIZATIONS]))
    );
}

// accepts { data: { items } }, { items }, { value: { items } }
const candidates: unknown[] = [data?.['items'], root['items'], value?.['items'], root['data'], root['value']];
const items = candidates.find((candidate): candidate is unknown[] => Array.isArray(candidate));
```

The successful response is no longer passed through the hard-coded fallback list: an empty
`items` array stays empty, so invented names never appear in the dropdown.

## Tests Added or Updated

- `src/app/api/specialization.service.spec.ts::reads the live Services API envelope { data: { items } }` — the exact Gateway shape from the bug report.
- `src/app/api/specialization.service.spec.ts::also accepts flat and value-wrapped envelopes` — guards against serializer drift.
- `src/app/api/specialization.service.spec.ts::drops malformed entries instead of poisoning the combobox` — id/name validation.
- `src/app/api/specialization.service.spec.ts::returns an empty list when the API reports no specializations` — no fallback leakage on success.
- `src/app/api/specialization.service.spec.ts::falls back to local data only when the request fails` — preserves the existing offline behaviour.

## Local Verification

- Commands run: `npx ng test --watch=false` → **15 test files, 94 tests passed**.
- Manual checks: `GET /services/specialization?Page=1&PageSize=50` through the Gateway returns the four stored specializations (including `Hirurg`) inside `data.items`; after the mapping change those are the entries offered by the combobox.

## Deviations from Assessment

- **No `assessment.md` exists** for any bug slug. As in the two previous fixes in this
  session, the user's established preference is to proceed with the verified diagnosis as the
  contract, so that was done and recorded here.
- **Scope assumption:** the response envelope was verified only for Specialization. The same
  wrapper (`data.items`) is very likely used by Offices, whose `OfficeService` has the same
  `res?.items || res?.value?.items` bug; it was **not** changed because the Offices API
  currently returns 503 (unreachable MongoDB), so the response could not be verified.
- The file contains hand-written request code, which is a documented exception in the project
  (no generated Services client is wired into AdminApp). The rewrite keeps that exception but
  removes the previous `any` usage in this service.

## Follow-ups

- Regenerate and use the generated Services API client (per the project rule) instead of the
  hand-written `SpecializationService`; then delete `extractItems`/`toSpecialization`.
- Apply the same envelope fix to `src/app/api/office.service.ts` once the Offices API is
  reachable again.
- Some seeded specializations are literally named `string` (Swagger defaults); clean up the
  test data in ServicesAPI so the dropdown is meaningful.
- Consider allowing free-text specialization names (trim + exact-match check against the
  loaded list) if the backend is expected to accept names that are not yet created.
