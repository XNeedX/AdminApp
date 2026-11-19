import { Provider } from '@angular/core';

import { environment } from '../../environments/environment.development';
import { provideApiConfiguration } from './generated/documents/api-configuration';

/**
 * Points the generated Documents API client at the Gateway.
 *
 * The Gateway exposes the Documents API under `/documents/{everything}` and forwards
 * to the downstream `/api/{everything}`, so the generated `/Documents` paths resolve to
 * `http://localhost:5137/documents/Documents` -> `http://documents-api:8080/api/Documents`.
 */
export function provideDocumentsApiConfiguration(): Provider {
  return provideApiConfiguration(`${environment.apiUrl}/documents`);
}
