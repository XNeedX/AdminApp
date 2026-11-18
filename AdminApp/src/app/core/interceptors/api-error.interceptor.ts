import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { SILENT_HTTP_ERROR } from '../tokens/silent-http-error.token';

export interface ApiErrorMessage {
  status: number;
  message: string;
}

export function extractErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 409) {
    return error.error?.message || error.error || 'User with this email already exists';
  }
  if (error.status === 401) {
    return 'Unauthorized: Please check your authentication credentials.';
  }
  if (error.status === 403) {
    return 'Forbidden: You do not have permissions to perform this action.';
  }
  if (error.status >= 500) {
    return 'Internal Server Error: A backend microservice error occurred. Please try again later.';
  }
  if (error.error?.message) {
    return error.error.message;
  }
  return error.message || 'An unexpected error occurred.';
}

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!req.context.get(SILENT_HTTP_ERROR)) {
        const formattedMessage = extractErrorMessage(error);
        console.error(`[API Error ${error.status}]:`, formattedMessage);
      }
      return throwError(() => error);
    })
  );
};
