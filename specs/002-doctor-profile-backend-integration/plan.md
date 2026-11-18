# Implementation Plan: Doctor Profile Backend Integration

**Branch**: `002-doctor-profile-backend-integration` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-doctor-profile-backend-integration/spec.md`

## Summary

Integrate `DoctorCreateComponent` with ASP.NET backend microservices running in Docker via Gateway API (`http://localhost:5137` via `environment.apiUrl`).
The integration requires:
1. Dynamic retrieval of clinic offices from `offices-api` (`GET /offices/offices`).
2. Typeahead search/retrieval of medical specializations from `services-api` (`GET /services/specialization`).
3. Photo upload to blob storage via `documents-api` (`POST /documents/documents`).
4. Creation of doctor profile via `profiles-api` (`POST /profiles/doctors`).
5. Asynchronous email uniqueness validation against the backend.
6. Reactive loading state indicators and accessible toast/notification error handling.

## Technical Context

**Language/Version**: TypeScript 5.9, Angular 21.2
**Primary Dependencies**: `@angular/core`, `@angular/common/http`, `@angular/forms`, `rxjs` 7.8
**Base API URL**: `environment.apiUrl` (`http://localhost:5137` targeting Gateway API / Ocelot)
**Target Platform**: Modern Web Browsers
**Constraints**:
- Zero hand-written HTTP services or manual DTOs (Constitutional Principle II).
- Strictly consume auto-generated OpenAPI client.
- All requests MUST route through Gateway API (`/offices/*`, `/services/*`, `/profiles/*`, `/documents/*`).

## Constitution Check

*GATE: Evaluated against `.specify/memory/constitution.md`*

| Principle / Rule | Compliance Status | Details |
|---|---|---|
| **Standalone Components Only** | PASS | `DoctorCreateComponent` is standalone. |
| **Smart/Dumb Pattern** | PASS | `DoctorCreateComponent` manages API integration as smart container. |
| **OnPush Change Detection** | PASS | Preserved across all components. |
| **Automated Backend API (Zero Manual API Code)** | ❌ **GATE BLOCKED** | **Auto-generated OpenAPI clients are absent in `Frontend/AdminApp/src/app/api/`. Writing manual HTTP services or DTOs is strictly prohibited by project Constitution and user instructions.** |
| **Reactivity & Memory Safety** | PASS | Signals for loading/error states, `takeUntilDestroyed()` for RxJS subscriptions. |
| **Utility-First Tailwind CSS** | PASS | Loading spinners and error notification banners use Tailwind utility classes. |
| **Strict TypeScript** | PASS | Zero `any` tolerance. |

## Gate Evaluation: Work Halted

In accordance with the **Project Constitution (Principle II)**, **GEMINI.md instructions**, and user-specified constraints:
- Automatic code generation from Swagger/OpenAPI has not yet been executed in `Frontend/AdminApp/`.
- Required methods are missing for:
  - `offices-api`: `GET /offices/offices`
  - `services-api`: `GET /services/specialization`
  - `documents-api`: `POST /documents/documents`
  - `profiles-api`: `POST /profiles/doctors`
- Manual creation of HTTP clients and DTOs is strictly forbidden.

**Action Required**: Regenerate/generate the OpenAPI client in `Frontend/AdminApp` from the backend Swagger endpoints.
