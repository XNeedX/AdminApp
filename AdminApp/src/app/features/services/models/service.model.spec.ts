import { describe, expect, it } from 'vitest';

import {
  ServiceFormValue,
  fromServiceCategory,
  fromServiceStatus,
  toCreateServiceRequest,
  toEditStatusRequest,
  toServiceCategory,
  toServiceStatus,
  toServiceView,
  toUpdateServiceRequest,
} from './service.model';

const SPECIALIZATION_ID = '11111111-1111-1111-1111-111111111111';

function formValue(overrides: Partial<ServiceFormValue> = {}): ServiceFormValue {
  return {
    name: '  Blood test  ',
    price: 12.34,
    category: 'Analyses',
    status: 'Active',
    ...overrides,
  };
}

describe('service model mappers', () => {
  it('maps numeric statuses to business labels', () => {
    expect(toServiceStatus(0)).toBe('Active');
    expect(toServiceStatus(1)).toBe('Inactive');
  });

  it('rejects unknown status values instead of defaulting', () => {
    expect(() => toServiceStatus(2)).toThrow(/Unknown service status/);
  });

  it('maps numeric categories to business labels', () => {
    expect(toServiceCategory(0)).toBe('Analyses');
    expect(toServiceCategory(1)).toBe('Consultations');
    expect(toServiceCategory(2)).toBe('Diagnostics');
  });

  it('rejects unknown category values instead of defaulting', () => {
    expect(() => toServiceCategory(3)).toThrow(/Unknown service category/);
  });

  it('maps business labels back to the API enum values', () => {
    expect(fromServiceStatus('Active')).toBe(0);
    expect(fromServiceStatus('Inactive')).toBe(1);
    expect(fromServiceCategory('Analyses')).toBe(0);
    expect(fromServiceCategory('Consultations')).toBe(1);
    expect(fromServiceCategory('Diagnostics')).toBe(2);
  });

  it('builds a ServiceView from the generated DTO', () => {
    const view = toServiceView({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Blood test',
      price: 10.5,
      category: 1,
      status: 0,
      specializationId: SPECIALIZATION_ID,
    });

    expect(view).toEqual({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Blood test',
      price: 10.5,
      category: 'Consultations',
      status: 'Active',
      specializationId: SPECIALIZATION_ID,
    });
  });

  it('rejects an incomplete service DTO', () => {
    expect(() => toServiceView({})).toThrow(/Services API returned no id/);
  });

  it('builds a create request with a trimmed name and numeric enums', () => {
    const request = toCreateServiceRequest(formValue(), SPECIALIZATION_ID);

    expect(request).toEqual({
      name: 'Blood test',
      price: 12.34,
      category: 0,
      status: 0,
      specializationId: SPECIALIZATION_ID,
    });
  });

  it('builds an update request without the specialization', () => {
    const request = toUpdateServiceRequest(
      formValue({ name: ' MRI ', category: 'Diagnostics', status: 'Inactive' })
    );

    expect(request).toEqual({
      name: 'MRI',
      price: 12.34,
      category: 2,
      status: 1,
    });
  });

  it('builds a status request', () => {
    expect(toEditStatusRequest('Inactive')).toEqual({ status: 1 });
  });
});
