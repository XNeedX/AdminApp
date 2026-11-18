import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AsyncValidatorFn, FormControl, ValidationErrors } from '@angular/forms';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { accountExistsValidator, ACCOUNT_MISSING_ERROR } from './account-exists.validator';
import {
  AccountExistsLookup,
  createAccountExistsLookup,
} from '../tokens/account-exists-lookup.token';
import { environment } from '../../../environments/environment.development';

async function runValidator(
  validator: AsyncValidatorFn,
  value: string
): Promise<ValidationErrors | null> {
  const result = validator(new FormControl(value));
  return firstValueFrom(result as Observable<ValidationErrors | null>);
}

describe('accountExistsValidator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags an address that is not registered', async () => {
    const validator = accountExistsValidator(() => of(false), 0);

    await expect(runValidator(validator, 'unknown@clinic.com')).resolves.toEqual({
      [ACCOUNT_MISSING_ERROR]: true,
    });
  });

  it('accepts a registered address', async () => {
    const validator = accountExistsValidator(() => of(true), 0);

    await expect(runValidator(validator, 'doc@clinic.com')).resolves.toBeNull();
  });

  it('fails open when the lookup cannot answer', async () => {
    const unknown = accountExistsValidator(() => of(null), 0);
    await expect(runValidator(unknown, 'doc@clinic.com')).resolves.toBeNull();

    const failing = accountExistsValidator(
      () => throwError(() => new Error('network down')),
      0
    );
    await expect(runValidator(failing, 'doc@clinic.com')).resolves.toBeNull();
  });

  it('never calls the lookup for empty or malformed values', async () => {
    const lookup = vi.fn(() => of(false));
    const validator = accountExistsValidator(lookup, 0);

    await expect(runValidator(validator, '')).resolves.toBeNull();
    await expect(runValidator(validator, '   ')).resolves.toBeNull();
    await expect(runValidator(validator, 'not-an-email')).resolves.toBeNull();

    expect(lookup).not.toHaveBeenCalled();
  });

  it('debounces the lookup and trims the address', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const lookup: AccountExistsLookup = (email) => {
      calls.push(email);
      return of(true);
    };
    const validator = accountExistsValidator(lookup, 300);

    const pending = firstValueFrom(
      validator(new FormControl('  doc@clinic.com  ')) as Observable<ValidationErrors | null>
    );

    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(299);
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['doc@clinic.com']);

    await expect(pending).resolves.toBeNull();
  });
});

describe('createAccountExistsLookup', () => {
  let httpMock: HttpTestingController;

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  function createLookup(): AccountExistsLookup {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return createAccountExistsLookup(TestBed.inject(HttpClient), environment.apiUrl);
  }

  it('reports existence from the endpoint payload', async () => {
    const lookup = createLookup();
    const exists = firstValueFrom(lookup('doc@clinic.com'));

    httpMock
      .expectOne(`${environment.apiUrl}/profiles/accounts/exists?email=doc%40clinic.com`)
      .flush({ exists: true });

    await expect(exists).resolves.toBe(true);
  });

  it('reports a non-existent account', async () => {
    const lookup = createLookup();
    const exists = firstValueFrom(lookup('nobody@clinic.com'));

    httpMock
      .expectOne(`${environment.apiUrl}/profiles/accounts/exists?email=nobody%40clinic.com`)
      .flush({ exists: false });

    await expect(exists).resolves.toBe(false);
  });

  it('probes the endpoint once and stops after a 404', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lookup = createLookup();

    const first = firstValueFrom(lookup('doc@clinic.com'));
    httpMock
      .expectOne(`${environment.apiUrl}/profiles/accounts/exists?email=doc%40clinic.com`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    await expect(first).resolves.toBeNull();

    // A second lookup is answered locally; nothing hits the network.
    await expect(firstValueFrom(lookup('other@clinic.com'))).resolves.toBeNull();
    httpMock.expectNone(`${environment.apiUrl}/profiles/accounts/exists?email=other%40clinic.com`);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not disable the endpoint on a transient failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const lookup = createLookup();

    const first = firstValueFrom(lookup('doc@clinic.com'));
    httpMock
      .expectOne(`${environment.apiUrl}/profiles/accounts/exists?email=doc%40clinic.com`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await expect(first).resolves.toBeNull();

    const second = firstValueFrom(lookup('other@clinic.com'));
    httpMock
      .expectOne(`${environment.apiUrl}/profiles/accounts/exists?email=other%40clinic.com`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await expect(second).resolves.toBeNull();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
