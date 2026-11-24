import { HttpContext } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { SKIP_AUTH_REDIRECT } from './skip-auth-redirect.token';

describe('SKIP_AUTH_REDIRECT', () => {
  it('defaults to false so ordinary requests stay session-bearing', () => {
    expect(new HttpContext().get(SKIP_AUTH_REDIRECT)).toBe(false);
  });

  it('reads the explicit opt-out value from a request context', () => {
    const context = new HttpContext().set(SKIP_AUTH_REDIRECT, true);

    expect(context.get(SKIP_AUTH_REDIRECT)).toBe(true);
  });
});
