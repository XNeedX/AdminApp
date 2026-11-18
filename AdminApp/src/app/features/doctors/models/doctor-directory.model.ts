import { DoctorStatus } from './doctor-form.model';

/** A doctor row as rendered by the directory table. */
export interface DoctorDirectoryEntry {
  readonly id: string;
  readonly fullName: string;
  readonly specialization: string;
  readonly officeAddress: string;
  /** Normalized to `yyyy-MM-dd`. */
  readonly dateOfBirth: string;
  readonly status: DoctorStatus;
  /** Locks that row's status control while a `PUT` is in flight. */
  readonly isSavingStatus: boolean;
}

/** Immutable filter state crossing the smart/dumb boundary. */
export interface DoctorFilterState {
  readonly nameQuery: string;
  readonly selectedDoctorId: string;
  readonly specialization: string;
  readonly officeAddress: string;
}

/** Empty meaning "no restriction"; the selects render it as `All`. */
export const EMPTY_DOCTOR_FILTERS: DoctorFilterState = {
  nameQuery: '',
  selectedDoctorId: '',
  specialization: '',
  officeAddress: '',
};

/** Label of the empty option in the cascade dropdowns. */
export const CATALOG_ALL_LABEL = 'All';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Stable, accent- and case-insensitive ordering by full name. */
export function compareByFullName(
  left: { readonly fullName: string },
  right: { readonly fullName: string }
): number {
  return collator.compare(left.fullName, right.fullName);
}

/** Sorted copy; never mutates the input. */
export function sortByFullName<T extends { readonly fullName: string }>(
  items: readonly T[]
): T[] {
  return [...items].sort(compareByFullName);
}

/** Distinct values, sorted with the shared collator. */
export function distinctSortedValues(values: readonly string[]): string[] {
  const seen = new Map<string, string>();

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (trimmed.length > 0 && !seen.has(key)) {
      seen.set(key, trimmed);
    }
  }

  return [...seen.values()].sort((left, right) => collator.compare(left, right));
}

/** Matches the typed query against the full name, case-insensitively. */
export function matchesNameQuery(fullName: string, query: string): boolean {
  const normalized = query.trim().toLowerCase();

  return normalized.length === 0 || fullName.toLowerCase().includes(normalized);
}
