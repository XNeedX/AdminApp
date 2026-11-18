# Bug Fix: Repeated console errors for not-yet-implemented Profiles endpoints

- **Slug**: missing-endpoints-noise
- **Fixed**: 2026-11-11T14:43:19+03:00
- **Assessment**: ./assessment.md (not present — see Deviations)
- **Status**: applied

## Summary

After the previous fix removed the 401/403 failures, the sign-in flow still logged a red
`[API Error 404]` for `/profiles/accounts/exists` and `/profiles/receptionists/account/{id}`
on every blur/sign-in. Both endpoints are documented as **not implemented**, so the app
fails open by design; it was re-probing them forever and the shared interceptor logged every
failure twice (generic error + the service's own warning). The app now probes each endpoint
at most once per app lifetime and the generic error logger skips requests whose failure the
caller already handles.

## Root Cause

`specs/003-sign-in-out/contracts/profiles-sign-in.contract.md` §0/§6 declares
`GET /profiles/accounts/exists` and `GET /profiles/{type}/account/{accountId}` as
**PROPOSED — NOT IMPLEMENTED**. Verified against the running Profiles API swagger: neither
route exists, so both calls return `404`.

The implementations still issued the request on every validation/sign-in and the shared
`apiErrorInterceptor` logged all failures, producing repeated red console errors that looked
like regressions after the auth token was fixed.

The `/offices/offices?...` 503 in the same screenshot is unrelated and **not** an AdminApp
defect: the Offices API cannot reach its MongoDB. Direct call evidence:

```text
GET http://localhost:5193/api/offices?Page=1&PageSize=50  -> 500
System.TimeoutException: A timeout occurred after 29998ms selecting a server ...
Client view of cluster state is { ... State : "Disconnected", Servers : [] }
```

`Backend/Infrastructure/.env` points `OFFICES_DB_CONNECTION_STRING` at
`mongodb+srv://NeedX:…@cluster0.bdcpqax.mongodb.net/…`, and that host does not resolve from
the developer machine (DNS failure). This is environment/infrastructure configuration, outside
the AdminApp workspace, so it is documented rather than changed.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/app/core/tokens/silent-http-error.token.ts` | added | `SILENT_HTTP_ERROR` HttpContextToken: marks handled failures |
| `src/app/core/interceptors/api-error.interceptor.ts` | modified | Skips the generic `console.error` when the request is marked silent; still rethrows |
| `src/app/core/tokens/account-exists-lookup.token.ts` | modified | Latches after the first `404` (no further probes) and marks the request silent; transient `5xx` still retried |
| `src/app/core/services/auth.service.ts` | modified | `profileStatusUnavailable` latch after the first `404`; profile-status request marked silent |
| `src/app/core/interceptors/api-error.interceptor.spec.ts` | added tests | Default logging vs. silent-context behaviour |
| `src/app/core/validators/account-exists.validator.spec.ts` | updated tests | One-probe-then-stop on `404`; transient `5xx` still retried |
| `src/app/core/services/auth.service.spec.ts` | added test | Profile-status endpoint probed only once across sign-ins; request carries the silent flag |

## Diff Highlights

```ts
// core/tokens/silent-http-error.token.ts
export const SILENT_HTTP_ERROR = new HttpContextToken<boolean>(() => false);

// core/interceptors/api-error.interceptor.ts
catchError((error: HttpErrorResponse) => {
  if (!req.context.get(SILENT_HTTP_ERROR)) {
    console.error(`[API Error ${error.status}]:`, extractErrorMessage(error));
  }
  return throwError(() => error);
})

// core/tokens/account-exists-lookup.token.ts
if (missing) return of(null);                    // 404 latched: answer locally
if (error instanceof HttpErrorResponse && error.status === 404) missing = true;

// core/services/auth.service.ts
if (this.profileStatusUnavailable) return of(true);   // fail-open, no request
if (error instanceof HttpErrorResponse && error.status === 404) {
  this.profileStatusUnavailable = true;
}
```

## Tests Added or Updated

- `src/app/core/interceptors/api-error.interceptor.spec.ts::logs a handled failure once by default`
- `src/app/core/interceptors/api-error.interceptor.spec.ts::stays silent for requests marked SILENT_HTTP_ERROR`
- `src/app/core/validators/account-exists.validator.spec.ts::probes the endpoint once and stops after a 404`
- `src/app/core/validators/account-exists.validator.spec.ts::does not disable the endpoint on a transient failure`
- `src/app/core/services/auth.service.spec.ts::probes the missing profile status endpoint only once across sign-ins`
- `src/app/core/services/auth.service.spec.ts::fails open while the profile status endpoint is missing` (extended with the silent-context assertion)

## Local Verification

- Commands run: `npx ng test --watch=false` → **14 test files, 89 tests passed**.
- Manual checks against the running stack:
  - `POST /realms/InnoClinic/protocol/openid-connect/token` with `testreceptionist` → `200` (previous fix still holds).
  - `GET /profiles/receptionists/account/{sub}` → `404` (expected, now probed once).
  - `GET /profiles/accounts/exists?email=…` → `404` (expected, now probed once).
  - `GET /offices/offices?Page=1&PageSize=50` → `503`; direct `GET http://localhost:5193/api/offices…` → `500` with a MongoDB `TimeoutException`. Root cause: unreachable Mongo host (see above).

## Deviations from Assessment

- **No `assessment.md` exists** for any bug slug. The user was shown the verified findings and
  explicitly approved using the diagnosis as the contract.
- **`/offices` 503 was not code-fixed.** It originates in `OfficesAPI`/infrastructure: the
  configured MongoDB host does not resolve. Fixing it requires changing
  `Backend/Infrastructure/.env` (outside the workspace) or restoring the Atlas cluster; the
  AdminApp already falls back to local office data.
- **New context token introduced** (`SILENT_HTTP_ERROR`) — not named in the spec contract, but
  it is the minimal way to stop the shared logger from duplicating intentionally-handled
  failures. No new dependency.
- **Latching on `404` is a behavior change** not spelled out in the contract. It matches §6
  ("rule disabled" until the endpoints exist) and keeps fail-open; it is reset on page reload.

## Follow-ups

- Implement the Profiles endpoints from `profiles-sign-in.contract.md` (or `/profiles/me`).
  When they land, remove the `profileStatusUnavailable` / `missing` latches and the
  `SILENT_HTTP_ERROR` markers on those two calls, then enforce AC-4/AC-5.
- Fix the Offices data layer: either restore/resolve the Atlas cluster
  (`cluster0.bdcpqax.mongodb.net`) or run a local MongoDB and update
  `OFFICES_DB_CONNECTION_STRING`; verify `GET /offices/offices` returns `200`.
- The Offices API takes ~30 s to time out; the Gateway's 5 s QoS turns that into a fast `503`.
  Consider a shorter Mongo `serverSelectionTimeoutMS` in the Offices service.
- Keep the `[API Error …]` logger for genuine failures; only mark requests silent when the
  caller has a documented fallback.
