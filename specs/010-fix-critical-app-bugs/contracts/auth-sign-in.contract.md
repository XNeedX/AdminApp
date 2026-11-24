# Contract: Sign-in & Session (Bug 1)

Internal UI contract between the sign-in page, `AuthService`, and the HTTP interceptor chain.
The Keycloak token endpoint is an external, documented exception to the generated-client rule.

## C1. Password-grant request

```http
POST {keycloakUrl}/realms/InnoClinic/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&client_id=public-client&username={email}&password={password}&scope=openid
```

| Rule | Requirement |
|------|-------------|
| AC1-1 | Field name is `username`, **not** `email`/`userName` |
| AC1-2 | `email` is `.trim()`-ed before use |
| AC1-3 | Body is form-encoded (`URLSearchParams`), not JSON |
| AC1-4 | Request carries **no** `Authorization` header (it is not a Gateway URL) |
| AC1-5 | `authErrorInterceptor` must not act on a token-endpoint response |

## C2. Token response handling

```http
200 OK
{ "access_token": "...", "refresh_token": "...", "expires_in": 300 }
```

| Rule | Requirement |
|------|-------------|
| AC2-1 | Payload validated by `isTokenResponse`; malformed → `reason:'unavailable'` |
| AC2-2 | `expiresAt = Date.now() + expires_in*1000`; refresh scheduled at `expiresAt - 60s` |
| AC2-3 | Session persisted to `sessionStorage` only after the profile gate passes |

## C3. Profile-status gate

```http
GET {apiUrl}/profiles/{doctors|receptionists}/account/{accountId}
```

| Rule | Requirement |
|------|-------------|
| AC3-1 | Request carries `SILENT_HTTP_ERROR` **and** `SKIP_AUTH_REDIRECT` |
| AC3-2 | 401/403 → `reason:'invalid'`; **no** redirect, **no** session clear |
| AC3-3 | 404 → mark unavailable for app lifetime; fail **open** |
| AC3-4 | Network/timeout/unexpected shape → fail **open**; warn once |
| AC3-5 | `SKIP_AUTH_REDIRECT=true` ⇒ `authErrorInterceptor` returns the error untouched |

## C4. Failure mapping (`toFailureOutcome`)

| HTTP | Condition | Outcome | User message |
|------|-----------|---------|--------------|
| 400/401 | `error.error.error` ∈ `unauthorized_client` | `invalid` | generic invalid credentials |
| 400 | `error.error.error` = `invalid_grant` | `invalid` | generic invalid credentials (dev `console.warn` notes "account not fully set up") |
| other 4xx/5xx | — | `unavailable` | temporarily unavailable |
| network/timeout | — | `unavailable` | temporarily unavailable |

**Security**: never echo Keycloak `error_description` to the UI.

## C5. Interceptor chain order

```
authInterceptor → authErrorInterceptor → apiErrorInterceptor
```

| Rule | Requirement |
|------|-------------|
| AC5-1 | `authInterceptor` adds `Authorization` only for Gateway URLs and not for `ANONYMOUS_GATEWAY_PATHS` |
| AC5-2 | `authErrorInterceptor` on Gateway 401 (without `SKIP_AUTH_REDIRECT`) → `clearSession()` + navigate `/sign-in` |
| AC5-3 | `apiErrorInterceptor` logs unless `SILENT_HTTP_ERROR` |

## Test obligations

- Token POST has no `Authorization`; interceptor chain leaves it untouched.
- 400 `unauthorized_client` → `{success:false, reason:'invalid'}`.
- Profile 401 with `SKIP_AUTH_REDIRECT` → no navigation (spy on `Router.navigate`).
- Gateway 401 without flag → session cleared + navigate.
