import { Provider } from '@angular/core';

import { environment } from '../../environments/environment.development';
import { provideApiConfiguration } from './generated/services/api-configuration';

/**
 * Points the generated Services API client at the Gateway.
 *
 * The Gateway exposes the Services API under `/services/{everything}` and forwards
 * to the downstream `/api/{everything}`, so the generated `/Service` paths resolve to
 * `http://localhost:5137/services/Service` -> `http://services-api:8080/api/Service`.
 */
export function provideServicesApi(): Provider {
  return provideApiConfiguration(`${environment.apiUrl}/services`);
}
