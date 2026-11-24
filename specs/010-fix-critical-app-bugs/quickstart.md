# Quickstart: Verify Bugfix Iteration 1

Runnable validation guide. Implementation details live in `tasks.md`; rules in `plan.md`
and `contracts/`.

## Prerequisites

- Node 20+, npm 11 (`packageManager: npm@11.6.0`)
- AdminApp running: `cd Frontend/AdminApp/AdminApp && npm start` → `http://localhost:4200`
- Gateway: `http://localhost:5137`; Keycloak: `http://localhost:8080`, realm `InnoClinic`
- Keycloak prerequisites (external, see `.specify/bugs/sign-in-unauthorized-client/fix.md`):
  - client `public-client` has `directAccessGrantsEnabled=true`
  - test user has no pending required actions (e.g. `UPDATE_PASSWORD`)
- A user with the `Receptionist` realm role.

## Build & test gate

```bash
cd Frontend/AdminApp/AdminApp
npx tsc --noEmit
npx ng build --configuration development
npx ng test --watch=false
```

Expected: type-check clean (no `any` added), build success, all specs green.

## Bug 1 — Sign-in

1. Open `http://localhost:4200/sign-in`.
2. DevTools → Network → filter `token`. Submit valid credentials.
3. **Pass criteria**:
   - `POST /realms/InnoClinic/protocol/openid-connect/token` → **200**
   - Request has **no** `Authorization` header (contract AC1-4)
   - Body includes `username=<email>` (not `email=`/`userName=`)
   - Profile probe (`/profiles/{doctors|receptionists}/account/...`) either 200 or 404 —
     **no** redirect flash to `/sign-in` after a successful token (contract AC3-2/AC3-5)
   - App lands on `/` with header visible and the role nav.
4. Wrong password → single inline "invalid credentials" message; no redirect loop.
5. Negative: temporarily set `directAccessGrantsEnabled=false` → inline "temporarily/invalid"
   message only, no `Account is not fully set up` leaked to UI.

## Bug 2 — Patient search (blocked until regeneration)

**Do not test as a search yet.** Current `GET /Patients` returns `void`.

1. Confirm the block: `Get-Content src/app/api/generated/profiles/fn/patients/patients-get.ts`
   → `interface PatientsGet$Params {}` and `Observable<StrictHttpResponse<void>>`.
2. Request regeneration (Profiles `swagger.json` must include a patient search endpoint).
3. After regeneration, `npm run api:profiles`, then verify:
   - Type `An` in the patient field → exactly one request after 300 ms (debounce)
   - Retype `Ann` quickly → previous request cancelled (`switchMap`), one result set
   - Same term re-entered without change → no duplicate request (`distinctUntilChanged`)
   - Backend 500 → inline/toast error, **not** an empty list
   - Clear field → dropdown resets, no request
   - Select a patient → `patientId` set, text mirrors `fullName`

## Bug 3 — Receptionists tab

1. Sign in as a `Receptionist`. Click **Receptionists**.
2. **Pass criteria**:
   - Tab renders the table (or the empty state when there are truly no receptionists),
     **no** console `TypeError` / `undefined` access.
   - A receptionist with no office address shows `—` (not blank/crash).
   - Simulate a malformed page 2 response (mock/proxy) → page 1 rows remain + a specific
     error is shown; the "No receptionists found" state does **not** appear.
3. Role check: sign in with a user without `Receptionist`; navigating to `/receptionists`
   redirects to `/` **and** shows an access-denied notification (no silent bounce).
4. Open a profile via row click and via the profile icon → `/receptionists/:id/profile`.

## Cross-cutting checks

- No red `[API Error …]` spam for fail-open probes (see `missing-endpoints-noise`).
- No `.subscribe()` added without `takeUntilDestroyed`.
- `grep -rn ": any\b\|<any>" src/app/features/appointments` → no new matches (target: zero
  in touched files).

## Rollback / reversion notes

Uncommitted, hand-edited codegen artifacts (`openapi/profiles.openapi.json`,
`api/generated/profiles/**`, `patients-get.ts`) must be reverted together with the Bug 2
unblock; never commit the fabricated `/Patients` contract.
