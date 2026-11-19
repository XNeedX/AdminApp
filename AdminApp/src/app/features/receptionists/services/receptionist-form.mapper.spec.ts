import { describe, expect, it } from 'vitest';

import { ReceptionistFormValue } from '../models/receptionist-form.model';
import { toCreateReceptionistRequest, toUpdateReceptionistDto } from './receptionist-form.mapper';

function value(overrides: Partial<ReceptionistFormValue> = {}): ReceptionistFormValue {
  return {
    photo: null,
    firstName: '  Anna ',
    lastName: ' Smith  ',
    middleName: '  Lee ',
    email: ' anna@clinic.org ',
    officeText: ' Office A ',
    officeId: 'office-1',
    ...overrides,
  };
}

describe('receptionist form mapper', () => {
  it('trims every create value and copies the photo path', () => {
    const body = toCreateReceptionistRequest(value(), 'file-1');

    expect(body).toEqual({
      photoPath: 'file-1',
      firstName: 'Anna',
      lastName: 'Smith',
      middleName: 'Lee',
      email: 'anna@clinic.org',
      officeAddress: 'Office A',
    });
  });

  it('maps a blank or missing middle name to null', () => {
    expect(toCreateReceptionistRequest(value({ middleName: '   ' }), null).middleName).toBeNull();
    expect(toCreateReceptionistRequest(value({ middleName: null }), null).middleName).toBeNull();
  });

  it('fails loudly when a required create field is blank', () => {
    expect(() => toCreateReceptionistRequest(value({ firstName: '   ' }), null)).toThrow(
      'The first name field is required.',
    );
    expect(() => toCreateReceptionistRequest(value({ lastName: '' }), null)).toThrow(
      'The last name field is required.',
    );
    expect(() => toCreateReceptionistRequest(value({ email: '' }), null)).toThrow(
      'The email field is required.',
    );
    expect(() => toCreateReceptionistRequest(value({ officeText: '' }), null)).toThrow(
      'The office field is required.',
    );
  });

  it('builds the update body without any email property', () => {
    const body = toUpdateReceptionistDto(value(), 'file-2');

    expect(body).toEqual({
      photoPath: 'file-2',
      firstName: 'Anna',
      lastName: 'Smith',
      middleName: 'Lee',
      officeAddress: 'Office A',
    });
    expect('email' in body).toBe(false);
  });

  it('maps a blank middle name to null for updates', () => {
    expect(toUpdateReceptionistDto(value({ middleName: '' }), null).middleName).toBeNull();
  });
});
