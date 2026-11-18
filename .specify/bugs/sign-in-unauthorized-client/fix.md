# Bug Fix: Sign-in always returns 400 from the Keycloak token endpoint

- **Slug**: sign-in-unauthorized-client
- **Fixed**: 2026-11-11T14:27:20+03:00
- **Assessment**: ./assessment.md (not present — see Deviations)
- **Status**: applied

## Summary

Sign-in with the Keycloak user `testreceptionist` failed with `400 Bad Request` on
`POST /realms/InnoClinic/protocol/openid-connect/token`. Two Keycloak-side blockers were
found and removed: the `public-client` client did not allow direct access grants, and the
user still had a pending `UPDATE_PASSWORD` required action. No AdminApp source code needed
to change — the app already implements the password grant exactly as specified; the realm
prerequisite documented in `specs/003-sign-in-out/contracts/keycloak-auth.contract.md` §1
was never applied.

## Root Cause

Reproduced directly against the running Keycloak (`http://localhost:8080`):

```http
POST /realms/InnoClinic/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_id=public-client&username=testreceptionist&password=111111&grant_type=password&scope=openid
```

```http
HTTP/1.1 400 Bad Request
{"error":"unauthorized_client","error_description":"Client not allowed for direct access grants"}
```

`public-client` had `publicClient=true`, `standardFlowEnabled=true`, but
`directAccessGrantsEnabled=false`. The AdminApp sign-in form uses the Resource Owner
Password grant (`AuthService.signIn`), which Keycloak rejects in that configuration.

A second blocker was discovered while inspecting the user: `testreceptionist` had
`requiredActions: ["UPDATE_PASSWORD"]` (the password was set by an administrator as
temporary). With direct grants enabled, Keycloak would still answer
`400 invalid_grant / "Account is not fully set up"` until that action is completed.

## Changes

| File | Change | Notes |
|------|--------|-------|
| Keycloak realm `InnoClinic`, client `public-client` | modified (external config, not in repo) | `directAccessGrantsEnabled`: `false` → `true` |
| Keycloak realm `InnoClinic`, user `testreceptionist` | modified (external config, not in repo) | `requiredActions`: `["UPDATE_PASSWORD"]` → `[]` |
| — | no repository files changed | Fix was configuration-only; app code was already correct |

## Diff Highlights

Equivalent Admin REST calls that were run:

```http
PUT /admin/realms/InnoClinic/clients/{public-client-id}
{ "clientId": "public-client", "publicClient": true, "standardFlowEnabled": true,
  "directAccessGrantsEnabled": true, ... }
```

```http
PUT /admin/realms/InnoClinic/users/{testreceptionist-id}
{ "username": "testreceptionist", "requiredActions": [], ... }
```

## Tests Added or Updated

None — no application code changed. Existing coverage already pins the password-grant
contract (`src/app/core/services/auth.service.spec.ts`, including the
`unauthorized_client` path) and would not have failed for a realm misconfiguration.

## Local Verification

- `POST /realms/InnoClinic/protocol/openid-connect/token` (same credentials) → **200**,
  `access_token` issued, `expires_in=300`.
- Decoded access token: `sub=a0241e56-…`, `preferred_username=testreceptionist`,
  `realm_access.roles = [Receptionist, default-roles-innoclinic]` — satisfies the app's
  role gate (`Doctor`/`Receptionist`).
- `GET http://localhost:5137/services/specialization` with the bearer token → **200**
  (previously 401 without a token).
- `GET http://localhost:5137/profiles/receptionists/account/{sub}` → **404**. This is
  expected and handled: `AuthService.resolveProfileAccess` fails open when the profile
  endpoint is unavailable, so sign-in proceeds (`AC-4/AC-5` not enforced yet).
- Admin API reads before the change confirmed the two misconfigurations; both `PUT`
  requests returned `204`.

## Deviations from Assessment

- **No `assessment.md` exists** for any bug slug. The only existing bug directory
  (`auth-401-bug/`) documents a different defect and had no assessment either. In
  interactive mode the user was shown the verified root cause and explicitly approved
  proceeding with that diagnosis as the contract.
- **The remediation is not a code change.** The failure is a realm/client/user
  misconfiguration. The spec's own prerequisite (`keycloak-auth.contract.md` §1,
  options A/B) calls for `directAccessGrantsEnabled=true`; option B was applied to
  `public-client`. Nothing in `AdminApp/src` was modified.
- **Scope expanded** beyond the reported `400`: the user's pending `UPDATE_PASSWORD`
  required action was also cleared, because it would have produced the next failure
  immediately after enabling direct grants.
- This change is applied to the running Keycloak instance only (data volume
  `Backend/Infrastructure/containers/identity`); it is not captured in a committed realm
  export, so a fresh environment will reproduce the bug.

## Follow-ups

- Persist the realm settings in a committed realm export/import (or an `kcadm` bootstrap
  script) so `directAccessGrantsEnabled=true` survives fresh environments. Consider a
  dedicated `admin-app-client` (spec option A) instead of relaxing `public-client`.
- The temporary-password flow is invisible to the SPA: with direct grants, a user who
  still has `UPDATE_PASSWORD` only sees the generic "incorrect email or password"
  message. Consider documenting this in the sign-in troubleshooting notes.
- `resolveProfileAccess` currently fails open on HTTP 404; implement/verify
  `/profiles/receptionists/account/{accountId}` to enforce `AC-4/AC-5`.
- Confirm the Gateway CORS policy allows the AdminApp origin (`http://localhost:4200` in
  `AngularPolicy`); otherwise browser requests will fail at the CORS layer next.
