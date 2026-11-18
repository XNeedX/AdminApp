import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { readApiEnvelope } from '../../../api/api-envelope';
import { ScheduleService } from '../../../api/generated/appointments/services/schedule.service';

/** Slot results are reused for this long so revisiting a date does not re-query. */
const SLOTS_TTL_MS = 30_000;

/** Message shown when no candidate doctor could be probed. */
export const SLOT_LOAD_ERROR_MESSAGE = 'Could not load time slots.';

/** Raised when every per-doctor slot request failed. */
export class SlotLoadError extends Error {
  constructor() {
    super(SLOT_LOAD_ERROR_MESSAGE);
    this.name = 'SlotLoadError';
  }
}

interface CacheEntry<T> {
  readonly expiresAt: number;
  readonly value: T;
}

interface SlotProbeResult {
  readonly ok: boolean;
  readonly slots: readonly string[];
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Reads free time slots from the appointments schedule endpoint.
 *
 * Slot labels are the server's `HH:mm` strings: the client never derives a duration or
 * an end time (slot length depends on the service category).
 */
@Injectable({ providedIn: 'root' })
export class AppointmentAvailabilityService {
  private readonly schedule = inject(ScheduleService);
  private readonly slotsCache = new Map<string, CacheEntry<readonly string[]>>();

  /** Free slots for one doctor/service/date, cached for 30 seconds. */
  getSlots(doctorId: string, serviceId: string, date: string): Observable<readonly string[]> {
    if (doctorId.length === 0 || serviceId.length === 0 || date.length === 0) {
      return of<readonly string[]>([]);
    }

    const key = this.slotsKey(doctorId, serviceId, date);
    const cached = this.slotsCache.get(key);

    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    return this.schedule
      .scheduleAvailableTimeSlotsGet({ doctorId, serviceId, date })
      .pipe(
        map((payload) => readApiEnvelope(payload, isStringArray)),
        tap((slots) => {
          this.slotsCache.set(key, {
            expiresAt: Date.now() + SLOTS_TTL_MS,
            value: slots,
          });
        })
      );
  }

  /**
   * Merged free slots of the candidate doctors.
   *
   * Each probe is isolated: one doctor failing must not hide the slots of the others.
   * An error surfaces only when every probe failed, so the caller can distinguish
   * "could not load" from "no free slots". Failed probes are never cached.
   */
  getSlotsForCandidates(
    doctorIds: readonly string[],
    serviceId: string,
    date: string
  ): Observable<readonly string[]> {
    if (doctorIds.length === 0) {
      return of<readonly string[]>([]);
    }

    return forkJoin(
      doctorIds.map((doctorId) =>
        this.getSlots(doctorId, serviceId, date).pipe(
          map((slots): SlotProbeResult => ({ ok: true, slots })),
          catchError(() => of<SlotProbeResult>({ ok: false, slots: [] }))
        )
      )
    ).pipe(
      map((results) => {
        const succeeded = results.filter((result) => result.ok);

        if (succeeded.length === 0) {
          throw new SlotLoadError();
        }

        const slots = new Set<string>();

        for (const result of succeeded) {
          for (const slot of result.slots) {
            slots.add(slot);
          }
        }

        return [...slots].sort((left, right) => left.localeCompare(right));
      })
    );
  }

  /**
   * Doctor ids whose free slots contain `slot`.
   *
   * Availability is probed per candidate doctor; every probe is cached, so selecting a
   * different time does not repeat the requests. A failed probe counts as "not
   * available" instead of failing the whole set.
   */
  getDoctorAvailability(
    doctorIds: readonly string[],
    serviceId: string,
    date: string,
    slot: string
  ): Observable<ReadonlySet<string>> {
    if (doctorIds.length === 0 || serviceId.length === 0 || date.length === 0 || slot.length === 0) {
      return of<ReadonlySet<string>>(new Set<string>());
    }

    return forkJoin(
      doctorIds.map((doctorId) =>
        this.getSlots(doctorId, serviceId, date).pipe(
          map((slots) => ({ doctorId, hasSlot: slots.includes(slot) })),
          catchError(() => of({ doctorId, hasSlot: false }))
        )
      )
    ).pipe(
      map((entries) => {
        const available = new Set<string>();

        for (const entry of entries) {
          if (entry.hasSlot) {
            available.add(entry.doctorId);
          }
        }

        return available;
      })
    );
  }

  /** Drops every cached slot result (used after a rejected booking). */
  invalidate(): void {
    this.slotsCache.clear();
  }

  private slotsKey(doctorId: string, serviceId: string, date: string): string {
    return `${doctorId}|${serviceId}|${date}`;
  }
}
