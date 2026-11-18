import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DoctorsService } from '../../../api/generated/profiles/services/doctors.service';
import { EMPTY_DOCTOR_FILTERS } from '../models/doctor-directory.model';
import { DoctorDirectoryStore } from './doctor-directory.store';

interface TableRow {
  readonly id: string;
  readonly fullName: string;
  readonly specialization: string;
  readonly officeAddress: string;
  readonly dateOfBirth: string;
  readonly status: string;
}

const ROWS: readonly TableRow[] = [
  {
    id: 'd1',
    fullName: 'Alice Brown',
    specialization: 'Cardiology',
    officeAddress: 'Office A',
    dateOfBirth: '1980-01-01T00:00:00',
    status: 'At work',
  },
  {
    id: 'd2',
    fullName: 'Bob Green',
    specialization: 'Neurology',
    officeAddress: 'Office A',
    dateOfBirth: '1975-02-02T00:00:00',
    status: 'On vacation',
  },
  {
    id: 'd3',
    fullName: 'Cara White',
    specialization: 'Cardiology',
    officeAddress: 'Office B',
    dateOfBirth: '1990-03-03T00:00:00',
    status: 'Inactive',
  },
  {
    id: 'd4',
    fullName: 'Dan Black',
    specialization: 'Dermatology',
    officeAddress: 'Office C',
    dateOfBirth: '1985-04-04T00:00:00',
    status: 'Sick Day',
  },
];

function envelope<T>(data: T): { isSuccess: boolean; data: T; message: null; errors: [] } {
  return { isSuccess: true, data, message: null, errors: [] };
}

function pageOf(data: readonly TableRow[], totalCount: number): unknown {
  return envelope({ data, totalCount });
}

describe('DoctorDirectoryStore', () => {
  const doctorsDoctorsGet = vi.fn();

  let store: DoctorDirectoryStore;

  beforeEach(() => {
    doctorsDoctorsGet.mockReset();
    doctorsDoctorsGet.mockReturnValue(of(pageOf(ROWS, ROWS.length)));

    TestBed.configureTestingModule({
      providers: [{ provide: DoctorsService, useValue: { doctorsDoctorsGet } }],
    });

    store = TestBed.inject(DoctorDirectoryStore);
  });

  async function load(): Promise<void> {
    await store.loadAll();
    TestBed.tick();
  }

  it('loads every page once and aggregates until totalCount', async () => {
    doctorsDoctorsGet.mockImplementation((params: { page?: number } = {}) => {
      const page = params.page ?? 1;

      if (page === 1) {
        return of(pageOf(ROWS.slice(0, 2), ROWS.length));
      }

      return of(pageOf(ROWS.slice(2), ROWS.length));
    });

    await load();

    expect(doctorsDoctorsGet).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 100 });
    expect(doctorsDoctorsGet).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 });
    expect(store.rows()).toHaveLength(4);
    expect(store.isLoading()).toBe(false);
  });

  it('stops on an empty page instead of looping forever', async () => {
    doctorsDoctorsGet.mockReturnValue(of(pageOf([], 0)));

    await load();

    expect(doctorsDoctorsGet).toHaveBeenCalledOnce();
    expect(store.rows()).toEqual([]);
    expect(store.loadError()).toBeNull();
  });

  it('respects the 50-page safety cap', async () => {
    doctorsDoctorsGet.mockReturnValue(of(pageOf([ROWS[0]], 10000)));

    await load();

    expect(doctorsDoctorsGet).toHaveBeenCalledTimes(50);
  });

  it('reports a contract error instead of rendering rows with an unknown status', async () => {
    doctorsDoctorsGet.mockReturnValue(
      of(pageOf([ROWS[0], { ...ROWS[1], status: 'Unknown status' }], 2))
    );

    await load();

    expect(store.rows()).toEqual([]);
    expect(store.loadError()).not.toBeNull();
  });

  it('exposes the full catalogs while no filter is active', async () => {
    await load();

    expect(store.specializationOptions()).toEqual(['Cardiology', 'Dermatology', 'Neurology']);
    expect(store.officeOptions()).toEqual(['Office A', 'Office B', 'Office C']);
    expect(store.visibleRows()).toHaveLength(4);
  });

  it('limits the specialization options to the selected office', async () => {
    await load();

    store.officeAddress.set('Office A');
    TestBed.tick();

    expect(store.specializationOptions()).toEqual(['Cardiology', 'Neurology']);
    expect(store.officeOptions()).toEqual(['Office A', 'Office B', 'Office C']);
  });

  it('limits the office options to the selected specialization', async () => {
    await load();

    store.specialization.set('Cardiology');
    TestBed.tick();

    expect(store.specializationOptions()).toEqual(['Cardiology', 'Dermatology', 'Neurology']);
    expect(store.officeOptions()).toEqual(['Office A', 'Office B']);
  });

  it('applies name, doctor, specialization and office with AND semantics', async () => {
    await load();

    store.nameQuery.set('brown');
    store.selectedDoctorId.set('d1');
    store.specialization.set('Cardiology');
    store.officeAddress.set('Office A');
    TestBed.tick();

    expect(store.visibleRows().map((row) => row.id)).toEqual(['d1']);
    expect(store.isNarrowed()).toBe(true);
    expect(store.isEmpty()).toBe(false);

    store.selectedDoctorId.set('d3');
    TestBed.tick();

    expect(store.visibleRows()).toEqual([]);
    expect(store.isEmpty()).toBe(true);
  });

  it('restores every row when the filters are cleared', async () => {
    await load();

    store.nameQuery.set('brown');
    store.specialization.set('Cardiology');
    store.officeAddress.set('Office B');
    store.clearFilters();
    TestBed.tick();

    expect(store.hasActiveFilters()).toBe(false);
    expect(store.visibleRows()).toHaveLength(4);
  });

  it('resets the office filter when the chosen specialization is not offered there', async () => {
    await load();

    store.officeAddress.set('Office A');
    TestBed.tick();
    store.applyFilters({ ...EMPTY_DOCTOR_FILTERS, officeAddress: 'Office A', specialization: 'Dermatology' });
    TestBed.tick();

    expect(store.officeAddress()).toBe('');
    expect(store.specialization()).toBe('Dermatology');
    expect(store.visibleRows().map((row) => row.id)).toEqual(['d4']);
  });

  it('resets the specialization filter when the chosen office does not offer it', async () => {
    await load();

    store.specialization.set('Neurology');
    TestBed.tick();
    store.applyFilters({ ...EMPTY_DOCTOR_FILTERS, specialization: 'Neurology', officeAddress: 'Office B' });
    TestBed.tick();

    expect(store.specialization()).toBe('');
    expect(store.officeAddress()).toBe('Office B');
    expect(store.visibleRows().map((row) => row.id)).toEqual(['d3']);
  });

  it('reports a retryable error and clears stale rows when loading fails', async () => {
    doctorsDoctorsGet.mockReturnValue(
      of({ isSuccess: false, data: null, message: 'Database unavailable', errors: [] })
    );

    await load();

    expect(store.rows()).toEqual([]);
    expect(store.loadError()).toBe('Database unavailable');
    expect(store.isLoading()).toBe(false);
  });
});
