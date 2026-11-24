# Phase 0 — Research: Bugfix Iteration 1

All findings below were verified against the **working tree** (branch `develop`, 2026-11-19)
and the **installed package types** in `Frontend/AdminApp/AdminApp/node_modules`. Items
marked **[Context7]** could not be checked against the Context7 MCP server because it is not
attached to this session (see Decision R0).

## R0. Context7 verification of Angular 21 syntax

**Decision**: Proceed using the installed `@angular/*` type declarations as the source of truth; mark Context7-dependent items for re-verification if the MCP server is attached later.

**Rationale**: The `context7` MCP tool is not registered in this session. `ToolSearch("context7 …")` returned no results. The installed packages are exactly what compiles the app, so their `.d.ts` files are authoritative for the APIs used.

**Alternatives considered**: Guessing from memory (rejected — violates "check code before giving it"); blocking the plan (rejected — unnecessary, local types suffice).

**Verified facts** (from `node_modules/@angular/core/types/rxjs-interop.d.ts` and `common/types/http.d.ts`):

| API | Verified signature / status | Plan impact |
|-----|-----------------------------|-------------|
| `toSignal` | `toSignal<T>(source: Observable<T>): Signal<T \| undefined>`; overloads take `ToSignalOptions` (`initialValue`, `requireSync`); runs in injection context; auto-unsubscribes on context destroy | Bug 2 primary path |
| `takeUntilDestroyed` | `takeUntilDestroyed<T>(destroyRef?: DestroyRef): MonoTypeOperatorFunction<T>` | Secondary path for manual subs |
| `rxResource` | Present, but **`@experimental`** (`RxResourceOptions { stream: (params) => Observable<T> }`) | Documented alternative only; not used in plan |
| `rxMethod` | **Not exported by `@angular/core`** — it is an NgRx Signals API | Must **not** be planned; the request's "rxMethod / switchMap" is resolved as plain `switchMap` |
| `HttpInterceptorFn` | `type HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => Observable<HttpEvent<unknown>>` | Existing interceptors already conform |
| `HttpContextToken` | Exported from `@angular/common/http`; `new HttpContextToken<boolean>(() => false)` | Used for `SKIP_AUTH_REDIRECT` |
| `withInterceptors` | `withInterceptors(fns: HttpInterceptorFn[]): HttpFeature` — executes in array order | Confirms Bug 1 ordering claim |

## R1. Bug 1 — Does the interceptor block/overwrite the login request?

**Decision**: No code change needed for request mutation; the defect is in the response path. Add a skip flag for the profile probe.

**Rationale**:
- `authInterceptor` (`core/interceptors/auth.interceptor.ts:11-22`) returns `next(req)` unchanged when `!isGatewayUrl(req.url)`. The Keycloak token URL is `http://localhost:8080/realms/...`, **not** under `environment.apiUrl` (Gateway), so login never receives an `Authorization` header from this interceptor.
- `apiErrorInterceptor` only logs; it does not clone or mutate requests.
- The real response-path hazard: `authErrorInterceptor` (`auth-error.interceptor.ts:19-27`) clears the session and redirects to `/sign-in` on **any** Gateway 401 — including the 401 from `AuthService.resolveProfileAccess`'s own probe, producing a mid-login bounce.

**Alternatives considered**:
- Ordering the interceptors differently to avoid the probe issue — rejected: response interceptors run inner-to-outer; a 401 will still reach `authErrorInterceptor`. A context flag is explicit and testable.
- Making `resolveProfileAccess` use a raw `HttpBackend` — rejected: bypasses error logging entirely and is harder to test.

## R2. Bug 1 — Login DTO field naming (`email` vs `userName`)

**Decision**: Keep `username` (OAuth2 password-grant standard).

**Rationale**: Keycloak's token endpoint expects form fields `grant_type`, `client_id`, `username`, `password`, `scope`. The app's `formBody({ grant_type:'password', client_id, username: email.trim(), password, scope:'openid' })` (`auth.service.ts:94-100`) is correct. `email`/`userName` are **backend** DTO concepts, not Keycloak's; no backend DTO is on the login path. The `SignInPageComponent` passes `email` into `AuthService.signIn`, which is a local variable name only.

**Alternatives considered**: Switching to `email=` — rejected, Keycloak would return `400 invalid_request`.

## R3. Bug 1 — Token response & profile status handling

**Decision**: Keep `isTokenResponse`/`parseJwtClaims` guards; change only the profile-401 handling (R1) and enrich dev diagnostics.

**Rationale**: `.specify/bugs/sign-in-unauthorized-client/fix.md` confirmed the last 400 was realm config (`directAccessGrantsEnabled=false`) + a pending `UPDATE_PASSWORD` required action — external. The app's `toFailureOutcome` already maps 400/401 → `invalid`. `resolveProfileAccess` fails open on 404/network and denies on 401/403, which is correct **except** for the redirect side-effect (R1).

## R4. Bug 2 — Is there a patient search method in the generated client?

**Decision**: **No usable one → BLOCKED.** Report contract regeneration required.

**Rationale**: `fn/patients/patients-get.ts` declares `PatientsGet$Params` with **zero** fields and returns `Observable<StrictHttpResponse<void>>` (`map(r => clone({ body: undefined }))`). It cannot accept a query nor return records. The origin is a hand-edited `openapi/profiles.openapi.json` entry (`"GET /Patients"` with no `parameters` and a bare 200 response) — i.e. the generated client reflects a fabricated contract. Constitution §II mandates stopping and requesting regeneration from the real service Swagger.

**Alternatives considered**:
- Hand-writing an `HttpClient` search against `/Patients?search=…` — **rejected**: violates §II "Zero Hand-Written API Contracts".
- Reusing `patientsAccountAccountIdGet` — rejected: it fetches a single patient by account id, not a search.
- Keep the current full-list fetch with `any` — rejected: violates §V and still cannot search.

**Unblock inputs to raise**: backend `PatientsController` must expose a search endpoint with a query parameter (e.g. name/term) and a paged patient DTO, reflected in the service `swagger.json`, then `npm run api:profiles` regenerates the client.

## R5. Bug 2 — `toSignal` vs manual subscription for the search stream

**Decision**: Build a `switchMap`-based `Observable` from `patientControl.valueChanges` (`debounceTime(300)`, `distinctUntilChanged()`, `switchMap`) and expose it via `toSignal()` with an `initialValue: []`. Use `takeUntilDestroyed` only if a manual subscription is needed inside a method.

**Rationale**:
- `toSignal` auto-unsubscribes on injection-context destroy → satisfies §III "no hanging subscriptions" with zero boilerplate.
- `switchMap` cancels the previous in-flight search (stale-response safety) — better than `mergeMap`.
- `distinctUntilChanged()` prevents duplicate requests for the same term.
- The stream can also carry a `loading` flag via `{ value, loading, error }` or `startWith`/`catchError`.

**Alternatives considered**:
- `rxResource` (experimental) — closer to "resource" semantics but `@experimental`; a stability risk for a bugfix iteration. Noted as a future option.
- Raw `.subscribe()` + `takeUntilDestroyed` — works, but more code and error handling; kept as fallback.

## R6. Bug 3 — Route configuration

**Decision**: No route reordering; the declared routes are correct.

**Rationale**: `app.routes.ts` matches `receptionists` and `receptionists/:id/profile` with the default path-matching strategy (full segment match); ordering cannot cause `receptionists/:id/profile` to be swallowed by `receptionists`. The defect lies in the guard (silent redirect) and in the store's all-or-nothing error handling.

**Alternatives considered**: Reordering the two `receptionists` routes — harmless but a non-fix; rejected to keep the change scoped.

## R7. Bug 3 — `undefined`/`null` property access and model-field mismatch

**Decision**: Isolate contract failures per page, make `officeAddress` nullable end-to-end, add `@empty` to the `@for`.

**Rationale**:
- `ReceptionistDirectoryStore.fetchAll()` (`receptionist-directory.store.ts:75-99`) has one `try` around the whole paging loop; one `readApiEnvelope` throw (raised by `api-envelope.ts:83-85` for any mismatch, e.g. `totalCount` non-numeric or an item failing `isReceptionistProfile`) aborts the loop and sets `rows([])` — the template then shows the benign "No receptionists found" state instead of an error.
- `isReceptionistProfile` (`receptionist-contract.guards.ts:31-47`) already allows `officeAddress` only as a `string`; with the backend DTO declaring `officeAddress?: string`, a missing field rejects the whole page.
- `toRow` copies `officeAddress` verbatim into a non-nullable `ReceptionistRow.officeAddress`; `displayOffice(value: string)` calls `officeLabel(value)` which assumes a string.
- The table template handles loading/error/empty states but has no `@empty` in `@for` (defensive only).

## R8. Bug 3 — Guard and auth-model interaction

**Decision**: Keep `roleGuard` returning a `UrlTree` (side-effect free) but surface access denial through `NotificationService` and a one-time `console.warn`; verify the JWT `Receptionist` role is parsed by `isAuthRole`.

**Rationale**: `roleGuard` (`role.guard.ts:18-25`) redirects to `/` when `roles` lacks the allowed role. If `AuthService.user()` yields no `Receptionist` (claim parsing/role filter causing an empty role list), the tab silently returns to `/`, indistinguishable from "broken". The guard itself is correct; making the denial visible converts a silent failure into a diagnosable one.

**Alternatives considered**:
- Guard returning a dedicated `/forbidden` route — larger UX change; out of scope for a bugfix.
- Removing the guard — rejected: authorization regression.

## R9. Testing & tooling

**Decision**: Vitest 4 (`ng test`, jsdom). Extend existing specs rather than create parallel suites. Run `npx tsc --noEmit` / `ng build` before tests.

**Rationale**: `package.json` devDependencies include `vitest ^4.0.8`; existing `*.spec.ts` files are Vitest-style. `ng-openapi-gen ^1.1.0` drives codegen; regeneration is `npm run api:profiles`.

## R10. Branch & working-tree state

**Decision**: Plan against the **current working tree**, and call out the uncommitted, hand-edited codegen artifacts for reversion.

**Rationale**: `git status` shows uncommitted modifications to `openapi/profiles.openapi.json`, `generated/profiles/*`, `appointment-catalog.service.ts`, `appointment-filters.service.ts` and an untracked `patients-get.ts`. These must not be committed as-is; Bug 2's unblock will regenerate them properly.

**Alternatives considered**: Planning against `HEAD` — rejected: it would misstate what is running in the developer's environment.
