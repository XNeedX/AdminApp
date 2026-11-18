import { Category } from '../../../api/generated/services/models/category';
import { CreateServiceCommand } from '../../../api/generated/services/models/create-service-command';
import { CreateSpecializationCommand } from '../../../api/generated/services/models/create-specialization-command';
import { EditServiceDto } from '../../../api/generated/services/models/edit-service-dto';
import { EditSpecializationDto } from '../../../api/generated/services/models/edit-specialization-dto';
import { EditStatusDto } from '../../../api/generated/services/models/edit-status-dto';
import { Status } from '../../../api/generated/services/models/status';
import { ViewSpecializationDto } from '../../../api/generated/services/models/view-specialization-dto';
import { ViewSpecializationListDto } from '../../../api/generated/services/models/view-specialization-list-dto';
import { ViewSpecializationServiceDto } from '../../../api/generated/services/models/view-specialization-service-dto';

/** Business label of a specialization or service status; the API serializes it as a number. */
export type SpecializationStatus = 'Active' | 'Inactive';

/** Business label of a service category; the API serializes it as a number. */
export type ServiceCategory = 'Analyses' | 'Consultations' | 'Diagnostics';

/** Read model rendered in the specializations list. */
export interface SpecializationListRow {
  readonly id: string;
  readonly name: string;
  readonly status: SpecializationStatus;
}

/** Read model of one service inside a specialization. */
export interface SpecializationServiceRow {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly status: SpecializationStatus;
  readonly category: ServiceCategory;
}

/** Read model rendered on the specialization detail page and used to pre-fill Edit mode. */
export interface SpecializationView {
  readonly id: string;
  readonly name: string;
  readonly status: SpecializationStatus;
  readonly services: readonly SpecializationServiceRow[];
}

/** Row value emitted by the specialization form, including editor-only identity. */
export interface SpecializationServiceFormValue {
  readonly key: string;
  readonly id: string | null;
  readonly name: string;
  readonly price: number;
  readonly status: SpecializationStatus;
  readonly category: ServiceCategory;
}

/** Value emitted by the specialization form once it is valid. */
export interface SpecializationFormValue {
  readonly name: string;
  readonly status: SpecializationStatus;
  readonly services: readonly SpecializationServiceFormValue[];
}

export function toSpecializationStatus(value: number): SpecializationStatus {
  switch (value) {
    case Status.Active:
      return 'Active';
    case Status.Inactive:
      return 'Inactive';
    default:
      throw new Error(`Unknown specialization status received from the API: ${value}`);
  }
}

export function toServiceCategory(value: number): ServiceCategory {
  switch (value) {
    case Category.Analyses:
      return 'Analyses';
    case Category.Consultations:
      return 'Consultations';
    case Category.Diagnostics:
      return 'Diagnostics';
    default:
      throw new Error(`Unknown service category received from the API: ${value}`);
  }
}

export function fromSpecializationStatus(value: SpecializationStatus): Status {
  switch (value) {
    case 'Active':
      return Status.Active;
    case 'Inactive':
      return Status.Inactive;
  }
}

export function fromServiceCategory(value: ServiceCategory): Category {
  switch (value) {
    case 'Analyses':
      return Category.Analyses;
    case 'Consultations':
      return Category.Consultations;
    case 'Diagnostics':
      return Category.Diagnostics;
  }
}

/** Converts the generated list into UI rows, rejecting incomplete payloads. */
export function toSpecializationListRows(
  dtos: readonly ViewSpecializationListDto[],
): readonly SpecializationListRow[] {
  return dtos.map((dto) => ({
    id: requireText(dto.id, 'specialization id'),
    name: requireText(dto.name, 'specialization name').trim(),
    status: requireEnum(dto.status, toSpecializationStatus, 'specialization status'),
  }));
}

/** Converts the generated detail into the UI view model, rejecting incomplete payloads. */
export function toSpecializationView(dto: ViewSpecializationDto): SpecializationView {
  const services = Array.isArray(dto.services) ? dto.services.map(toServiceRow) : [];

  return {
    id: requireText(dto.id, 'specialization id'),
    name: requireText(dto.name, 'specialization name').trim(),
    status: requireEnum(dto.status, toSpecializationStatus, 'specialization status'),
    services,
  };
}

function toServiceRow(dto: ViewSpecializationServiceDto): SpecializationServiceRow {
  return {
    id: requireText(dto.id, 'service id'),
    name: requireText(dto.name, 'service name').trim(),
    price: requireNumber(dto.price, 'service price'),
    status: requireEnum(dto.status, toSpecializationStatus, 'service status'),
    category: requireEnum(dto.category, toServiceCategory, 'service category'),
  };
}

/**
 * Builds the specialization create payload from the spec-defined fields only
 * (name + status). Price and category belong to services, not to a specialization.
 */
export function toCreateSpecializationRequest(
  value: SpecializationFormValue,
): CreateSpecializationCommand {
  return {
    name: value.name.trim(),
    status: fromSpecializationStatus(value.status),
  };
}

/** Builds the specialization update payload. */
export function toUpdateSpecializationRequest(
  value: SpecializationFormValue,
): EditSpecializationDto {
  return {
    name: value.name.trim(),
    status: fromSpecializationStatus(value.status),
  };
}

export function toCreateSpecializationServiceRequest(
  value: SpecializationServiceFormValue,
  specializationId: string,
): CreateServiceCommand {
  return {
    name: value.name.trim(),
    price: value.price,
    category: fromServiceCategory(value.category),
    status: fromSpecializationStatus(value.status),
    specializationId,
  };
}

export function toUpdateSpecializationServiceRequest(
  value: SpecializationServiceFormValue,
): EditServiceDto {
  return {
    name: value.name.trim(),
    price: value.price,
    category: fromServiceCategory(value.category),
    status: fromSpecializationStatus(value.status),
  };
}

export function toSpecializationStatusRequest(value: SpecializationStatus): EditStatusDto {
  return { status: fromSpecializationStatus(value) };
}

/** Sorts rows case-insensitively by specialization name (FR-009). */
export function sortBySpecializationName(
  rows: readonly SpecializationListRow[],
): readonly SpecializationListRow[] {
  return [...rows].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
}

function requireText(value: string | null | undefined, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`The API returned no ${field}.`);
  }

  return value;
}

function requireNumber(value: number | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`The API returned no ${field}.`);
  }

  return value;
}

function requireEnum<T>(value: number | undefined, mapper: (raw: number) => T, field: string): T {
  if (typeof value !== 'number') {
    throw new Error(`The API returned no ${field}.`);
  }

  return mapper(value);
}
