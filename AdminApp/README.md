# AdminApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.15.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## API client generation

The clients under `src/app/api/generated/` are generated from the running microservice Swagger documents; never edit them by hand. Start the Profiles API and the Documents API, then run:

```bash
npm run api:profiles
npm run api:documents
```

- `api:profiles` downloads `http://localhost:5154/swagger/v1/swagger.json`, applies `scripts/augment-profiles-openapi.mjs`, and regenerates `src/app/api/generated/profiles`.
- `api:documents` downloads `http://localhost:5105/swagger/v1/swagger.json`, applies `scripts/augment-documents-openapi.mjs`, and regenerates `src/app/api/generated/documents`.

Known prerequisites and coordination gaps (tracked by `specs/009-receptionist-management`):

- **CG-1** remains open for profile actions. The Profiles client overlay provides the schema for `GET /api/Receptionists` and `GET /api/Receptionists/{id}`. The directory displays entries without a backend ID as read-only. Opening or deleting a profile requires its ID.
- **CG-2**: the receptionist operations only expose typed envelopes because of the overlay above. Re-run `api:profiles` whenever the backend publishes typed responses.
- **CG-3**: the Documents API documents its actions as untyped `IActionResult`. `scripts/augment-documents-openapi.mjs` adds the `ApiResponseOfGuid` upload body and the `ApiResponse` delete acknowledgment until the backend publishes `[ProducesResponseType]`.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
