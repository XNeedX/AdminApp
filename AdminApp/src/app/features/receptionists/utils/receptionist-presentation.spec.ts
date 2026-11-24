import { describe, expect, it } from 'vitest';

import { officeLabel } from './receptionist-presentation';

describe('officeLabel', () => {
  it('returns the address when present', () => {
    expect(officeLabel('1 Main St')).toBe('1 Main St');
  });

  it('returns "Not assigned" for null', () => {
    expect(officeLabel(null)).toBe('Not assigned');
  });

  it('returns "Not assigned" for an empty or whitespace-only string', () => {
    expect(officeLabel('')).toBe('Not assigned');
    expect(officeLabel('   ')).toBe('Not assigned');
  });
});
