import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideServicesApi } from './api/services-api.provider';
import { provideAppointmentsApiConfiguration } from './api/appointments-api.provider';
import { provideDocumentsApiConfiguration } from './api/documents-api.provider';
import { provideOfficesApiConfiguration } from './api/offices-api.provider';
import { provideProfilesApiConfiguration } from './api/profiles-api.provider';
import { apiErrorInterceptor } from './core/interceptors/api-error.interceptor';
import { authErrorInterceptor } from './core/interceptors/auth-error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { API_BASE_URL } from './core/tokens/api-base-url.token';
import { environment } from '../environments/environment.development';

export { buildGatewayUrlPattern } from './core/utils/gateway-url';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, authErrorInterceptor, apiErrorInterceptor])
    ),
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    provideServicesApi(),
    provideAppointmentsApiConfiguration(),
    provideProfilesApiConfiguration(),
    provideDocumentsApiConfiguration(),
    provideOfficesApiConfiguration(),
  ],
};
