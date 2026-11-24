---

description: "Task list for Bugfix Iteration 1 (AdminApp critical defects)"
---

# Tasks: Bugfix Iteration 1 — Critical AdminApp Defects

**Input**: Design documents from `specs/010-fix-critical-app-bugs/`

**Prerequisites**: `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Spec note**: `spec.md` is still the unfilled template. User stories below are derived from
the iteration request + `.specify/bugs/*/fix.md` + verified code diagnosis (see `plan.md`
"Spec Gap"). Fill `spec.md` when convenient; these tasks do not depend on it.

**Tests**: Included — this is a bugfix iteration; regression tests are required by
constitution §"Development Workflow & Quality Gates".

**Organization**: One phase per user story (bug). Stories map as:

- **US1 (P1) = Bug 1** — Sign-in / authorization
- **US2 (P2) = Bug 3** — Receptionists tab
- **US3 (P3) = Bug 2** — Patient search in Create Appointment — **BLOCKED**

Path convention: all paths are relative to `AdminApp/src/app/` unless stated otherwise
(repository path `Frontend/AdminApp/AdminApp/src/app/`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on an incomplete task
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish have none)
- Exact file paths are included in every task

## ⚠️ BLOCKED — Bug 2 (US3)

`GET /Patients` in the generated client has **no query parameters** and returns **`void`**. It
was generated from a hand-edited `openapi/profiles.openapi.json`. Per constitution §II:

> **Необходимо обновить сгенерированный API-клиент из актуального swagger.json микросервиса**

**Do not start Phase 5 (US3) until** the Profiles service Swagger exposes a patient search
endpoint and `npm run api:profiles` has regenerated the client. T027 is the only US3 task
that may run before that (it removes the fabricated artifacts and records the blocker).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch hygiene and a clean baseline before touching code.

- [X] T001 Verify branch is `010-fix-critical-app-bugs` (or create it from `develop`) and record the uncommitted working-tree changes listed in `research.md` R10 (`openapi/profiles.openapi.json`, `api/generated/profiles/**`, `features/appointments/services/appointment-catalog.service.ts`, `features/appointments/services/appointment-filters.service.ts`, untracked `api/generated/profiles/fn/patients/patients-get.ts`) in the PR description so they are not lost or committed accidentally
- [X] T002 Establish a green baseline: run `npx tsc --noEmit`, `npx ng build --configuration development`, `npx ng test --watch=false` in `Frontend/AdminApp/AdminApp` and record results before any edit

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `SKIP_AUTH_REDIRECT` context token is consumed by US1 and must exist first.
US2 does not strictly need it but shares the same interceptor files, so it is placed here.

**⚠️ CRITICAL**: US1 cannot implement its profile-probe fix until T003 exists.

- [X] T003 Create `SKIP_AUTH_REDIRECT` (`new HttpContextToken<boolean>(() => false)`) with a doc comment stating it suppresses `authErrorInterceptor` session clearing/navigation, in `core/tokens/skip-auth-redirect.token.ts`
- [X] T004 Add a unit test asserting the default value is `false` and that two instances are the same token object, in `core/tokens/skip-auth-redirect.token.spec.ts`

**Checkpoint**: Token available — US1 and US2 can proceed in parallel.

---

## Phase 3: User Story 1 — Sign-in / authorization (Bug 1) (Priority: P1) 🎯 MVP

**Goal**: Signing in with valid credentials no longer flashes back to `/sign-in`, and a
fail-open profile probe never clears the session.

**Independent Test**: Sign in at `/sign-in` with a Keycloak user that has `Receptionist`.
Expect: token POST 200 with no `Authorization` header; no redirect bounce; land on `/`.
Wrong password → one inline "invalid credentials" message; no loop.

**Contracts**: `contracts/auth-sign-in.contract.md` (AC1-*, AC2-*, AC3-*, AC4-*, AC5-*)

### Tests for User Story 1 ⚠️ Write first, confirm they FAIL

- [X] T005 [P] [US1] Add test "token POST carries no Authorization header and cookie-less form body" using `HttpTestingController` in `core/services/auth.service.spec.ts`
- [X] T006 [P] [US1] Add test "400 unauthorized_client → { success:false, reason:'invalid' }" and "400 invalid_grant → reason:'invalid' with a dev warnOnce" in `core/services/auth.service.spec.ts`
- [X] T007 [P] [US1] Add test "profile-status probe 401 with SKIP_AUTH_REDIRECT does not navigate and does not clear the session" (spy on `Router.navigate` and `AuthService.clearSession`) in `core/interceptors/auth-error.interceptor.spec.ts`
- [X] T008 [P] [US1] Add test "Gateway 401 without SKIP_AUTH_REDIRECT clears the session and navigates to /sign-in" in `core/interceptors/auth-error.interceptor.spec.ts`

### Implementation for User Story 1

- [X] T009 [US1] In `core/services/auth.service.ts` `resolveProfileAccess` (≈ line 225-257), set `SKIP_AUTH_REDIRECT` alongside `SILENT_HTTP_ERROR` on the `HttpContext`, importing from `core/tokens/skip-auth-redirect.token.ts` (depends T003)
- [X] T010 [US1] In `core/interceptors/auth-error.interceptor.ts` (≈ line 19-27), early-return `throwError(() => error)` when `req.context.get(SKIP_AUTH_REDIRECT)` is true, before the 401 branch (depends T003)
- [X] T011 [US1] In `core/services/auth.service.ts` `toFailureOutcome` (≈ line 260-279), add a distinct `invalid_grant` dev-only `warnOnce` ("account is not fully set up — complete required actions") while still returning `reason:'invalid'`; never surface `error_description` to the UI (contract C4)
- [X] T012 [US1] In `app.config.ts` (≈ line 23-25), confirm interceptor order is `[authInterceptor, authErrorInterceptor, apiErrorInterceptor]` and add a one-line comment documenting that order matters (contract C5)
- [X] T013 [P] [US1] Add `onpush`/declarative-safe regression test asserting `SignInPageComponent` shows `SIGN_IN_MESSAGES.invalidCredentials` for `reason:'invalid'` and `temporarilyUnavailable` for `reason:'unavailable'`, in `features/auth/pages/sign-in-page/sign-in-page.component.spec.ts` (create the file if absent)

**Checkpoint**: US1 independently verifiable via `quickstart.md` → "Bug 1 — Sign-in".

---

## Phase 4: User Story 2 — Receptionists tab (Bug 3) (Priority: P2)

**Goal**: A contract mismatch or a missing office address produces a precise, visible state
instead of a silent "No receptionists found" or an undefined-access crash; missing role is
surfaced, not silently bounced.

**Independent Test**: With a malformed page 2 response, page 1 rows stay and a specific error
renders. A receptionist with `officeAddress: null` renders "Not assigned". A user without
`Receptionist` gets redirected to `/` **and** an access-denied toast.

**Contracts**: `contracts/receptionists-list.contract.md` (CR1-* … CR5-*)

### Tests for User Story 2 ⚠️ Write first, confirm they FAIL

- [X] T014 [P] [US2] Add test "page 2 contract mismatch keeps page 1 rows and sets a specific loadError (not the empty state)" in `features/receptionists/services/receptionist-directory.store.spec.ts` (create if absent)
- [X] T015 [P] [US2] Add test "`officeAddress: null` is accepted by `isReceptionistProfile` and normalized to null" in `features/receptionists/services/receptionist-contract.guards.spec.ts` (create if absent)
- [X] T016 [P] [US2] Add test "`officeLabel(null)` and `officeLabel('')` return 'Not assigned'" in `features/receptionists/utils/receptionist-presentation.spec.ts` (create if absent)
- [X] T017 [P] [US2] Add test "roleGuard without the Receptionist role redirects to / and emits an access-denied notification" in `core/guards/role.guard.spec.ts` (create if absent)

### Implementation for User Story 2

- [X] T018 [P] [US2] Change `ReceptionistRow.officeAddress` to `string | null` and document it in `features/receptionists/models/receptionist.model.ts` (data-model: `officeAddress: string \| null`)
- [X] T019 [US2] In `features/receptionists/services/receptionist-contract.guards.ts` `isReceptionistProfile` (≈ line 31-47), accept `officeAddress` as `string | null | undefined` and normalize missing/`undefined` → `null`; keep rejecting genuinely wrong types (contract CR2-2/CR2-3)
- [X] T020 [US2] In `features/receptionists/utils/receptionist-presentation.ts` `officeLabel` (≈ line 31-33), widen the parameter to `string | null` and return `'Not assigned'` for `null`, `undefined`-like, or empty input (contract CR4-1)
- [X] T021 [US2] In `features/receptionists/services/receptionist-directory.store.ts` `fetchAll` (≈ line 72-100), replace the single outer `try` with a per-page `try/catch`: accumulate valid pages, on `ApiContractError` set a specific `loadError` ("Unexpected response from the receptionists service."), retain already-collected rows, and stop paging (contract CR2-5/CR3-1) (depends T018, T019)
- [X] T022 [US2] In `features/receptionists/services/receptionist-directory.store.ts` `toRow` (≈ line 103-110), coerce `profile.officeAddress` (nullable) into `ReceptionistRow.officeAddress: string | null` (depends T018)
- [X] T023 [US2] In `features/receptionists/components/receptionist-table/receptionist-table.component.ts` `displayOffice` (≈ line 23-25), widen to `(value: string | null) => string` (depends T020)
- [X] T024 [US2] In `features/receptionists/components/receptionist-table/receptionist-table.component.html`, add `@empty` inside the `@for` (≈ line 41-94) rendering a defensive "No rows to display" note; ensure the office cell uses `displayOffice(row.officeAddress)` unchanged (contract CR3-2)
- [X] T025 [US2] In `core/guards/role.guard.ts` (≈ line 13-27), when an authenticated user lacks the role, emit a one-time access-denied message via `NotificationService.showError` before returning the `/` `UrlTree`; keep the guard return-type and side-effect-free navigation contract intact (contract CR5-3)
- [X] T026 [P] [US2] Verify `app.routes.ts` `receptionists` and `receptionists/:id/profile` declarations remain unchanged and add a comment: "order is not significant; both use full path matching" (contract CR5-1)

**Checkpoint**: US2 independently verifiable via `quickstart.md` → "Bug 3 — Receptionists tab".

---

## Phase 5: User Story 3 — Patient search (Bug 2) (Priority: P3) ⛔ BLOCKED

**Goal**: Patient field in Create Appointment searches the backend on demand (debounced,
cancelling stale requests) instead of showing an empty list.

**Independent Test** (only after unblocking): typing `An` issues exactly one request after
300 ms; retyping cancels the previous one; a 500 shows an error, not an empty list; clearing
the field issues no request.

**Contracts**: `contracts/patient-search.contract.md` (AP-1 … AP-8)

### Blocker handling (may run before unblocking)

- [X] T027 [US3] Revert the fabricated `/Patients` entry in `Frontend/AdminApp/AdminApp/openapi/profiles.openapi.json` and delete the generated `api/generated/profiles/fn/patients/patients-get.ts` + its `patientsGet` additions in `api/generated/profiles/services/patients.service.ts` and `api/generated/profiles/index.ts`; record in the PR why, and post the regeneration request: «Необходимо обновить сгенерированный API-клиент из актуального swagger.json микросервиса»

### Tests for User Story 3 ⚠️ Only after regeneration

- [ ] T028 [P] [US3] Add tests "debounce 300 ms issues one request", "distinctUntilChanged skips identical term", "switchMap cancels the stale request", "error surfaces instead of []" in `features/appointments/services/appointment-patient-search.service.spec.ts`
- [ ] T029 [P] [US3] Add test "paged patient guard rejects items without id/fullName and non-finite totalCount" in `features/appointments/services/appointment-patient-search.service.spec.ts`

### Implementation for User Story 3 ⚠️ Only after regeneration

- [ ] T030 [US3] After `npm run api:profiles`, confirm the regenerated Profiles service exposes a patient search method with term + paging; if not, STOP again and report the same regeneration request (constitution §II)
- [ ] T031 [P] [US3] Add `PatientSearchQuery` / `PatientSearchResult` / `PatientSearchState` types matching `data-model.md` in `features/appointments/models/appointment-catalog.model.ts` (or a new `appointment-patient-search.model.ts`)
- [ ] T032 [US3] Create `features/appointments/services/appointment-patient-search.service.ts` building `valueChanges → debounceTime(300) → map(trim) → distinctUntilChanged → switchMap(regenerated search) → catchError → startWith(loading)` exposed via `toSignal({ initialValue })`; validate with a real type guard; no `any` (AP-1…AP-5) (depends T030, T031)
- [X] T033 [US3] In `features/appointments/services/appointment-catalog.service.ts`, remove `loadPatients()` (≈ line 230-242, containing `any`) and the eager `patients` member from `forkJoin` in `load()` (≈ line 188-214) (AP-8) (depends T027)
- [ ] T034 [US3] In `features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts`, wire the search service to the `patientText` control, replace the `patientOptions` computed source (≈ line 124-129) with the search result signal, and keep selection → `patientId` mapping intact (AP-7) (depends T032)
- [ ] T035 [US3] In `features/appointments/components/appointment-create-modal/appointment-create-modal.component.html`, render loading / error / `@empty` states for the patient combobox (AP-6) (depends T034)
- [ ] T036 [US3] Update `features/appointments/services/appointment-form.store.ts` and `features/appointments/services/appointment-cascade.ts` so `CascadeOptions.patients` reflects an async, possibly-empty set without breaking cascade clearing logic (depends T033)

**Checkpoint**: US3 verifiable via `quickstart.md` → "Bug 2 — Patient search".

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T037 [P] Run `grep -rn ": any\b\|<any>\|any\[\]" Frontend/AdminApp/AdminApp/src/app/features/appointments/services/` and confirm zero matches in `appointment-catalog.service.ts`
- [X] T038 Run the full `quickstart.md` validation for US1 and US2 (US3 only if unblocked); record results in the PR
- [X] T039 [P] Confirm no `.subscribe()` was added without `takeUntilDestroyed(this.destroyRef)` or a declarative template subscription in `core/services/auth.service.ts`, `core/interceptors/auth-error.interceptor.ts`, `features/receptionists/services/receptionist-directory.store.ts`, `features/appointments/components/appointment-create-modal/appointment-create-modal.component.ts`
- [X] T040 Review that no file under `E:\Innowise Project\Backend\` was modified (`git status Backend/` empty) per constitution §"Project Scope"
- [X] T041 Confirm no hand-written HTTP service/DTO was added and `api/generated/**` contains no manual edits after regeneration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: immediate
- **Foundational (Phase 2)**: after Setup — **BLOCKS US1** (T003) and is touched by US2
- **US1 (Phase 3)**: after T003
- **US2 (Phase 4)**: after Setup; independent of T003 (does not use the token) → may run in parallel with US1
- **US3 (Phase 5)**: T027 may run any time; **T028–T036 blocked** until API regeneration
- **Polish (Phase 6)**: after the stories that are being delivered

### User Story Dependencies

- **US1 (P1)**: none beyond T003
- **US2 (P2)**: none; different files from US1 except `core/guards/role.guard.ts` (US2-only) and interceptor files (US1-only) — no overlap
- **US3 (P3)**: depends on `appointment-catalog.service.ts` (T033) which US1/US2 do not touch; end-to-end search requires US1 (valid token)

### Within Each Story

- Tests first (T005–T008, T014–T017, T028–T029), confirm they fail
- Models before services (US2: T018 → T019/T021/T022; US3: T031 → T032)
- Services before UI (US2: T021/T022 → T023–T024; US3: T032 → T034)
- Story complete and validated before the next priority

### Parallel Opportunities

- **US1 tests**: T005, T006, T007, T008 — all [P]
- **US2 tests**: T014, T015, T016, T017 — all [P]
- **US2 models/helpers**: T018, T020 can be edited in parallel (different files)
- **US3 types**: T031 independent of T030
- **Whole stories**: US1 (Phase 3) and US2 (Phase 4) touch disjoint files and can run concurrently after Phase 2

---

## Parallel Example: US1 and US2 simultaneously

```bash
# After Phase 2 (T003, T004):
# Developer A — US1
Task: "T005–T008 write failing tests in core/services/auth.service.spec.ts, core/interceptors/auth-error.interceptor.spec.ts"
Task: "T009–T013 patch auth.service.ts, auth-error.interceptor.ts, app.config.ts, sign-in-page spec"

# Developer B — US2
Task: "T014–T017 write failing tests in receptionist-directory.store.spec.ts, receptionist-contract.guards.spec.ts, receptionist-presentation.spec.ts, role.guard.spec.ts"
Task: "T018–T026 patch receptionist models, guard, store, table, role.guard"
```

No shared files between A and B: US1 touches `core/services/`, `core/interceptors/`,
`app.config.ts`, `features/auth/`; US2 touches `features/receptionists/`, `core/guards/`,
comment-only `app.routes.ts`.

---

## Implementation Strategy

### MVP First

1. Phase 1 (T001–T002)
2. Phase 2 (T003–T004)
3. Phase 3 — US1 (T005–T013)
4. **STOP and VALIDATE** via `quickstart.md` "Bug 1"
5. Deliver — sign-in is the blocker for everything else

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → validate → deliver (MVP)
3. US2 → validate → deliver
4. US3 → only after API regeneration → validate → deliver

### Blocked-path Strategy

If regeneration slips, ship T027 alone (removes fabricated artifacts + records request) so
the repository does not carry a false contract, and leave `patientUnavailable` diagnostic in
place — no regression relative to today.

---

## Notes

- `[P]` = different file, no incomplete dependency
- Commit after each task group; never commit the fabricated `/Patients` contract
- Tests must fail before implementation for T005–T008, T014–T017, T028–T029
- Stop at each checkpoint to validate that story independently
