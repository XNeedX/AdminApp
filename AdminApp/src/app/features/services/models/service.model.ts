import { Category } from '../../../api/generated/services/models/category';
import { CreateServiceCommand } from '../../../api/generated/services/models/create-service-command';
import { EditServiceDto } from '../../../api/generated/services/models/edit-service-dto';
import { EditStatusDto } from '../../../api/generated/services/models/edit-status-dto';
import { Status } from '../../../api/generated/services/models/status';
import { ViewServiceDto } from '../../../api/generated/services/models/view-service-dto';
import { ViewSpecializationDto } from '../../../api/generated/services/models/view-specialization-dto';
import { ViewSpecializationListDto } from '../../../api/generated/services/models/view-specialization-list-dto';
import { ViewSpecializationServiceDto } from '../../../api/generated/services/models/view-specialization-service-dto';

/** Business label of a service status; the API serializes it as a number. */
export type ServiceStatus = 'Active' | 'Inactive';

/** Business label of a service category; the API serializes it as a number. */
export type ServiceCategory = 'Analyses' | 'Consultations' | 'Diagnostics';

/** Read model rendered in View mode and used to pre-fill Edit mode. */
export interface ServiceView {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly category: ServiceCategory;
  readonly status: ServiceStatus;
  readonly specializationId: string;
}

/** Value emitted by the reusable service form. */
export interface ServiceFormValue {
  readonly name: string;
  readonly price: number;
  readonly category: ServiceCategory;
  readonly status: ServiceStatus;
}

/** A specialization the Receptionist can manage services for. */
export interface SpecializationOption {
  readonly id: string;
  readonly name: string;
}

/** Row rendered by the Services tab. */
export interface ServiceListRow {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly category: ServiceCategory;
  readonly status: ServiceStatus;
}

export function toServiceStatus(value: number): ServiceStatus {
  switch (value) {
    case Status.Active:
      return 'Active';
    case Status.Inactive:
      return 'Inactive';
    default:
      throw new Error(`Unknown service status received from the API: ${value}`);
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

export function fromServiceStatus(value: ServiceStatus): Status {
  switch (value) {
    case 'Active':
      return Status.Active;
    case 'Inactive':
      return Status.Inactive;
  }

  throw new Error(`Unknown service status: ${String(value)}`);
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

  throw new Error(`Unknown service category: ${String(value)}`);
}

/** Converts the generated read model into the UI model, rejecting incomplete payloads. */
export function toServiceView(dto: ViewServiceDto): ServiceView {
  return {
    id: requireText(dto.id, 'id'),
    name: requireText(dto.name, 'name'),
    price: requireNumber(dto.price, 'price'),
    category: requireEnum(dto.category, toServiceCategory, 'category'),
    status: requireEnum(dto.status, toServiceStatus, 'status'),
    specializationId: requireText(dto.specializationId, 'specializationId'),
  };
}

export function toCreateServiceRequest(
  value: ServiceFormValue,
  specializationId: string
): CreateServiceCommand {
  return {
    name: value.name.trim(),
    price: value.price,
    category: fromServiceCategory(value.category),
    status: fromServiceStatus(value.status),
    specializationId,
  };
}

export function toUpdateServiceRequest(value: ServiceFormValue): EditServiceDto {
  return {
    name: value.name.trim(),
    price: value.price,
    category: fromServiceCategory(value.category),
    status: fromServiceStatus(value.status),
  };
}

export function toEditStatusRequest(value: ServiceStatus): EditStatusDto {
  return { status: fromServiceStatus(value) };
}

/** Converts the generated specialization list into selector options. */
export function toSpecializationOptions(
  dtos: readonly ViewSpecializationListDto[]
): readonly SpecializationOption[] {
  return dtos.map((dto) => ({
    id: requireText(dto.id, 'specialization id'),
    name: requireText(dto.name, 'specialization name'),
  }));
}

/** Converts the specialization's services into table rows, rejecting incomplete payloads. */
export function toServiceListRows(
  dtos: readonly ViewSpecializationServiceDto[]
): readonly ServiceListRow[] {
  return dtos.map((dto) => ({
    id: requireText(dto.id, 'id'),
    name: requireText(dto.name, 'name'),
    price: requireNumber(dto.price, 'price'),
    category: requireEnum(dto.category, toServiceCategory, 'category'),
    status: requireEnum(dto.status, toServiceStatus, 'status'),
  }));
}

/** Validates that the specialization detail payload carries the expected id/name. */
export function toSpecializationHeader(dto: ViewSpecializationDto): SpecializationOption {
  return {
    id: requireText(dto.id, 'specialization id'),
    name: requireText(dto.name, 'specialization name'),
  };
}

function requireText(value: string | null | undefined, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Services API returned no ${field} for a service.`);
  }

  return value;
}

function requireNumber(value: number | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Services API returned no ${field} for a service.`);
  }

  return value;
}

function requireEnum<T>(
  value: number | undefined,
  mapper: (raw: number) => T,
  field: string
): T {
  if (typeof value !== 'number') {
    throw new Error(`Services API returned no ${field} for a service.`);
  }

  return mapper(value);
}
