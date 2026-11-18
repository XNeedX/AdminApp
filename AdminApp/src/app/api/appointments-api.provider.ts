import { Provider } from '@angular/core';

import { environment } from '../../environments/environment.development';
import { provideApiConfiguration } from './generated/appointments/api-configuration';

/**
 * Points the generated Appointments API client at the Gateway.
 *
 * The Gateway exposes the Appointments API under `/appointments/{everything}` and forwards
 * to the downstream `/api/{everything}`, so the generated `/Appointments` paths resolve to
 * `http://localhost:5137/appointments/Appointments` -> `http://appointments-api:8080/api/Appointments`.
 */
export function provideAppointmentsApiConfiguration(): Provider {
  return provideApiConfiguration(`${environment.apiUrl}/appointments`);
}
