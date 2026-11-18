# Interface Contracts: Doctor Profile API

These contracts document the expected signatures provided by auto-generated backend API clients in `src/app/api/`.

## 1. Doctor API Client Contract

```typescript
export interface DoctorApiClient {
  /**
   * Submits a newly created doctor profile.
   * Backend microservice generates the temporary password and triggers automated credential email.
   */
  createDoctor(payload: CreateDoctorRequestDto): Observable<DoctorCreatedResponseDto>;

  /**
   * Validates whether an email is already registered in the system.
   * Used for async email uniqueness validation.
   */
  checkEmailExists(email: string): Observable<boolean>;

  /**
   * Optional photo upload endpoint for attaching doctor avatar.
   */
  uploadPhoto?(file: File): Observable<{ url: string }>;
}
```

## 2. Specializations Catalog API Client Contract

```typescript
export interface SpecializationApiClient {
  /**
   * Retrieves list of all available medical specializations for dropdown/combobox filtering.
   */
  getSpecializations(): Observable<Specialization[]>;
}
```

## 3. Offices Catalog API Client Contract

```typescript
export interface OfficeApiClient {
  /**
   * Retrieves list of all active clinic offices for dropdown selection.
   */
  getOffices(): Observable<Office[]>;
}
```

## 4. UI Component Contract: ConfirmCancelDialogComponent

Dumb presentational dialog component contract:

```typescript
export interface ConfirmCancelDialogData {
  title?: string;
  message: string; // "Do you really want to cancel? Entered data will not be saved."
  confirmButtonText: string; // "Yes"
  cancelButtonText: string; // "No"
}

// Dialog emits boolean result upon closure:
// true -> User confirmed cancellation (discard data & close modal)
// false -> User rejected cancellation (stay on creation form)
```
