import { HttpContextToken } from '@angular/common/http';

/**
 * Marks an HTTP request whose failure is expected and already handled by the caller
 * (a documented fail-open path, e.g. a not-yet-implemented Profiles endpoint).
 *
 * `apiErrorInterceptor` stays silent for these requests so the shared logger does not
 * duplicate the caller's own one-time `console.warn` with a red `[API Error …]` line.
 */
export const SILENT_HTTP_ERROR = new HttpContextToken<boolean>(() => false);
