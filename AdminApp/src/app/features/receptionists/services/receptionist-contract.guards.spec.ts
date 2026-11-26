import { describe, expect, it } from 'vitest';

import { isReceptionistProfile, readReceptionistPage } from './receptionist-contract.guards';

function profile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'r-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    middleName: null,
    officeAddress: '1 Main St',
    photoPath: null,
    ...overrides,
  };
}

describe('isReceptionistProfile', () => {
  it('accepts a complete profile', () => {
    expect(isReceptionistProfile(profile())).toBe(true);
  });

  it('accepts a null office address and normalizes it', () => {
    const value = profile({ officeAddress: null });

    expect(isReceptionistProfile(value)).toBe(true);
    expect((value as { officeAddress: unknown }).officeAddress).toBeNull();
  });

  it('accepts a missing office address and normalizes it to null', () => {
    const value = profile();
    delete value['officeAddress'];

    expect(isReceptionistProfile(value)).toBe(true);
    expect((value as { officeAddress: unknown }).officeAddress).toBeNull();
  });

  it('rejects a non-string office address', () => {
    expect(isReceptionistProfile(profile({ officeAddress: 42 }))).toBe(false);
  });

  it('rejects a profile without an id', () => {
    expect(isReceptionistProfile(profile({ id: '' }))).toBe(false);
  });
});

describe('readReceptionistPage', () => {
  it('reads the nested page with or without receptionist IDs', () => {
    const withoutId = profile({ middleName: 'Byron', officeAddress: null, lastName: null });
    delete withoutId['id'];

    expect(
      readReceptionistPage({
        isSuccess: true,
        data: {
          data: [withoutId, profile({ id: 'r-2' })],
          totalCount: 2,
        },
      }),
    ).toEqual({
      data: [
        { id: null, fullName: 'Ada Byron', officeAddress: null, photoPath: null },
        { id: 'r-2', fullName: 'Ada Lovelace', officeAddress: '1 Main St', photoPath: null },
      ],
      totalCount: 2,
    });
  });

  it('rejects a page with a non-numeric total count', () => {
    expect(() => readReceptionistPage({ data: { data: [profile()], totalCount: '2' } })).toThrow(
      'The API returned an unexpected payload shape.',
    );
  });

  it('rejects a page containing one invalid row', () => {
    expect(() =>
      readReceptionistPage({ data: { data: [profile(), profile({ firstName: '' })], totalCount: 2 } }),
    ).toThrow('The API returned an unexpected payload shape.');
  });
});
