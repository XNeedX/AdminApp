<!--
SYNC IMPACT REPORT
==================
Version Change: 1.0.0 → 1.1.0
Ratification Date: 2026-11-10
Last Amended Date: 2026-11-10

Modified Principles:
- II. Automated Backend API Integration (Zero Manual API Code) (added Read-Only Backend Source Inspection rule)
- Project Scope & Polyrepo Boundaries (harmonized polyrepo boundaries with read-only backend inspection)

Added Sections:
- None

Removed Sections:
- None

Follow-up TODOs:
- None
-->

# AdminApp Constitution

## Core Principles

### I. Standalone & Smart/Dumb Component Architecture
- **Pure Standalone API**: All components, directives, and pipes MUST be declared as standalone (`standalone: true`). `NgModule` usage is strictly prohibited, except where mandatory for integrating legacy third-party libraries.
- **Smart/Dumb Pattern**: Components MUST strictly adhere to the Smart (Container) / Dumb (Presentational) pattern:
  - *Smart Components*: Manage component state, inject domain services, trigger API operations, and pass data down to child components via inputs.
  - *Dumb Components*: Purely representational; they MUST NOT inject business services or contain side effects. Dumb components receive data strictly through inputs (`input()` or `@Input()`) and notify parent components exclusively via outputs (`output()` or `@Output()`).
- **OnPush Change Detection**: Every component MUST explicitly declare `changeDetection: ChangeDetectionStrategy.OnPush` to guarantee predictable rendering performance and change-detection tree isolation.
- **Lifecycle Cleanliness**: Constructors MUST remain lightweight (dependency injection only); complex logic and initialization routines MUST reside in lifecycle hooks such as `ngOnInit`.

### II. Automated Backend API Integration (Zero Manual API Code)
- **Zero Hand-Written API Contracts**: Developers and AI agents MUST NOT manually write HTTP services, DTOs, request/response models, or API client interfaces.
- **Single Source of Truth**: All backend communication MUST exclusively rely on auto-generated API clients produced from ASP.NET OpenAPI/Swagger specifications.
- **Missing Contract Protocol**: If an endpoint, parameter, or DTO is missing, out-of-date, or incorrect in the generated API client, work on that feature MUST immediately pause. The developer must be requested to regenerate the client from the latest backend `swagger.json` microservice definition.
- **Backend Source Inspection (Read-Only)**: If the auto-generated API client is absent, outdated, or if there is uncertainty regarding endpoint paths, request parameters, or DTO models, the agent/developer is PERMITTED to read and analyze backend microservice source code in `Backend/`:
  - Search and inspect endpoint routes, HTTP verbs, and parameters in `*Controller.cs` files.
  - Search and inspect payload schemas in model/DTO directories (typically `Models/`, `Dto/`, `Requests/`, `Responses/`).
  - **STRICT PROHIBITION**: Modifying, creating, or refactoring files in `Backend/` is strictly forbidden. All code generation and edits MUST be performed exclusively in `Frontend/AdminApp/`.
- **Centralized Error Interception**: Global API error scenarios (such as HTTP 401 Unauthorized, 403 Forbidden, 500 Internal Server Error) MUST be handled centrally using functional HTTP interceptors (`HttpInterceptorFn`).

### III. Reactive State Management & Signal-First Reactivity
- **Signals for Synchronous & Local State**: Angular Signals (`signal`, `computed`, `effect`, signal-based inputs/outputs) MUST be the primary mechanism for local component state, derived values, and template bindings.
- **RxJS for Asynchronous Streams**: Observables and RxJS operators MUST be used for asynchronous data streams, including HTTP requests, router events, and global messaging.
- **Interoperability**: Asynchronous RxJS streams should be converted to Signals via `toSignal()` for idiomatic, clean template rendering without unnecessary `AsyncPipe` boilerplate.
- **Subscription Leak Prevention**: Hanging subscriptions are forbidden. When explicit manual subscriptions (`.subscribe()`) are necessary, they MUST be bounded using `takeUntilDestroyed()` paired with `DestroyRef`, or managed via declarative template subscriptions.

### IV. Utility-First Tailwind CSS & Mobile-First Design
- **Utility-First in Templates**: Styling MUST be applied directly within HTML templates using Tailwind CSS utility classes.
- **Style Encapsulation & Componentization**: Component-level `.scss` / `.css` files MUST be minimized. The `@apply` directive is prohibited in component stylesheets; reusable styling patterns MUST be encapsulated as dedicated Angular UI components (e.g., `<app-button>`).
- **Mobile-First Responsive Design**: Responsive layouts MUST strictly follow a Mobile-First approach using standard Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
- **Accessible Headless UI**: Complex interactive overlay components (e.g., modals, dropdowns, popovers, tooltips) MUST combine Tailwind styling with headless accessibility primitives such as Angular CDK.

### V. Strict TypeScript & Type Safety
- **Zero-Tolerance for `any`**: The `any` type is strictly forbidden across the entire codebase.
- **Handling Unknown Data**: External or untrusted dynamic data MUST be typed as `unknown` and validated using explicit Type Guards / runtime validators before consumption.
- **Naming Conventions**: Interface and type aliases MUST NOT begin with an `I` prefix (e.g., use `User`, never `IUser`). Types and classes MUST use `PascalCase`, while variables, functions, and methods MUST use `camelCase`.

## Project Scope & Polyrepo Boundaries

- **Polyrepo Boundary**: AdminApp operates within a multi-project repository (`E:\Innowise Project\`). Code changes are strictly confined to `Frontend/AdminApp/`. Files in `Backend/` MAY be inspected in read-only mode to clarify endpoint contracts and DTO structures, but MUST NOT be modified or refactored. `Frontend/ClientApp/` MUST NOT be inspected or altered without explicit instructions.
- **Modular Directory Architecture**: Code inside `Frontend/AdminApp/src/app/` MUST strictly observe folder responsibilities:
  - `core/`: Singleton services, HTTP interceptors, route guards, base configurations, and global authentication.
  - `shared/`: Reusable dumb UI components, pipes, and directives.
  - `features/`: Domain-specific business modules (e.g., `users/`, `dashboard/`, `settings/`), each encapsulated with independent routing.
  - `api/`: Auto-generated OpenAPI / Swagger clients and contract interfaces.

## Development Workflow & Quality Gates

- **Pre-Implementation Verification**: Prior to developing UI features depending on backend operations, verify that the required endpoints and models exist in `src/app/api/`. If missing or ambiguous, read backend controller and DTO files for contract verification and initiate OpenAPI client regeneration.
- **Architectural Validation**: Any new component must pass inspection for:
  1. `standalone: true` and `ChangeDetectionStrategy.OnPush`.
  2. Clear Smart vs. Dumb separation.
  3. No raw `.subscribe()` without `takeUntilDestroyed()`.
  4. Complete absence of `any` and `I`-prefixed interfaces.
  5. Absence of `@apply` and excessive custom CSS.
- **Review & Gate Enforcement**: Code reviews and CI checks MUST enforce compliance with these standards before merging. Non-compliant patterns are blocking defects.

## Governance

- **Constitutional Supremacy**: This Constitution serves as the definitive architectural governing standard for `AdminApp`. All code, documentation, and agent-assisted workflows MUST comply with its principles.
- **Amendment Procedure**: Modifications to principles, additions, or deprecations require an explicit architectural review, a documented rationale, and an updated version number following Semantic Versioning rules.
- **Semantic Versioning Policy**:
  - **MAJOR**: Incompatible governance shifts, removal of core principles, or major architectural deprecations.
  - **MINOR**: Addition of new principles, expanded guidance, or structural workflow requirements.
  - **PATCH**: Clarifications, non-semantic refinements, typographical fixes, or wording enhancements.
- **Compliance Auditing**: Automated tools, pull request reviewers, and coding assistants MUST verify adherence to these rules prior to code integration.

**Version**: 1.1.0 | **Ratified**: 2026-11-10 | **Last Amended**: 2026-11-10
