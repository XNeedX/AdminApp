import { describe, expect, it } from 'vitest';

import { isPagedReceptionistRows, isReceptionistProfile } from './receptionist-contract.guards';

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

describe('isPagedReceptionistRows', () => {
  it('accepts a page whose rows have a null office address', () => {
    expect(
      isPagedReceptionistRows({
        data: [profile({ officeAddress: null }), profile({ id: 'r-2' })],
        totalCount: 2,
      })
    ).toBe(true);
  });

  it('rejects a page with a non-numeric total count', () => {
    expect(isPagedReceptionistRows({ data: [profile()], totalCount: '2' })).toBe(false);
  });

  it('rejects a page containing one invalid row', () => {
    expect(
      isPagedReceptionistRows({ data: [profile(), profile({ firstName: '' })], totalCount: 2 })
    ).toBe(false);
  });
});
