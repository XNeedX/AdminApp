import { Provider } from '@angular/core';

import { environment } from '../../environments/environment.development';
import { provideApiConfiguration } from './generated/profiles/api-configuration';

/**
 * Points the generated Profiles API client at the Gateway.
 *
 * The Gateway exposes the Profiles API under `/profiles/{everything}` and forwards
 * to the downstream `/api/{everything}`, so the generated `/Doctors` paths resolve to
 * `http://localhost:5137/profiles/Doctors` -> `http://profiles-api:8080/api/Doctors`.
 */
export function provideProfilesApiConfiguration(): Provider {
  return provideApiConfiguration(`${environment.apiUrl}/profiles`);
}
