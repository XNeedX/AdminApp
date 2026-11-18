import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DoctorsService } from '../../../api/generated/profiles/services/doctors.service';
import { DoctorStatus } from '../models/doctor-form.model';
import { DoctorDirectoryStore } from './doctor-directory.store';

const ROW = {
  id: 'd1',
  fullName: 'Alice Brown',
  specialization: 'Cardiology',
  officeAddress: 'Office A',
  dateOfBirth: '1980-01-01T00:00:00',
  status: 'At work',
};

const DETAILS = {
  photoPath: null,
  firstName: 'Alice',
  lastName: 'Brown',
  middleName: null,
  dateOfBirth: '1980-01-01T00:00:00',
  specialization: 'Cardiology',
  officeAddress: 'Office A',
  careerStartYear: 2010,
};

function envelope<T>(data: T): unknown {
  return { isSuccess: true, data, message: null, errors: [] };
}

describe('DoctorDirectoryStore status updates', () => {
  const doctorsDoctorsGet = vi.fn();
  const doctorsIdGet = vi.fn();
  const doctorsIdPut = vi.fn();

  let store: DoctorDirectoryStore;

  beforeEach(async () => {
    doctorsDoctorsGet.mockReset();
    doctorsIdGet.mockReset();
    doctorsIdPut.mockReset();

    doctorsDoctorsGet.mockReturnValue(of(envelope({ data: [ROW], totalCount: 1 })));
    doctorsIdGet.mockReturnValue(of(envelope(DETAILS)));
    doctorsIdPut.mockReturnValue(of({ isSuccess: true, message: null, errors: [] }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: DoctorsService,
          useValue: { doctorsDoctorsGet, doctorsIdGet, doctorsIdPut },
        },
      ],
    });

    store = TestBed.inject(DoctorDirectoryStore);
    await store.loadAll();
    TestBed.tick();
  });

  it('patches the row optimistically and locks it while the PUT is in flight', async () => {
    const pending = new Subject<unknown>();
    doctorsIdPut.mockReturnValue(pending);

    const update = store.setStatus('d1', DoctorStatus.OnVacation);

    await Promise.resolve();
    await Promise.resolve();

    expect(store.rows()[0]?.status).toBe(DoctorStatus.OnVacation);
    expect(store.rows()[0]?.isSavingStatus).toBe(true);

    pending.next({ isSuccess: true, message: null, errors: [] });
    pending.complete();
    await update;

    expect(store.rows()[0]?.status).toBe(DoctorStatus.OnVacation);
    expect(store.rows()[0]?.isSavingStatus).toBe(false);
  });

  it('sends exactly one PUT with the complete body and the selected status', async () => {
    await store.setStatus('d1', DoctorStatus.SickLeave);

    expect(doctorsIdGet).toHaveBeenCalledOnce();
    expect(doctorsIdGet).toHaveBeenCalledWith({ id: 'd1' });
    expect(doctorsIdPut).toHaveBeenCalledOnce();
    expect(doctorsIdPut).toHaveBeenCalledWith({
      id: 'd1',
      body: {
        photoPath: null,
        firstName: 'Alice',
        lastName: 'Brown',
        middleName: null,
        dateOfBirth: '1980-01-01T00:00:00',
        specialization: 'Cardiology',
        officeAddress: 'Office A',
        careerStartYear: 2010,
        status: DoctorStatus.SickLeave,
      },
    });
    expect(Object.prototype.hasOwnProperty.call(doctorsIdPut.mock.calls[0]?.[0]?.body, 'email')).toBe(
      false
    );
  });

  it('keeps the new value after a successful update', async () => {
    await store.setStatus('d1', DoctorStatus.Inactive);

    expect(store.rows()[0]?.status).toBe(DoctorStatus.Inactive);
    expect(store.rows()[0]?.isSavingStatus).toBe(false);
  });

  it('restores the previous value and rethrows when the update fails', async () => {
    doctorsIdPut.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'boom' } }))
    );

    await expect(store.setStatus('d1', DoctorStatus.OnVacation)).rejects.toBeInstanceOf(
      HttpErrorResponse
    );

    expect(store.rows()[0]?.status).toBe(DoctorStatus.AtWork);
    expect(store.rows()[0]?.isSavingStatus).toBe(false);
  });

  it('sends nothing when the selected value is already stored', async () => {
    await store.setStatus('d1', DoctorStatus.AtWork);

    expect(doctorsIdGet).not.toHaveBeenCalled();
    expect(doctorsIdPut).not.toHaveBeenCalled();
  });

  it('ignores a second selection while the first update is saving', async () => {
    const pending = new Subject<unknown>();
    doctorsIdPut.mockReturnValue(pending);

    const first = store.setStatus('d1', DoctorStatus.OnVacation);
    await Promise.resolve();
    await Promise.resolve();

    await store.setStatus('d1', DoctorStatus.Inactive);

    expect(doctorsIdGet).toHaveBeenCalledOnce();
    expect(doctorsIdPut).toHaveBeenCalledOnce();

    pending.next({ isSuccess: true, message: null, errors: [] });
    pending.complete();
    await first;

    expect(store.rows()[0]?.status).toBe(DoctorStatus.OnVacation);
  });
});
