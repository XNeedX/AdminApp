import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  defaultIfEmpty,
  from,
  map,
  switchMap,
  takeLast,
  throwError,
} from 'rxjs';

import { ServiceService } from '../../../api/generated/services/services/service.service';
import { SpecializationService } from '../../../api/generated/services/services/specialization.service';
import {
  SpecializationFormValue,
  SpecializationServiceFormValue,
  toCreateSpecializationRequest,
  toCreateSpecializationServiceRequest,
  toUpdateSpecializationRequest,
  toUpdateSpecializationServiceRequest,
} from '../models/specialization.model';

/** Progress of a multi-call save, reused on retry so nothing is created twice. */
export interface WriteSessionState {
  readonly specializationId: string | null;
  readonly createdServiceIds: readonly string[];
}

export const EMPTY_WRITE_SESSION: WriteSessionState = {
  specializationId: null,
  createdServiceIds: [],
};

/**
 * Carries the progress reached before a failure.
 *
 * A save spans several API calls, so a failure can happen after the specialization or
 * some services already exist. The caller stores `state` and passes it back on retry so
 * nothing is created twice (FR-017, FR-021, FR-032).
 */
export class SpecializationWriteError extends Error {
  constructor(
    readonly originalError: unknown,
    readonly state: WriteSessionState,
  ) {
    super(
      originalError instanceof Error
        ? originalError.message
        : 'The specialization could not be saved.',
    );
    this.name = 'SpecializationWriteError';
  }
}

/** Returns the saved progress of a failed write, or `null` for an unrelated error. */
export function writeStateFromError(error: unknown): WriteSessionState | null {
  return error instanceof SpecializationWriteError ? error.state : null;
}

/** Unwraps the original API/transport error so its message can be shown to the user. */
export function unwrapWriteError(error: unknown): unknown {
  return error instanceof SpecializationWriteError ? error.originalError : error;
}

interface StoredServiceRow extends SpecializationServiceFormValue {
  readonly id: string;
}

function isStoredServiceRow(row: SpecializationServiceFormValue): row is StoredServiceRow {
  return row.id !== null;
}

/**
 * Application service that composes the generated Services API calls.
 *
 * It is not an HTTP client: it declares no transport types and calls only
 * `SpecializationService` / `ServiceService`. The API has no atomic
 * "specialization + services" operation, so saves are sequenced and progress is kept
 * in `WriteSessionState` so a retry never duplicates records (FR-017, FR-021, FR-032).
 */
@Injectable({ providedIn: 'root' })
export class SpecializationWriterService {
  private readonly specializations = inject(SpecializationService);
  private readonly services = inject(ServiceService);

  /** Creates the specialization when needed, then its services; safe to retry. */
  create(value: SpecializationFormValue, state: WriteSessionState): Observable<WriteSessionState> {
    if (state.specializationId !== null) {
      return this.update(state.specializationId, value, state);
    }

    return this.specializations
      .specializationPost({ body: toCreateSpecializationRequest(value) })
      .pipe(
        switchMap((response) => {
          const id = response.data;

          if (typeof id !== 'string' || id.length === 0) {
            return throwError(
              () => new Error('The API did not return the created specialization identifier.'),
            );
          }

          return this.createMissingServices(value.services, {
            specializationId: id,
            createdServiceIds: state.createdServiceIds,
          });
        }),
      );
  }

  /** Updates the specialization, stored services and any new service rows. */
  update(
    id: string,
    value: SpecializationFormValue,
    state: WriteSessionState,
  ): Observable<WriteSessionState> {
    return this.specializations
      .specializationIdPut({ id, body: toUpdateSpecializationRequest(value) })
      .pipe(
        switchMap(() => this.updateStoredServices(value.services)),
        switchMap(() =>
          this.createMissingServices(value.services, {
            specializationId: id,
            createdServiceIds: state.createdServiceIds,
          }),
        ),
      );
  }

  private updateStoredServices(rows: readonly SpecializationServiceFormValue[]): Observable<void> {
    const stored = rows.filter(isStoredServiceRow);

    return from(stored).pipe(
      concatMap((row) =>
        this.services.serviceIdPut({
          id: row.id,
          body: toUpdateSpecializationServiceRequest(row),
        }),
      ),
      defaultIfEmpty(undefined),
      map(() => undefined),
    );
  }

  private createMissingServices(
    rows: readonly SpecializationServiceFormValue[],
    state: WriteSessionState,
  ): Observable<WriteSessionState> {
    const specializationId = state.specializationId;

    if (specializationId === null) {
      return throwError(
        () => new Error('Cannot create services without a specialization identifier.'),
      );
    }

    const pending = rows.filter(
      (row) => row.id === null && !state.createdServiceIds.includes(row.key),
    );

    let progress: WriteSessionState = state;

    return from(pending).pipe(
      concatMap((row) =>
        this.services
          .servicePost({
            body: toCreateSpecializationServiceRequest(row, specializationId),
          })
          .pipe(
            map((response) => {
              if (typeof response.data !== 'string' || response.data.length === 0) {
                throw new Error('The API did not return the created service identifier.');
              }

              progress = {
                specializationId,
                createdServiceIds: [...progress.createdServiceIds, row.key],
              };

              return progress;
            }),
            catchError((error: unknown) =>
              throwError(() => new SpecializationWriteError(error, progress)),
            ),
          ),
      ),
      takeLast(1),
      defaultIfEmpty(progress),
    );
  }
}
