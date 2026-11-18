import { describe, expect, it, vi } from 'vitest';
import {
  HttpContext,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { apiErrorInterceptor, extractErrorMessage } from './api-error.interceptor';
import { SILENT_HTTP_ERROR } from '../tokens/silent-http-error.token';

describe('apiErrorInterceptor', () => {
  const dummyRequest = new HttpRequest('GET', '/api/test');

  it('should pass through successful requests', async () => {
    const next: HttpHandlerFn = () => of({} as any);
    const result = await firstValueFrom(apiErrorInterceptor(dummyRequest, next));
    expect(result).toBeDefined();
  });

  it('should extract correct error message for 409 Conflict', () => {
    const error409 = new HttpErrorResponse({
      status: 409,
      error: { message: 'User with this email already exists' }
    });
    expect(extractErrorMessage(error409)).toBe('User with this email already exists');
  });

  it('should extract correct error message for 401 Unauthorized and 500 Server Error', () => {
    const error401 = new HttpErrorResponse({ status: 401 });
    expect(extractErrorMessage(error401)).toContain('Unauthorized');

    const error500 = new HttpErrorResponse({ status: 500 });
    expect(extractErrorMessage(error500)).toContain('Internal Server Error');
  });

  it('should catch error and rethrow in interceptor', async () => {
    const errorResponse = new HttpErrorResponse({ status: 409, error: { message: 'Conflict' } });
    const next: HttpHandlerFn = () => throwError(() => errorResponse);

    try {
      await firstValueFrom(apiErrorInterceptor(dummyRequest, next));
      expect.fail('Should have thrown an error');
    } catch (err: any) {
      expect(err.status).toBe(409);
    }
  });

  it('logs a handled failure once by default', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const errorResponse = new HttpErrorResponse({ status: 404 });
    const next: HttpHandlerFn = () => throwError(() => errorResponse);

    await expect(firstValueFrom(apiErrorInterceptor(dummyRequest, next))).rejects.toBe(errorResponse);

    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('stays silent for requests marked SILENT_HTTP_ERROR', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const silentRequest = new HttpRequest('GET', '/api/test', null, {
      context: new HttpContext().set(SILENT_HTTP_ERROR, true),
    });
    const errorResponse = new HttpErrorResponse({ status: 404 });
    const next: HttpHandlerFn = () => throwError(() => errorResponse);

    await expect(firstValueFrom(apiErrorInterceptor(silentRequest, next))).rejects.toBe(
      errorResponse
    );

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
