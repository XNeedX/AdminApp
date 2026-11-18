import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ServiceService } from '../../../api/generated/services/services/service.service';
import { SpecializationService } from '../../../api/generated/services/services/specialization.service';
import {
  SpecializationFormValue,
  SpecializationServiceFormValue,
} from '../models/specialization.model';
import {
  EMPTY_WRITE_SESSION,
  SpecializationWriteError,
  SpecializationWriterService,
  WriteSessionState,
  writeStateFromError,
} from './specialization-writer.service';

const SPECIALIZATION_ID = '11111111-1111-1111-1111-111111111111';
const STORED_SERVICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function newRow(key: string, name: string): SpecializationServiceFormValue {
  return {
    key,
    id: null,
    name,
    price: 10,
    status: 'Active',
    category: 'Analyses',
  };
}

function storedRow(key: string, name: string): SpecializationServiceFormValue {
  return {
    key,
    id: STORED_SERVICE_ID,
    name,
    price: 20,
    status: 'Inactive',
    category: 'Diagnostics',
  };
}

function formValue(services: SpecializationServiceFormValue[]): SpecializationFormValue {
  return { name: 'Cardiology', status: 'Active', services };
}

describe('SpecializationWriterService', () => {
  let writer: SpecializationWriterService;

  const specializationPost = vi.fn();
  const specializationIdPut = vi.fn();
  const specializationIdDelete = vi.fn();
  const servicePost = vi.fn();
  const serviceIdPut = vi.fn();
  const serviceIdDelete = vi.fn();

  beforeEach(() => {
    specializationPost.mockReset();
    specializationIdPut.mockReset();
    specializationIdDelete.mockReset();
    servicePost.mockReset();
    serviceIdPut.mockReset();
    serviceIdDelete.mockReset();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SpecializationService,
          useValue: {
            specializationPost,
            specializationIdPut,
            specializationIdDelete,
          },
        },
        {
          provide: ServiceService,
          useValue: { servicePost, serviceIdPut, serviceIdDelete },
        },
      ],
    });

    writer = TestBed.inject(SpecializationWriterService);
  });

  it('creates the specialization first, then one service per new row', async () => {
    const order: string[] = [];

    specializationPost.mockImplementation(() => {
      order.push('specializationPost');
      return of({ isSuccess: true, data: SPECIALIZATION_ID });
    });
    servicePost.mockImplementation(({ body }: { body: { name: string } }) => {
      order.push(`servicePost:${body.name}`);
      return of({ isSuccess: true, data: `id-${body.name}` });
    });

    const value = formValue([newRow('key-1', 'Blood test'), newRow('key-2', 'MRI')]);
    const state = await firstValueFrom(writer.create(value, EMPTY_WRITE_SESSION));

    expect(order).toEqual(['specializationPost', 'servicePost:Blood test', 'servicePost:MRI']);
    expect(state).toEqual({
      specializationId: SPECIALIZATION_ID,
      createdServiceIds: ['key-1', 'key-2'],
    });
    expect(specializationPost).toHaveBeenCalledWith({
      body: { name: 'Cardiology', status: 0 },
    });
    expect(servicePost).toHaveBeenNthCalledWith(1, {
      body: {
        name: 'Blood test',
        price: 10,
        category: 0,
        status: 0,
        specializationId: SPECIALIZATION_ID,
      },
    });
    expect(servicePost).toHaveBeenNthCalledWith(2, {
      body: {
        name: 'MRI',
        price: 10,
        category: 0,
        status: 0,
        specializationId: SPECIALIZATION_ID,
      },
    });
  });

  it('does not create the specialization twice when the same values are submitted again', async () => {
    specializationPost.mockReturnValue(of({ isSuccess: true, data: SPECIALIZATION_ID }));
    specializationIdPut.mockReturnValue(of(undefined));
    servicePost.mockReturnValue(of({ isSuccess: true, data: STORED_SERVICE_ID }));

    const value = formValue([newRow('key-1', 'Blood test')]);
    const first = await firstValueFrom(writer.create(value, EMPTY_WRITE_SESSION));
    await firstValueFrom(writer.create(value, first));

    expect(specializationPost).toHaveBeenCalledOnce();
    expect(specializationIdPut).toHaveBeenCalledOnce();
    expect(servicePost).toHaveBeenCalledOnce();
  });

  it('keeps the created progress and skips it when the service creation is retried', async () => {
    specializationPost.mockReturnValue(of({ isSuccess: true, data: SPECIALIZATION_ID }));
    specializationIdPut.mockReturnValue(of(undefined));

    servicePost
      .mockReturnValueOnce(of({ isSuccess: true, data: 'service-1' }))
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
      )
      .mockReturnValue(of({ isSuccess: true, data: 'service-2' }));

    const value = formValue([newRow('key-1', 'Blood test'), newRow('key-2', 'MRI')]);

    let failure: unknown;
    try {
      await firstValueFrom(writer.create(value, EMPTY_WRITE_SESSION));
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(SpecializationWriteError);

    const state = writeStateFromError(failure);

    expect(state).toEqual({
      specializationId: SPECIALIZATION_ID,
      createdServiceIds: ['key-1'],
    });
    expect(servicePost).toHaveBeenCalledTimes(2);

    if (state === null) {
      return;
    }

    await firstValueFrom(writer.create(value, state));

    expect(specializationPost).toHaveBeenCalledOnce();
    expect(servicePost).toHaveBeenCalledTimes(3);
    expect(servicePost.mock.calls[2]?.[0]).toEqual({
      body: {
        name: 'MRI',
        price: 10,
        category: 0,
        status: 0,
        specializationId: SPECIALIZATION_ID,
      },
    });
  });

  it('updates the specialization, then stored services, then new services', async () => {
    const order: string[] = [];

    specializationIdPut.mockImplementation(() => {
      order.push('specializationIdPut');
      return of(undefined);
    });
    serviceIdPut.mockImplementation(() => {
      order.push('serviceIdPut');
      return of(undefined);
    });
    servicePost.mockImplementation(() => {
      order.push('servicePost');
      return of({ isSuccess: true, data: 'new-service-id' });
    });

    const value = formValue([storedRow('key-1', 'Blood test'), newRow('key-2', 'MRI')]);
    const state = await firstValueFrom(
      writer.update(SPECIALIZATION_ID, value, {
        specializationId: SPECIALIZATION_ID,
        createdServiceIds: [],
      }),
    );

    expect(order).toEqual(['specializationIdPut', 'serviceIdPut', 'servicePost']);
    expect(specializationIdPut).toHaveBeenCalledWith({
      id: SPECIALIZATION_ID,
      body: { name: 'Cardiology', status: 0 },
    });
    expect(serviceIdPut).toHaveBeenCalledWith({
      id: STORED_SERVICE_ID,
      body: { name: 'Blood test', price: 20, category: 2, status: 1 },
    });
    expect(state).toEqual({
      specializationId: SPECIALIZATION_ID,
      createdServiceIds: ['key-2'],
    });
    expect(serviceIdDelete).not.toHaveBeenCalled();
    expect(specializationIdDelete).not.toHaveBeenCalled();
  });

  it('skips services that were already created on a previous attempt', async () => {
    specializationIdPut.mockReturnValue(of(undefined));
    serviceIdPut.mockReturnValue(of(undefined));
    servicePost.mockReturnValue(of({ isSuccess: true, data: 'service-2' }));

    const value = formValue([newRow('key-1', 'Blood test'), newRow('key-2', 'MRI')]);
    const state: WriteSessionState = {
      specializationId: SPECIALIZATION_ID,
      createdServiceIds: ['key-1'],
    };

    const result = await firstValueFrom(writer.update(SPECIALIZATION_ID, value, state));

    expect(servicePost).toHaveBeenCalledOnce();
    expect(result.createdServiceIds).toEqual(['key-1', 'key-2']);
    expect(serviceIdDelete).not.toHaveBeenCalled();
  });

  it('propagates a failure without performing any further write', async () => {
    specializationIdPut.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );

    const value = formValue([storedRow('key-1', 'Blood test'), newRow('key-2', 'MRI')]);

    await expect(
      firstValueFrom(
        writer.update(SPECIALIZATION_ID, value, {
          specializationId: SPECIALIZATION_ID,
          createdServiceIds: [],
        }),
      ),
    ).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(serviceIdPut).not.toHaveBeenCalled();
    expect(servicePost).not.toHaveBeenCalled();
  });

  it('reports a missing identifier instead of writing orphan services', async () => {
    specializationPost.mockReturnValue(of({ isSuccess: true }));

    const value = formValue([newRow('key-1', 'Blood test')]);

    await expect(firstValueFrom(writer.create(value, EMPTY_WRITE_SESSION))).rejects.toThrow(
      'The API did not return the created specialization identifier.',
    );

    expect(servicePost).not.toHaveBeenCalled();
  });
});
