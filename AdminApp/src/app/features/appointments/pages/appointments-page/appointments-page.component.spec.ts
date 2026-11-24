import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentsService } from '../../../../api/generated/appointments/services/appointments.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AppDialogService } from '../../../../shared/components/app-dialog/app-dialog.service';
import { EMPTY_APPOINTMENT_CATALOGS } from '../../models/appointment-catalog.model';
import { AppointmentFiltersService } from '../../services/appointment-filters.service';
import { AppointmentCatalogService } from '../../services/appointment-catalog.service';
import { AppointmentsFacadeService } from '../../services/appointments-facade.service';
import { todayDateInputValue } from '../../utils/appointment-date';
import { AppointmentsPageComponent } from './appointments-page.component';

interface AppointmentsApiMock {
  readonly appointmentsReceptionistGet: ReturnType<typeof vi.fn>;
  readonly appointmentsIdApprovePatch: ReturnType<typeof vi.fn>;
  readonly appointmentsIdDelete: ReturnType<typeof vi.fn>;
  readonly appointmentsPatientIdPost: ReturnType<typeof vi.fn>;
}

interface DialogMock {
  readonly confirmCancelAppointment: ReturnType<typeof vi.fn>;
}

interface NotificationMock {
  readonly showSuccess: ReturnType<typeof vi.fn>;
  readonly showError: ReturnType<typeof vi.fn>;
}

const ROW = {
  id: 'appt-1',
  startTime: '2026-11-20T09:00:00',
  endTime: '2026-11-20T09:20:00',
  doctorFullName: 'Ivanov Ivan Ivanovich',
  patientFullName: 'Petrov Petr Petrovich',
  patientPhoneNumber: '+10000000000',
  serviceName: 'ECG',
  isApproved: false,
};

function envelope(data: unknown): unknown {
  return { isSuccess: true, message: null, errors: [], data };
}

function textOf(fixture: ComponentFixture<AppointmentsPageComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function buttonByText(
  fixture: ComponentFixture<AppointmentsPageComponent>,
  label: string
): HTMLButtonElement | undefined {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')
  ).find((button) => button.textContent?.trim() === label);
}

async function settle(fixture: ComponentFixture<AppointmentsPageComponent>): Promise<void> {
  fixture.detectChanges();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  fixture.detectChanges();
}

describe('AppointmentsPageComponent', () => {
  let fixture: ComponentFixture<AppointmentsPageComponent>;
  let api: AppointmentsApiMock;
  let dialogs: DialogMock;
  let notifications: NotificationMock;
  let facade: AppointmentsFacadeService;

  beforeEach(async () => {
    api = {
      appointmentsReceptionistGet: vi.fn(() => of(envelope([]))),
      appointmentsIdApprovePatch: vi.fn(() => of(envelope(null))),
      appointmentsIdDelete: vi.fn(() => of(envelope(null))),
      appointmentsPatientIdPost: vi.fn(() => of(envelope(null))),
    };
    dialogs = { confirmCancelAppointment: vi.fn().mockResolvedValue(false) };
    notifications = { showSuccess: vi.fn(), showError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AppointmentsPageComponent],
      providers: [
        AppointmentFiltersService,
        { provide: AppointmentsService, useValue: api },
        { provide: AppointmentCatalogService, useValue: { load: () => of(EMPTY_APPOINTMENT_CATALOGS) } },
        { provide: AppDialogService, useValue: dialogs },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentsPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    facade = TestBed.inject(AppointmentsFacadeService);
  });

  it('keeps the table hidden until Generate is pressed', () => {
    expect(api.appointmentsReceptionistGet).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect(textOf(fixture)).toContain('Choose filters and generate the list.');
  });

  it('generates the list and forwards the current filters', async () => {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope([ROW])));

    buttonByText(fixture, 'Generate')?.click();
    await settle(fixture);

    expect(api.appointmentsReceptionistGet).toHaveBeenCalledTimes(1);
    expect(api.appointmentsReceptionistGet.mock.calls[0]?.[0]).toEqual({
      date: `${todayDateInputValue()}T00:00:00Z`,
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).not.toBeNull();
    expect(textOf(fixture)).toContain('Ivanov Ivan Ivanovich');
  });

  it('reloads the list on a date change without pressing Generate again', async () => {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope([ROW])));

    buttonByText(fixture, 'Generate')?.click();
    await settle(fixture);

    const dateInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#appointment-filter-date'
    );

    expect(dateInput).not.toBeNull();

    if (dateInput !== null) {
      dateInput.value = '2026-11-21';
      dateInput.dispatchEvent(new Event('input'));
    }

    await settle(fixture);

    expect(api.appointmentsReceptionistGet).toHaveBeenCalledTimes(2);
    expect(api.appointmentsReceptionistGet.mock.calls[1]?.[0]).toEqual({
      date: '2026-11-21T00:00:00Z',
    });
  });

  it('forwards combined filters after generation', async () => {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope([ROW])));

    buttonByText(fixture, 'Generate')?.click();
    await settle(fixture);

    const statusSelect = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#appointment-filter-status'
    );

    if (statusSelect !== null) {
      statusSelect.value = 'approved';
      statusSelect.dispatchEvent(new Event('change'));
    }

    await settle(fixture);

    expect(api.appointmentsReceptionistGet).toHaveBeenLastCalledWith({
      date: `${todayDateInputValue()}T00:00:00Z`,
      isApproved: true,
    });
  });

  it('ignores a stale list response', async () => {
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    api.appointmentsReceptionistGet
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());

    buttonByText(fixture, 'Generate')?.click();
    fixture.detectChanges();

    const dateInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#appointment-filter-date'
    );

    if (dateInput !== null) {
      dateInput.value = '2026-11-21';
      dateInput.dispatchEvent(new Event('input'));
    }

    fixture.detectChanges();

    second.next(envelope([{ ...ROW, id: 'fresh', patientFullName: 'Fresh Patient' }]));
    second.complete();
    await settle(fixture);

    first.next(envelope([{ ...ROW, id: 'stale', patientFullName: 'Stale Patient' }]));
    first.complete();
    await settle(fixture);

    expect(textOf(fixture)).toContain('Fresh Patient');
    expect(textOf(fixture)).not.toContain('Stale Patient');
  });

  it('keeps the previous rows and notifies when a reload fails', async () => {
    api.appointmentsReceptionistGet
      .mockReturnValueOnce(of(envelope([ROW])))
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              error: { message: 'Internal Server Error' },
            })
        )
      );

    buttonByText(fixture, 'Generate')?.click();
    await settle(fixture);
    expect(textOf(fixture)).toContain('Ivanov Ivan Ivanovich');

    const dateInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#appointment-filter-date'
    );

    if (dateInput !== null) {
      dateInput.value = '2026-11-21';
      dateInput.dispatchEvent(new Event('input'));
    }

    await settle(fixture);

    expect(textOf(fixture)).toContain('Could not load the appointments list.');
    expect(textOf(fixture)).toContain('Ivanov Ivan Ivanovich');
    expect(notifications.showError).toHaveBeenCalled();
  });

  it('leaves the table untouched when the cancellation dialog answers No', async () => {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope([ROW])));
    const cancelSpy = vi.spyOn(facade, 'cancel');

    buttonByText(fixture, 'Generate')?.click();
    await settle(fixture);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label^="Cancel appointment"]')
      ?.click();
    await settle(fixture);

    expect(dialogs.confirmCancelAppointment).toHaveBeenCalledTimes(1);
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(textOf(fixture)).toContain('Ivanov Ivan Ivanovich');
  });

  it('cancels the appointment when the dialog answers Yes', async () => {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope([ROW])));
    dialogs.confirmCancelAppointment.mockResolvedValue(true);
    const cancelSpy = vi.spyOn(facade, 'cancel');

    buttonByText(fixture, 'Generate')?.click();
    await settle(fixture);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label^="Cancel appointment"]')
      ?.click();
    await settle(fixture);

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(api.appointmentsIdDelete).toHaveBeenCalledWith({ id: ROW.id });
    expect(fixture.nativeElement.querySelector('table')?.textContent).toContain(
      'No appointments found for the selected filters.'
    );
  });

  it('forwards approval to the facade', async () => {
    api.appointmentsReceptionistGet.mockReturnValue(of(envelope([ROW])));
    const approveSpy = vi.spyOn(facade, 'approve');

    buttonByText(fixture, 'Generate')?.click();
    await settle(fixture);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label^="Approve appointment"]')
      ?.click();
    await settle(fixture);

    expect(approveSpy).toHaveBeenCalledTimes(1);
    expect(api.appointmentsIdApprovePatch).toHaveBeenCalledWith({ id: ROW.id });
  });
});
