import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../../../../core/services/notification.service';
import {
  AppConfirmDialogComponent,
  AppConfirmDialogData,
} from '../../../../shared/components/app-dialog/app-confirm-dialog.component';
import {
  AppDialogService,
  EXIT_APPOINTMENT_MESSAGE,
} from '../../../../shared/components/app-dialog/app-dialog.service';
import { DoctorStatus } from '../../../doctors/models/doctor-form.model';
import { AppointmentCatalogs } from '../../models/appointment-catalog.model';
import { AppointmentAvailabilityService } from '../../services/appointment-availability.service';
import { AppointmentCatalogService } from '../../services/appointment-catalog.service';
import { AppointmentFormStore } from '../../services/appointment-form.store';
import { AppointmentsFacadeService } from '../../services/appointments-facade.service';
import { todayDateInputValue } from '../../utils/appointment-date';
import { AppointmentCreateModalComponent } from './appointment-create-modal.component';

const TEST_DATE = todayDateInputValue();

const CATALOGS: AppointmentCatalogs = {
  patients: [{ id: 'pat-1', fullName: 'Petrov Petr Petrovich', phoneNumber: '+10000000000' }],
  specializations: [{ id: 'spec-1', name: 'Cardiology' }],
  services: [{ id: 'svc-1', name: 'ECG', specializationId: 'spec-1' }],
  doctors: [
    {
      id: 'doc-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      middleName: null,
      fullName: 'Ivan Ivanov',
      specializationId: 'spec-1',
      specializationName: 'Cardiology',
      officeId: 'office-1',
      officeAddress: '1 Main St',
      status: DoctorStatus.AtWork,
    },
  ],
  offices: [{ id: 'office-1', address: '1 Main St', displayName: '1 Main St' }],
  schedulableServiceIds: new Set(['svc-1']),
};

interface CatalogMock {
  readonly load: ReturnType<typeof vi.fn>;
}

interface AvailabilityMock {
  readonly getSlots: ReturnType<typeof vi.fn>;
  readonly getSlotsForCandidates: ReturnType<typeof vi.fn>;
  readonly getAvailableDates: ReturnType<typeof vi.fn>;
  readonly getDoctorAvailability: ReturnType<typeof vi.fn>;
  readonly invalidate: ReturnType<typeof vi.fn>;
}

interface FacadeMock {
  readonly reschedule: ReturnType<typeof vi.fn>;
  readonly create: ReturnType<typeof vi.fn>;
}

interface DialogMock {
  readonly confirm: ReturnType<typeof vi.fn>;
  readonly confirmExit: ReturnType<typeof vi.fn>;
}

interface NotificationMock {
  readonly showSuccess: ReturnType<typeof vi.fn>;
  readonly showError: ReturnType<typeof vi.fn>;
}

describe('AppointmentCreateModalComponent', () => {
  let fixture: ComponentFixture<AppointmentCreateModalComponent>;
  let component: AppointmentCreateModalComponent;
  let store: AppointmentFormStore;
  let catalogsApi: CatalogMock;
  let availability: AvailabilityMock;
  let facade: FacadeMock;
  let dialogs: DialogMock;
  let notifications: NotificationMock;

  beforeEach(async () => {
    catalogsApi = { load: vi.fn(() => of(CATALOGS)) };
    availability = {
      getSlots: vi.fn(() => of(['09:00', '10:00'])),
      getSlotsForCandidates: vi.fn(() => of(['09:00', '10:00'])),
      getAvailableDates: vi.fn(() => of(new Set([TEST_DATE]))),
      getDoctorAvailability: vi.fn(() => of(new Set<string>(['doc-1']))),
      invalidate: vi.fn(),
    };
    facade = {
      create: vi.fn().mockResolvedValue({ kind: 'created' }),
      reschedule: vi.fn().mockResolvedValue({ kind: 'created' }),
    };
    dialogs = { confirm: vi.fn().mockResolvedValue(false), confirmExit: vi.fn().mockResolvedValue(false) };
    notifications = { showSuccess: vi.fn(), showError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AppointmentCreateModalComponent],
      providers: [
        { provide: AppointmentCatalogService, useValue: catalogsApi },
        { provide: AppointmentAvailabilityService, useValue: availability },
        { provide: AppointmentsFacadeService, useValue: facade },
        { provide: AppDialogService, useValue: dialogs },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentCreateModalComponent);
    fixture.detectChanges();
    component = fixture.componentInstance;
    store = fixture.debugElement.injector.get(AppointmentFormStore);
  });

  function query<T extends Element>(selector: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function buttonByText(label: string): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')
    ).find((button) => button.textContent?.trim() === label);
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    fixture.detectChanges();
  }

  /** Waits past the 250 ms slot-query debounce. */
  async function settleSlots(): Promise<void> {
    fixture.detectChanges();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 350);
    });
    fixture.detectChanges();
  }

  async function completeForm(): Promise<void> {
    store.selectOption('specialization', { id: 'spec-1', label: 'Cardiology' });
    fixture.detectChanges();
    store.selectOption('service', { id: 'svc-1', label: 'ECG' });
    fixture.detectChanges();
    store.selectOption('doctor', { id: 'doc-1', label: 'Ivan Ivanov' });
    fixture.detectChanges();
    store.selectOption('patient', { id: 'pat-1', label: 'Petrov Petr Petrovich' });
    fixture.detectChanges();
    store.setDate(TEST_DATE);
    await settleSlots();
    store.selectSlot('09:00');
    fixture.detectChanges();
  }

  it('renders every field and action required by AC-2', () => {
    expect(query('#appointment-patient')).not.toBeNull();
    expect(query('#appointment-specialization')).not.toBeNull();
    expect(query('#appointment-doctor')).not.toBeNull();
    expect(query('#appointment-service')).not.toBeNull();
    expect(query('#appointment-office')).not.toBeNull();
    expect(query('#appointment-date')).not.toBeNull();
    expect(buttonByText('Create patient')).not.toBeUndefined();
    expect(buttonByText('Confirm')).not.toBeUndefined();
    expect(query('button[aria-label="Close"]')).not.toBeNull();
  });

  it('starts empty with the date and Confirm disabled', () => {
    expect(query<HTMLInputElement>('#appointment-date')?.disabled).toBe(true);
    expect(buttonByText('Confirm')?.disabled).toBe(true);
    expect(store.confirmEnabled()).toBe(false);
    expect(text()).toContain('Choose the specialization, the service and the date');
  });

  it('shows the mandated patient validation messages', () => {
    store.markTouched('patient');
    fixture.detectChanges();

    expect(text()).toContain('Please, choose the patient');

    store.setText('patient', 'Unknown Person');
    store.markTouched('patient');
    fixture.detectChanges();

    expect(text()).toContain('Invalid patient name');
  });

  it('enables the date only when the specialization and the service are set', () => {
    store.selectOption('specialization', { id: 'spec-1', label: 'Cardiology' });
    fixture.detectChanges();

    expect(query<HTMLInputElement>('#appointment-date')?.disabled).toBe(true);

    store.selectOption('service', { id: 'svc-1', label: 'ECG' });
    fixture.detectChanges();

    expect(query<HTMLInputElement>('#appointment-date')?.disabled).toBe(false);
  });

  it('selects an offered date and auto-fills the only doctor free at the chosen time', async () => {
    store.selectOption('service', { id: 'svc-1', label: 'ECG' });
    fixture.detectChanges();
    query<HTMLButtonElement>('#appointment-date')?.click();
    await settle();

    const date = query<HTMLButtonElement>('button[aria-label="' + TEST_DATE + '"]');
    expect(date?.disabled).toBe(false);
    expect(query('#appointment-calendar button[aria-pressed][disabled]')).not.toBeNull();
    date?.click();
    await settleSlots();

    buttonByText('09:00')?.click();
    await settleSlots();

    expect(store.value()).toMatchObject({ date: TEST_DATE, timeSlot: '09:00', doctorId: 'doc-1' });
    expect(availability.getDoctorAvailability).toHaveBeenCalledWith(
      ['doc-1'], 'svc-1', TEST_DATE, '09:00', undefined
    );
  });

  it('validates doctor, date and time on blur', async () => {
    store.selectOption('service', { id: 'svc-1', label: 'ECG' });
    fixture.detectChanges();

    query('#appointment-doctor')?.dispatchEvent(new FocusEvent('blur'));
    query('#appointment-date')?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
    expect(text()).toContain('Please, choose the doctor');
    expect(text()).toContain('Please, select the date');

    store.setText('doctor', 'Someone else');
    store.setDate(TEST_DATE);
    await settleSlots();
    query('[aria-labelledby="appointment-slots-label"]')?.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true })
    );
    fixture.detectChanges();
    expect(text()).toContain('Invalid doctor name');
    expect(text()).toContain('Please, select the time slot');
  });

  it('locks the existing booking details, preserves changes on No and sends the updated slot', async () => {
    const rescheduleFixture = TestBed.createComponent(AppointmentCreateModalComponent);
    rescheduleFixture.componentRef.setInput('appointment', {
      id: 'appt-1',
      startTime: TEST_DATE + 'T06:00:00Z',
      patientFullName: CATALOGS.patients[0]?.fullName,
      doctorFullName: CATALOGS.doctors[0]?.fullName,
      serviceName: 'ECG',
      booking: { patientId: 'pat-1', doctorId: 'doc-1', serviceId: 'svc-1', officeId: 'office-1', date: TEST_DATE },
    });
    fixture = rescheduleFixture;
    fixture.detectChanges();
    await settleSlots();

    for (const field of ['patient', 'specialization', 'service', 'office']) {
      expect(query<HTMLInputElement>('#appointment-' + field)?.disabled).toBe(true);
    }
    expect(query<HTMLInputElement>('#appointment-doctor')?.disabled).toBe(false);
    expect(availability.getSlots).toHaveBeenCalledWith('doc-1', 'svc-1', TEST_DATE, 'appt-1');

    buttonByText('10:00')?.click();
    fixture.detectChanges();
    buttonByText('Cancel')?.click();
    await settle();
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Do you really want to cancel? Entered data won\u2019t be saved.',
      confirmText: 'Yes',
      cancelText: 'No',
    }));
    expect(buttonByText('10:00')?.getAttribute('aria-pressed')).toBe('true');

    buttonByText('Confirm')?.click();
    await settle();
    expect(facade.reschedule).toHaveBeenCalledWith('appt-1', expect.objectContaining({
      doctorId: 'doc-1', date: TEST_DATE, timeSlot: '10:00',
    }));
    expect(facade.create).not.toHaveBeenCalled();
  });

  it('opens the exit dialog and preserves the values when the answer is No', async () => {
    store.selectOption('specialization', { id: 'spec-1', label: 'Cardiology' });
    fixture.detectChanges();
    const closed = vi.fn();
    component.closed.subscribe(closed);

    dialogs.confirmExit.mockResolvedValue(false);
    query<HTMLButtonElement>('button[aria-label="Close"]')?.click();
    await settle();

    expect(dialogs.confirmExit).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
    expect(store.value().specializationId).toBe('spec-1');
    expect(query('app-dialog')).not.toBeNull();
  });

  it('closes without saving when the exit dialog answers Yes', async () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);

    dialogs.confirmExit.mockResolvedValue(true);
    query<HTMLButtonElement>('button[aria-label="Close"]')?.click();
    await settle();

    expect(closed).toHaveBeenCalledTimes(1);
    expect(facade.create).not.toHaveBeenCalled();
  });

  it('keeps the modal open with all values when creation fails', async () => {
    await completeForm();
    expect(store.confirmEnabled()).toBe(true);

    facade.create.mockResolvedValue({ kind: 'failed', message: 'Booking failed' });
    const closed = vi.fn();
    component.closed.subscribe(closed);

    buttonByText('Confirm')?.click();
    await settle();

    expect(facade.create).toHaveBeenCalledTimes(1);
    expect(facade.create.mock.calls[0]?.[0]).toMatchObject({
      patientId: 'pat-1',
      doctorId: 'doc-1',
      serviceId: 'svc-1',
      officeId: 'office-1',
      date: TEST_DATE,
      timeSlot: '09:00',
    });
    expect(notifications.showError).toHaveBeenCalledWith('Booking failed');
    expect(closed).not.toHaveBeenCalled();
    expect(store.value().doctorId).toBe('doc-1');
    expect(query('app-dialog')).not.toBeNull();
  });

  it('emits created and closed after a successful creation', async () => {
    await completeForm();
    const created = vi.fn();
    const closed = vi.fn();
    component.created.subscribe(created);
    component.closed.subscribe(closed);

    buttonByText('Confirm')?.click();
    await settle();

    expect(created).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('queries the schedule with the selected service id', async () => {
    store.selectOption('specialization', { id: 'spec-1', label: 'Cardiology' });
    store.selectOption('service', { id: 'svc-1', label: 'ECG' });
    store.selectOption('doctor', { id: 'doc-1', label: 'Ivan Ivanov' });
    store.setDate(TEST_DATE);
    await settleSlots();

    expect(availability.getSlots).toHaveBeenCalledWith('doc-1', 'svc-1', TEST_DATE, undefined);
  });

  it('explains that the selected service cannot be scheduled instead of claiming an empty date', async () => {
    store.setCatalogs({ ...CATALOGS, schedulableServiceIds: new Set<string>() });
    store.selectOption('specialization', { id: 'spec-1', label: 'Cardiology' });
    store.selectOption('service', { id: 'svc-1', label: 'ECG' });
    store.setDate(TEST_DATE);
    await settleSlots();

    expect(text()).toContain(
      'The selected service is not available for scheduling. Please contact an administrator.'
    );
    expect(text()).not.toContain('No available time slots for the selected date.');
    expect(availability.getSlots).not.toHaveBeenCalled();
  });

  it('shows a retryable error instead of an empty date when the slot request fails', async () => {
    availability.getSlots.mockReturnValue(throwError(() => new Error('offline')));

    store.selectOption('specialization', { id: 'spec-1', label: 'Cardiology' });
    store.selectOption('service', { id: 'svc-1', label: 'ECG' });
    store.selectOption('doctor', { id: 'doc-1', label: 'Ivan Ivanov' });
    store.setDate(TEST_DATE);
    await settleSlots();

    expect(text()).toContain('Could not load time slots.');
    expect(text()).not.toContain('No available time slots for the selected date.');
    expect(notifications.showError).toHaveBeenCalledTimes(1);

    availability.getSlots.mockReturnValue(of(['09:00']));
    buttonByText('Try again')?.click();
    await settleSlots();

    expect(text()).not.toContain('Could not load time slots.');
    expect(buttonByText('09:00')).not.toBeUndefined();
  });
});

describe('appointment exit confirmation copy', () => {
  it('renders the exact message from the UI contract', async () => {
    const data: AppConfirmDialogData = {
      title: 'Exit',
      message: EXIT_APPOINTMENT_MESSAGE,
      confirmText: 'Yes',
      cancelText: 'No',
    };

    await TestBed.configureTestingModule({
      imports: [AppConfirmDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    const dialogFixture = TestBed.createComponent(AppConfirmDialogComponent);
    dialogFixture.detectChanges();

    expect((dialogFixture.nativeElement as HTMLElement).textContent).toContain(
      'Do you really want to exit? Appointment will not be saved.'
    );
  });
});
