# Contract: Patient Search (Bug 2) — BLOCKED

## Status: NOT IMPLEMENTABLE UNTIL REGENERATION

The generated client currently exposes:

```ts
// api/generated/profiles/fn/patients/patients-get.ts
export interface PatientsGet$Params {}                                   // no query params
export function patientsGet(...): Observable<StrictHttpResponse<void>>   // no body
```

This cannot search. It was generated from a **hand-edited** OpenAPI entry:

```json
"/Patients": { "get": { "tags": ["Patients"], "responses": { "200": { "description": "OK" } } } }
```

**Decision (constitution §II)**: stop and request regeneration from the real Profiles
`swagger.json`.

> Необходимо обновить сгенерированный API-клиент из актуального swagger.json микросервиса

## Required backend capability (to unblock)

The Profiles `PatientsController` must expose a read/search endpoint, reflected in Swagger:

```http
GET /Patients?search={term}&page={page}&pageSize={n}
```

| Element | Requirement |
|---------|-------------|
| Query param | name/term filter (exact name TBD from backend) |
| Paging | `page`, `pageSize` (or `Page`, `PageSize` — match existing conventions) |
| Response | `ApiResponseOfPagedResultOfPatientProfileDto` (or equivalent) with `data.items[]`, `data.totalCount` |
| Item fields (min) | `id`, `fullName` **or** `firstName`/`lastName` |
| Auth | Gateway bearer token (existing interceptor) |

Once present: `npm run api:profiles` regenerates `api/generated/profiles/**`.

## Target frontend contract (implement only after regeneration)

### Input
`patientText` `FormControl<string>` value changes.

### Pipeline

```text
valueChanges
  ├─ debounceTime(300)
  ├─ map(v => v.trim())
  ├─ distinctUntilChanged()
  ├─ switchMap(term =>
  │     term.length === 0 ? of(idle)
  │   : generatedSearch({ search: term, page: 1, pageSize: 20 }).pipe(
  │        map(guardPagedPatients),
  │        map(r => ({ state: 'ok', items: r.items })),
  │        catchError(e => of({ state: 'error', message: toErrorMessage(e) })),
  │        startWith({ state: 'loading', items: [] })
  │     ))
  └─ toSignal({ initialValue: idle })   // auto-unsubscribed on destroy
```

| Rule | Requirement |
|------|-------------|
| AP-1 | Uses only the **regenerated** service method — no `HttpClient`, no hand-written DTO |
| AP-2 | `debounceTime(300)` + `distinctUntilChanged()` + `switchMap` (stale cancel) |
| AP-3 | Exposed via `toSignal()` (preferred) or `takeUntilDestroyed(this.destroyRef)` |
| AP-4 | Errors are surfaced (toast/inline), **not** converted to `[]` |
| AP-5 | Result validated by a real type guard — no `any` |
| AP-6 | Combobox renders loading / error / empty (`@empty`) states |
| AP-7 | Selection stores `patientId`; `patientText` mirrors `fullName` |
| AP-8 | `AppointmentCatalogService.load()` no longer eager-fetches all patients |

### Type guard obligation

```ts
function isPagedPatientRows(value: unknown): value is { items: readonly PatientOption[]; totalCount: number }
```
Must check `id`/`fullName` as non-empty strings and `totalCount` finite.

## Interim behavior (while blocked)

Until regeneration:
- Do **not** ship the phantom `/Patients` call as a search.
- The patient combobox should show the existing `patientUnavailable` diagnostic; no fake data.
- Revert the hand-edited OpenAPI/`patients-get.ts` artifacts together with the Bug 2 unblock.
