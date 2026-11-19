import { Provider } from '@angular/core';

import { environment } from '../../environments/environment.development';
import { provideApiConfiguration } from './generated/offices/api-configuration';

/**
 * Points the generated Offices API client at the Gateway.
 *
 * The Gateway exposes the Offices API under `/offices/{everything}` and forwards
 * to the downstream `/api/{everything}`, so the generated `/Offices` paths resolve to
 * `http://localhost:5137/offices/Offices` -> `http://offices-api:8080/api/Offices`.
 */
export function provideOfficesApiConfiguration(): Provider {
  return provideApiConfiguration(`${environment.apiUrl}/offices`);
}
