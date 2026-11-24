# Contract: Receptionists Directory (Bug 3)

UI contract between `ReceptionistDirectoryStore` (smart state), the generated
`ReceptionistsService`, and the dumb `ReceptionistTableComponent`.

## C1. List request

```http
GET {apiUrl}/profiles/Receptionists?page={page}&pageSize=100   (via generated client)
Authorization: Bearer <session token>
```

| Rule | Requirement |
|------|-------------|
| CR1-1 | Only the generated `receptionistsGet` is used |
| CR1-2 | Pages fetched sequentially until `collected.length >= totalCount` or `MAX_PAGES` |
| CR1-3 | Guard `MAX_PAGES` (50) to bound the loop |

## C2. Response validation (per page)

Response envelope: `{ isSuccess, message, errors, data: { data[], totalCount } }`.

| Rule | Requirement |
|------|-------------|
| CR2-1 | Evaluated with `readApiEnvelope(payload, isPagedReceptionistRows)` **per page** |
| CR2-2 | `isReceptionistProfile` accepts `officeAddress` as `string \| null` |
| CR2-3 | `middleName` / `photoPath` optional → normalized to `string \| null` |
| CR2-4 | `totalCount` finite number ≥ 0 |
| CR2-5 | A contract failure on page *N* retains pages `1..N-1` and sets a **specific** error |

## C3. Error states (table)

| State | Condition | Rendering |
|-------|-----------|-----------|
| Loading | `isLoading()` | "Loading receptionists…" |
| Error | `loadError() !== null` | error message + "Try again" |
| Empty | `rows().length === 0` **and** no error | "No receptionists found" |
| Data | `rows().length > 0` | table with `@for (... track row.id)` |

| Rule | Requirement |
|------|-------------|
| CR3-1 | Contract mismatch **never** renders the "No receptionists found" empty state |
| CR3-2 | `@for` includes `@empty` as a defensive fallback |

## C4. Row rendering

| Rule | Requirement |
|------|-------------|
| CR4-1 | `displayOffice(value: string \| null)` → `officeLabel` returns `'—'` for `null`/empty |
| CR4-2 | `fullName` uses existing `fullName(profile)` util; no undefined interpolation |
| CR4-3 | `photoPath === null` skips photo delete (existing behavior) |

## C5. Routing & authorization

| Rule | Requirement |
|------|-------------|
| CR5-1 | Routes `receptionists` and `receptionists/:id/profile` unchanged (order is not the defect) |
| CR5-2 | `roleGuard('Receptionist')` remains side-effect free (returns `UrlTree`) |
| CR5-3 | Access denial surfaces a user-visible notification/one-time warn — no silent bounce |
| CR5-4 | Unauthenticated → `/sign-in`; authenticated without role → `/` |

## Test obligations

- Page 2 contract mismatch keeps page 1 rows and shows an error (not "No receptionists found").
- `officeAddress: null` renders `—`.
- Missing `Receptionist` role → redirect to `/` + notification emitted.
