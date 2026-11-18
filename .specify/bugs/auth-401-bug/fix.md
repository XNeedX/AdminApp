# Bug Fix: API returns 401 Unauthorized (missing Keycloak bearer token)

- **Slug**: auth-401-bug
- **Fixed**: 2026-11-11T13:05:23+03:00
- **Assessment**: ./assessment.md (not present — see Deviations)
- **Status**: applied

## Summary

AdminApp sent no `Authorization` header to the Gateway API, so every request to `/services/specialization` and `/offices/offices` returned 401. Integrated Keycloak in AdminApp the same way ClientApp does it (realm `InnoClinic`, client `public-client`, silent `check-sso`) and attached the bearer token to Gateway requests via keycloak-angular's functional `includeBearerTokenInterceptor`.

## Root Cause

The previous fix (see history of this report) attached `localStorage['token']`, but **nothing in AdminApp ever writes that key** — AdminApp had no auth of any kind. ClientApp works because it uses `keycloak-angular`'s `KeycloakService`/`KeycloakBearerInterceptor`, which pulls a live token from Keycloak (`http://localhost:8080`, realm `InnoClinic`, per `Backend/Infrastructure/docker-compose.yml`). Downstream microservices (Services, Offices, Profiles) validate JWTs against that realm, hence the 401s.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `AdminApp/package.json` | modified | Added `keycloak-angular@^21.0.0` and `keycloak-js@^26.2.4` (same majors as ClientApp; peer-dep compatible with Angular 21) |
| `AdminApp/src/app/app.config.ts` | modified | `provideKeycloak(...)` with ClientApp's realm/client and `onLoad: 'check-sso'`; `INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG` with a URL condition built from `environment.apiUrl`; interceptors are now `[includeBearerTokenInterceptor, apiErrorInterceptor]` |
| `AdminApp/src/app/app.config.spec.ts` | added test | Pins the Gateway URL scoping (`buildGatewayUrlPattern`) |
| `AdminApp/src/environments/environment.development.ts` | modified | Added `keycloakUrl: 'http://localhost:8080'` |
| `AdminApp/src/environments/environment.ts` | modified | Added `keycloakUrl: 'http://localhost:8080'` |
| `AdminApp/public/assets/silent-check-sso.html` | added | Required by silent `check-sso`; identical to ClientApp's |
| `AdminApp/src/app/core/interceptors/auth.interceptor.ts` | removed | localStorage-based interceptor from the previous, ineffective fix (never had a token to attach) |
| `AdminApp/src/app/core/interceptors/auth.interceptor.spec.ts` | removed | Tests for the removed interceptor |

## Diff Highlights

```ts
// app.config.ts
const provideKeycloakAuth = () =>
  provideKeycloak({
    config: { url: environment.keycloakUrl, realm: 'InnoClinic', clientId: 'public-client' },
    initOptions: {
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
    },
  });

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideKeycloakAuth(),
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [
        createInterceptorCondition<IncludeBearerTokenCondition>({
          urlPattern: gatewayUrlPattern,
          bearerPrefix: 'Bearer',
        }),
      ],
    },
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor, apiErrorInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiUrl },
  ],
};
```

## Tests Added or Updated

- `src/app/app.config.spec.ts` — Gateway pattern matches `apiUrl`, `/services/specialization?...`, `/offices/offices?...`.
- `src/app/app.config.spec.ts` — Gateway pattern rejects the Keycloak origin, lookalike hosts (`localhost:51370`), and unrelated origins.
- `src/app/app.config.spec.ts` — regex metacharacters in `apiUrl` are escaped.
- Removed `auth.interceptor.spec.ts` together with the interceptor it covered.

## Local Verification

- Commands run: `npm install keycloak-angular@^21.0.0 keycloak-js@^26.2.4` → added 2 packages.
- Commands run: `npx ng test --watch=false` → 7 test files, 28 tests passed.
- Commands run: `npx ng build --configuration development` → build succeeded; `keycloak-js` chunk appears in output.
- Manual checks: none against a live backend (requires Keycloak + Gateway running, i.e. `docker compose up` in `Backend/Infrastructure`).

## Deviations from Assessment

- **No `assessment.md` exists for this slug** (neither before the first fix nor now); the user again explicitly approved proceeding without one, so this report is the contract.
- **The previous remediation was wrong** (documented, then corrected in this pass): the localStorage-based `authInterceptor` had no token source. The user directed the fix to follow ClientApp's working implementation, which is Keycloak-based. The custom interceptor and its spec were removed with the user's explicit approval, replaced by keycloak-angular's `includeBearerTokenInterceptor` (a functional `HttpInterceptorFn`, the modern equivalent of ClientApp's `KeycloakBearerInterceptor`).
- **Scope expanded beyond `src/app/core/interceptors/`** to `package.json`, environments, `public/assets/`, and `app.config.ts` — unavoidable because AdminApp had no auth runtime at all.

## Follow-ups

- Verify end-to-end with Keycloak + Gateway running (`http://localhost:8080`, `http://localhost:5137`): open AdminApp, get silently signed in via the existing Keycloak SSO cookie, and confirm `/services/specialization` and `/offices/offices` return 200.
- Consider a dedicated Keycloak client (e.g. `admin-client`) and an auth guard (`createAuthGuard`) restricting AdminApp to admin roles — currently it reuses ClientApp's `public-client` and only attaches tokens, it does not enforce any role.
- The Gateway CORS policy (`AngularPolicy`) only allows `http://localhost:4200`; if AdminApp is served on another port, requests will be blocked by CORS rather than 401.
- `app.config.ts` and `api-base-url.token.ts` import `environment.development` directly; production builds should switch to `environment`.
- Add a 401 handler in `apiErrorInterceptor` (redirect to login / token refresh) once a login route exists.
