import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReceptionistsService } from '../../../api/generated/profiles/services/receptionists.service';
import { ReceptionistProfile } from '../models/receptionist.model';
import { ReceptionistDirectoryStore } from './receptionist-directory.store';

const PROFILES: readonly ReceptionistProfile[] = [
  {
    id: 'r1',
    photoPath: null,
    firstName: 'Anna',
    lastName: 'Smith',
    middleName: null,
    officeAddress: 'Office A',
  },
  {
    id: 'r2',
    photoPath: 'file-1',
    firstName: 'Bob',
    lastName: 'Jones',
    middleName: 'Lee',
    officeAddress: '',
  },
];

function envelope<T>(data: T): { isSuccess: boolean; data: T; message: null; errors: [] } {
  return { isSuccess: true, data, message: null, errors: [] };
}

function pageOf(data: readonly ReceptionistProfile[], totalCount: number): unknown {
  return envelope({ data, totalCount });
}

describe('ReceptionistDirectoryStore', () => {
  const receptionistsGet = vi.fn();
  const receptionistsIdDelete = vi.fn();

  let store: ReceptionistDirectoryStore;

  beforeEach(() => {
    receptionistsGet.mockReset();
    receptionistsIdDelete.mockReset();
    receptionistsGet.mockReturnValue(of(pageOf(PROFILES, PROFILES.length)));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ReceptionistsService,
          useValue: { receptionistsGet, receptionistsIdDelete },
        },
      ],
    });

    store = TestBed.inject(ReceptionistDirectoryStore);
  });

  async function load(): Promise<void> {
    await store.loadAll();
    TestBed.tick();
  }

  it('loads every page once and aggregates until totalCount', async () => {
    receptionistsGet.mockImplementation((params: { page?: number } = {}) => {
      const page = params.page ?? 1;

      if (page === 1) {
        return of(pageOf(PROFILES.slice(0, 1), PROFILES.length));
      }

      return of(pageOf(PROFILES.slice(1), PROFILES.length));
    });

    await load();

    expect(receptionistsGet).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 100 });
    expect(receptionistsGet).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 });
    expect(store.rows()).toHaveLength(2);
    expect(store.rows()[0]).toEqual({
      id: 'r1',
      fullName: 'Anna Smith',
      officeAddress: 'Office A',
      photoPath: null,
    });
    expect(store.isLoading()).toBe(false);
  });

  it('stops on an empty page instead of looping forever', async () => {
    receptionistsGet.mockReturnValue(of(pageOf([], 0)));

    await load();

    expect(receptionistsGet).toHaveBeenCalledOnce();
    expect(store.rows()).toEqual([]);
    expect(store.loadError()).toBeNull();
  });

  it('respects the 50-page safety cap', async () => {
    const hundred = Array.from({ length: 100 }, (_, index) => ({
      ...PROFILES[0],
      id: `r${index}`,
    }));

    receptionistsGet.mockReturnValue(of(pageOf(hundred, 10000)));

    await load();

    expect(receptionistsGet).toHaveBeenCalledTimes(50);
  });

  it('reports the envelope failure instead of rendering rows', async () => {
    receptionistsGet.mockReturnValue(
      of({ isSuccess: false, data: null, message: 'Database unavailable', errors: [] }),
    );

    await load();

    expect(store.rows()).toEqual([]);
    expect(store.loadError()).toBe('Database unavailable');
    expect(store.isLoading()).toBe(false);
  });

  it('rejects a profile without an id through the contract guard', async () => {
    receptionistsGet.mockReturnValue(of(pageOf([{ ...PROFILES[0], id: '' }], 1)));

    await load();

    expect(store.rows()).toEqual([]);
    expect(store.loadError()).not.toBeNull();
  });

  it('keeps the rows of earlier pages when a later page breaks the contract', async () => {
    receptionistsGet.mockImplementation((params: { page?: number } = {}) => {
      const page = params.page ?? 1;

      if (page === 1) {
        return of(pageOf(PROFILES.slice(0, 1), PROFILES.length));
      }

      // Page 2 carries a row without an id: `readApiEnvelope` rejects the whole page.
      return of(pageOf([{ ...PROFILES[1], id: '' }], PROFILES.length));
    });

    await load();

    expect(store.rows().map((row) => row.id)).toEqual(['r1']);
    expect(store.loadError()).toBe(
      'The receptionists service returned an unexpected response. Some entries may be missing.'
    );
    expect(store.isLoading()).toBe(false);
  });

  it('renders a receptionist without an office as a null address', async () => {
    receptionistsGet.mockReturnValue(
      of(pageOf([{ ...PROFILES[0], officeAddress: undefined as unknown as string }], 1)),
    );

    await load();

    expect(store.rows()).toHaveLength(1);
    expect(store.rows()[0].officeAddress).toBeNull();
    expect(store.loadError()).toBeNull();
  });

  it('shares one in-flight load between overlapping calls', async () => {
    const pending = new Subject<unknown>();
    receptionistsGet.mockReturnValue(pending.asObservable());

    const first = store.loadAll();
    const second = store.loadAll();

    expect(receptionistsGet).toHaveBeenCalledOnce();

    pending.next(pageOf(PROFILES, PROFILES.length));
    pending.complete();

    await Promise.all([first, second]);

    expect(store.rows()).toHaveLength(PROFILES.length);
  });

  it('removes a row only after a successful delete acknowledgment', async () => {
    await load();
    receptionistsIdDelete.mockReturnValue(
      of({ isSuccess: true, data: null, message: null, errors: [] }),
    );

    const removed = await store.delete('r1');

    expect(removed).toBe(true);
    expect(receptionistsIdDelete).toHaveBeenCalledWith({ id: 'r1' });
    expect(store.rows().map((row) => row.id)).toEqual(['r2']);
    expect(store.deletingId()).toBeNull();
  });

  it('keeps the row and reports the error when the delete fails', async () => {
    await load();
    receptionistsIdDelete.mockReturnValue(
      of({ isSuccess: false, data: null, message: 'Delete failed', errors: [] }),
    );

    const removed = await store.delete('r1');

    expect(removed).toBe(false);
    expect(store.rows()).toHaveLength(2);
    expect(store.deleteError()).toBe('Delete failed');
    expect(store.deletingId()).toBeNull();
  });

  it('ignores a second delete while one is already running', async () => {
    await load();
    const pending = new Subject<unknown>();
    receptionistsIdDelete.mockReturnValue(pending.asObservable());

    const first = store.delete('r1');
    const second = await store.delete('r2');

    expect(second).toBe(false);
    expect(receptionistsIdDelete).toHaveBeenCalledOnce();

    pending.next({ isSuccess: true, data: null, message: null, errors: [] });
    pending.complete();

    expect(await first).toBe(true);
    expect(store.rows().map((row) => row.id)).toEqual(['r2']);
  });
});
