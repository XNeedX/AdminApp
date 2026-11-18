# Phase 1 Data Model: Doctor Creation

## 1. Domain Types & Enums

### DoctorStatus
Represents the operational status of a doctor.
```typescript
export enum DoctorStatus {
  AtWork = 'At work',
  OnVacation = 'On vacation',
  SickDay = 'Sick Day',
  SickLeave = 'Sick Leave',
  SelfIsolation = 'Self-isolation',
  LeaveWithoutPay = 'Leave without pay',
  Inactive = 'Inactive',
}
```

### Specialization
Catalog item representing medical disciplines.
```typescript
export interface Specialization {
  id: string;
  name: string;
}
```

### Office
Catalog item representing hospital rooms/offices.
```typescript
export interface Office {
  id: string;
  officeNumber: string;
  address?: string;
}
```

---

## 2. Form Model (`DoctorCreateForm`)

Strictly-typed reactive form structure for `DoctorCreateComponent`.

| Field | Type | Required | Default | Validators |
|---|---|---|---|---|
| `photo` | `FormControl<File | null>` | No | `null` | - |
| `firstName` | `FormControl<string>` | Yes | `''` | `[Validators.required]` |
| `lastName` | `FormControl<string>` | Yes | `''` | `[Validators.required]` |
| `middleName` | `FormControl<string>` | No | `''` | - |
| `dateOfBirth` | `FormControl<string>` | Yes | `''` | `[Validators.required, maxDateValidator(() => new Date())]` |
| `email` | `FormControl<string>` | Yes | `''` | `[Validators.required, Validators.email]`, async: `[emailUniqueValidator(apiService)]` |
| `specializationId` | `FormControl<string>` | Yes | `''` | `[Validators.required]` |
| `officeId` | `FormControl<string>` | Yes | `''` | `[Validators.required]` |
| `careerStartYear` | `FormControl<number | null>` | Yes | `null` | `[Validators.required, maxYearValidator(() => new Date().getFullYear())]` |
| `status` | `FormControl<DoctorStatus>` | Yes | `DoctorStatus.AtWork` | `[Validators.required]` |

---

## 3. API Data Transfer Objects (DTOs)

Generated contracts consumed from `src/app/api/`:

### CreateDoctorRequestDto
```typescript
export interface CreateDoctorRequestDto {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth: string; // ISO 8601 YYYY-MM-DD
  email: string;
  specializationId: string;
  officeId: string;
  careerStartYear: number;
  status: DoctorStatus;
  photoUrl?: string | null;
}
```

### DoctorCreatedResponseDto
```typescript
export interface DoctorCreatedResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}
```

### CheckEmailExistsResponseDto
```typescript
export interface CheckEmailExistsResponseDto {
  exists: boolean;
}
```

---

## 4. UI Error Mappings (on blur / touched)

| Control | Error Key | Validation Rule | Displayed Error Message |
|---|---|---|---|
| `firstName` | `required` | Empty on blur | "Please, enter the first name" |
| `lastName` | `required` | Empty on blur | "Please, enter the last name" |
| `dateOfBirth` | `required` | Empty on blur | "Please, select the date" |
| `dateOfBirth` | `futureDate` | Date > current date | "Date of birth cannot be in the future" |
| `email` | `required` | Empty on blur | "Please, enter the email" |
| `email` | `email` | Missing `@` or bad format | "You've entered an invalid email" |
| `email` | `emailTaken` | Exists on backend | "User with this email already exists" |
| `specializationId` | `required` | Empty on blur | "Please, choose the specialisation" |
| `specialization` | `invalidSpecialization` | Text doesn't match list | "Invalid specialization name" |
| `officeId` | `required` | Empty on blur | "Please, choose the office" |
| `careerStartYear` | `required` | Empty on blur | "Please, select the year" |
| `careerStartYear` | `futureYear` | Year > current year | "Career start year cannot be in the future" |
| `careerStartYear` | `priorToBirth` | Year < birth year | "Career start year cannot precede birth year" |
