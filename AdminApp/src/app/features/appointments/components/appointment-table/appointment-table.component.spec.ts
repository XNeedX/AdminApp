import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppointmentRow } from '../../models/appointment.model';
import { AppointmentTableComponent } from './appointment-table.component';

function makeRow(overrides: Partial<AppointmentRow> & { readonly id: string }): AppointmentRow {
  return {
    startTime: '2026-11-20T11:00:00',
    endTime: '2026-11-20T11:20:00',
    timeRangeLabel: '11:00 - 11:20',
    doctorFullName: 'Ivanov Ivan Ivanovich',
    patientFullName: 'Petrov Petr Petrovich',
    patientPhoneNumber: '+10000000000',
    serviceName: 'ECG',
    isApproved: false,
    officeId: null,
    isApproving: false,
    isDeleting: false,
    ...overrides,
  };
}

function textOf(fixture: ComponentFixture<AppointmentTableComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function buttons(fixture: ComponentFixture<AppointmentTableComponent>): HTMLButtonElement[] {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('tbody button')
  );
}

describe('AppointmentTableComponent', () => {
  let fixture: ComponentFixture<AppointmentTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppointmentTableComponent] }).compileComponents();

    fixture = TestBed.createComponent(AppointmentTableComponent);
  });

  function render(options: {
    readonly rows: readonly AppointmentRow[];
    readonly hasGenerated?: boolean;
    readonly isLoading?: boolean;
    readonly loadError?: string | null;
  }): void {
    fixture.componentRef.setInput('rows', options.rows);
    fixture.componentRef.setInput('hasGenerated', options.hasGenerated ?? true);
    fixture.componentRef.setInput('isLoading', options.isLoading ?? false);
    fixture.componentRef.setInput('loadError', options.loadError ?? null);
    fixture.detectChanges();
  }

  it('renders the required column headers', () => {
    render({ rows: [makeRow({ id: 'appt-1' })] });

    const headers = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('thead th')
    ).map((header) => header.textContent?.trim());

    expect(headers).toEqual(['Time', 'Doctor', 'Patient', 'Phone', 'Service', 'Actions']);
  });

  it('renders the time range label and the row data', () => {
    render({ rows: [makeRow({ id: 'appt-1' })] });

    const text = textOf(fixture);

    expect(text).toContain('11:00 - 11:20');
    expect(text).toContain('Ivanov Ivan Ivanovich');
    expect(text).toContain('Petrov Petr Petrovich');
    expect(text).toContain('+10000000000');
    expect(text).toContain('ECG');
  });

  it('renders Approve, Cancel and Reschedule actions for every row', () => {
    render({ rows: [makeRow({ id: 'appt-1' }), makeRow({ id: 'appt-2' })] });

    expect(buttons(fixture)).toHaveLength(6);

    const approve = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label^="Approve appointment"]'
    );
    const cancel = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label^="Cancel appointment"]'
    );

    expect(approve?.disabled).toBe(false);
    expect(cancel?.disabled).toBe(false);
  });

  it('keeps Reschedule disabled with a tooltip', () => {
    render({ rows: [makeRow({ id: 'appt-1' })] });

    const reschedule = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[title="Reschedule is not available yet"]'
    );

    expect(reschedule).not.toBeNull();
    expect(reschedule?.disabled).toBe(true);
    expect(reschedule?.getAttribute('aria-disabled')).toBe('true');
  });

  it('highlights approved rows and disables their Approve button', () => {
    render({ rows: [makeRow({ id: 'appt-1', isApproved: true })] });

    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    const approve = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label^="Approve appointment"]'
    );

    expect(row?.classList.contains('bg-emerald-50')).toBe(true);
    expect(row?.textContent).toContain('Approved');
    expect(approve?.disabled).toBe(true);
  });

  it('shows the not-generated empty state', () => {
    render({ rows: [], hasGenerated: false });

    expect(textOf(fixture)).toContain('Choose filters and generate the list.');
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
  });

  it('shows the no-matches empty state after generation', () => {
    render({ rows: [], hasGenerated: true });

    expect(textOf(fixture)).toContain('No appointments found for the selected filters.');
  });

  it('shows the loading state instead of rows', () => {
    render({ rows: [makeRow({ id: 'appt-1' })], isLoading: true });

    expect(textOf(fixture)).toContain('Loading appointments…');
  });

  it('shows the load error and still renders the kept rows', () => {
    render({
      rows: [makeRow({ id: 'appt-1' })],
      loadError: 'Internal Server Error',
    });

    const text = textOf(fixture);

    expect(text).toContain('Could not load the appointments list.');
    expect(text).toContain('Internal Server Error');
    expect(text).toContain('Ivanov Ivan Ivanovich');
  });

  it('emits approve and cancel for the clicked row', () => {
    render({ rows: [makeRow({ id: 'appt-1' })] });

    const approveSpy = vi.fn();
    const cancelSpy = vi.fn();
    fixture.componentInstance.approve.subscribe(approveSpy);
    fixture.componentInstance.cancel.subscribe(cancelSpy);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label^="Approve appointment"]')
      ?.click();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label^="Cancel appointment"]')
      ?.click();

    expect(approveSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(approveSpy.mock.calls[0]?.[0]).toMatchObject({ id: 'appt-1' });
  });
});
