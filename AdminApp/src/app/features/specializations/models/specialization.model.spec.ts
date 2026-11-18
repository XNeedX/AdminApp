import { describe, expect, it } from 'vitest';

import { Category } from '../../../api/generated/services/models/category';
import { Status } from '../../../api/generated/services/models/status';
import {
  SpecializationFormValue,
  SpecializationListRow,
  fromServiceCategory,
  fromSpecializationStatus,
  sortBySpecializationName,
  toCreateSpecializationRequest,
  toCreateSpecializationServiceRequest,
  toServiceCategory,
  toSpecializationListRows,
  toSpecializationStatus,
  toSpecializationView,
} from './specialization.model';

const ID = '11111111-1111-1111-1111-111111111111';

function formValue(): SpecializationFormValue {
  return {
    name: 'Cardiology',
    status: 'Active',
    services: [
      {
        key: 'row-1',
        id: null,
        name: 'Blood test',
        price: 12.5,
        status: 'Active',
        category: 'Analyses',
      },
    ],
  };
}

describe('specialization model', () => {
  it('maps the generated status enum both ways', () => {
    expect(toSpecializationStatus(Status.Active)).toBe('Active');
    expect(toSpecializationStatus(Status.Inactive)).toBe('Inactive');
    expect(fromSpecializationStatus('Active')).toBe(Status.Active);
    expect(fromSpecializationStatus('Inactive')).toBe(Status.Inactive);
  });

  it('maps the generated category enum both ways', () => {
    expect(toServiceCategory(Category.Analyses)).toBe('Analyses');
    expect(toServiceCategory(Category.Consultations)).toBe('Consultations');
    expect(toServiceCategory(Category.Diagnostics)).toBe('Diagnostics');
    expect(fromServiceCategory('Analyses')).toBe(Category.Analyses);
    expect(fromServiceCategory('Consultations')).toBe(Category.Consultations);
    expect(fromServiceCategory('Diagnostics')).toBe(Category.Diagnostics);
  });

  it('rejects unknown enum values instead of rendering undefined', () => {
    expect(() => toSpecializationStatus(99)).toThrow();
    expect(() => toServiceCategory(99)).toThrow();
  });

  it('rejects incomplete list payloads', () => {
    expect(() => toSpecializationListRows([{ id: ID, name: '   ', status: 0 }])).toThrow();
    expect(() => toSpecializationListRows([{ name: 'Cardiology', status: 0 }])).toThrow();
  });

  it('maps list rows and trims names', () => {
    const rows = toSpecializationListRows([{ id: ID, name: '  Cardiology  ', status: 1 }]);

    expect(rows).toEqual([{ id: ID, name: 'Cardiology', status: 'Inactive' }]);
  });

  it('sorts rows case-insensitively by name', () => {
    const rows: SpecializationListRow[] = [
      { id: '2', name: 'neurology', status: 'Active' },
      { id: '1', name: 'Cardiology', status: 'Active' },
    ];

    expect(sortBySpecializationName(rows).map((row) => row.name)).toEqual([
      'Cardiology',
      'neurology',
    ]);
  });

  it('maps a detail payload, including services and inactive ones', () => {
    const view = toSpecializationView({
      id: ID,
      name: 'Cardiology',
      status: 1,
      services: [{ id: 's1', name: 'Blood test', price: 12.5, category: 0, status: 1 }],
    });

    expect(view.status).toBe('Inactive');
    expect(view.services).toEqual([
      {
        id: 's1',
        name: 'Blood test',
        price: 12.5,
        status: 'Inactive',
        category: 'Analyses',
      },
    ]);
  });

  it('treats a missing services array as an empty list', () => {
    const view = toSpecializationView({ id: ID, name: 'Cardiology', status: 0 });

    expect(view.services).toEqual([]);
  });

  it('rejects incomplete service rows', () => {
    expect(() =>
      toSpecializationView({
        id: ID,
        name: 'Cardiology',
        status: 0,
        services: [{ name: 'Blood test', price: 12.5, category: 0, status: 0 }],
      }),
    ).toThrow();
  });

  it('builds create/update payloads without fabrication of price or category', () => {
    const payload = toCreateSpecializationRequest(formValue());

    expect(payload).toEqual({ name: 'Cardiology', status: Status.Active });
    expect('price' in payload).toBe(false);
    expect('category' in payload).toBe(false);
  });

  it('builds service payloads with specializationId for new rows', () => {
    const value = formValue();
    const row = value.services[0];

    expect(row).toBeDefined();

    if (row === undefined) {
      return;
    }

    const payload = toCreateSpecializationServiceRequest(row, ID);

    expect(payload).toEqual({
      name: 'Blood test',
      price: 12.5,
      category: Category.Analyses,
      status: Status.Active,
      specializationId: ID,
    });
  });
});
