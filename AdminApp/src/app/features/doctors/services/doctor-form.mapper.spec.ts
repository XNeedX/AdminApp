import { describe, expect, it } from 'vitest';

import { DoctorFormValue, DoctorStatus } from '../models/doctor-form.model';
import { toCreateDoctorDto, toUpdateDoctorDto } from './doctor-form.mapper';

const VALUE: DoctorFormValue = {
  photo: null,
  firstName: '  John ',
  lastName: ' Doe  ',
  middleName: '   ',
  dateOfBirth: '1980-05-17',
  email: ' john@hospital.org ',
  specializationText: ' Cardiology ',
  specializationId: 'spec-cardiology',
  officeText: ' 1st floor, room 101 ',
  officeId: 'office-1',
  careerStartYear: 2010,
  status: DoctorStatus.AtWork,
};

describe('doctor form mappers', () => {
  it('trims text, maps a blank middle name to null and keeps the catalog labels', () => {
    const dto = toCreateDoctorDto(VALUE, null);

    expect(dto.firstName).toBe('John');
    expect(dto.lastName).toBe('Doe');
    expect(dto.middleName).toBeNull();
    expect(dto.specialization).toBe('Cardiology');
    expect(dto.officeAddress).toBe('1st floor, room 101');
    expect(dto.careerStartYear).toBe(2010);
    expect(dto.dateOfBirth).toBe('1980-05-17');
    expect(dto.status).toBe(DoctorStatus.AtWork);
  });

  it('includes the trimmed email on create only', () => {
    const create = toCreateDoctorDto(VALUE, null);
    const update = toUpdateDoctorDto(VALUE, null);

    expect(create.email).toBe('john@hospital.org');
    expect(Object.prototype.hasOwnProperty.call(update, 'email')).toBe(false);
  });

  it('passes the photo path through unchanged', () => {
    expect(toCreateDoctorDto(VALUE, 'photos/doctor.png').photoPath).toBe('photos/doctor.png');
    expect(toUpdateDoctorDto(VALUE, null).photoPath).toBeNull();
  });

  it('fails loudly instead of fabricating a required value', () => {
    expect(() => toCreateDoctorDto({ ...VALUE, firstName: '   ' }, null)).toThrowError(
      'The first name field is required.'
    );
    expect(() => toUpdateDoctorDto({ ...VALUE, careerStartYear: null }, null)).toThrowError(
      'The career start year field is required.'
    );
  });
});
