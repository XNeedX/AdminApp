import { describe, expect, it } from 'vitest';
import { buildGatewayUrlPattern } from './app.config';
import { environment } from '../environments/environment.development';

describe('buildGatewayUrlPattern', () => {
  const pattern = buildGatewayUrlPattern(environment.apiUrl);

  it('matches the Gateway base URL and every path under it', () => {
    expect(pattern.test(environment.apiUrl)).toBe(true);
    expect(pattern.test(`${environment.apiUrl}/`)).toBe(true);
    expect(
      pattern.test(`${environment.apiUrl}/services/specialization?Page=1&PageSize=50`)
    ).toBe(true);
    expect(pattern.test(`${environment.apiUrl}/offices/offices?Page=1&PageSize=50`)).toBe(true);
  });

  it('does not match external origins or lookalike hosts', () => {
    expect(pattern.test('http://localhost:8080/realms/InnoClinic')).toBe(false);
    expect(pattern.test('http://localhost:51370/offices/offices')).toBe(false);
    expect(pattern.test('http://example.com')).toBe(false);
  });

  it('escapes regex metacharacters in the base URL', () => {
    const portPattern = buildGatewayUrlPattern('http://localhost:5137?');
    expect(portPattern.test('http://localhost:5137x/offices')).toBe(false);
    expect(portPattern.test('http://localhost:5137?/offices')).toBe(true);
  });
});
