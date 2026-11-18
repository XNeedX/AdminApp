import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { DoctorDirectoryEntry } from '../../models/doctor-directory.model';
import { DOCTOR_STATUSES, DoctorStatus } from '../../models/doctor-form.model';
import { DoctorTableComponent } from './doctor-table.component';

function entry(overrides: Partial<DoctorDirectoryEntry> = {}): DoctorDirectoryEntry {
  return {
    id: 'd1',
    fullName: 'Alice Brown',
    specialization: 'Cardiology',
    officeAddress: 'Office A',
    dateOfBirth: '1980-01-01',
    status: DoctorStatus.AtWork,
    isSavingStatus: false,
    ...overrides,
  };
}

describe('DoctorTableComponent', () => {
  let fixture: ComponentFixture<DoctorTableComponent>;
  let component: DoctorTableComponent;

  function render(
    rows: readonly DoctorDirectoryEntry[],
    options: { isLoading?: boolean; loadError?: string | null; canChangeStatus?: boolean } = {}
  ): void {
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('isLoading', options.isLoading ?? false);
    fixture.componentRef.setInput('loadError', options.loadError ?? null);
    fixture.componentRef.setInput('canChangeStatus', options.canChangeStatus ?? true);
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorTableComponent);
    component = fixture.componentInstance;
  });

  it('renders the five columns in order', () => {
    render([entry()]);

    const headers = Array.from(root().querySelectorAll('thead th')).map((header) =>
      header.textContent?.trim()
    );

    expect(headers).toEqual(['Doctor Name', 'Specialization', 'Status', 'Date of Birth', 'Office']);
  });

  it('renders the seven status options and the current value', () => {
    render([entry()]);

    const select = root().querySelector('#doctor-status-d1') as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);

    expect(values).toEqual([...DOCTOR_STATUSES]);
    expect(select.value).toBe(DoctorStatus.AtWork);
  });

  it('disables the status control of the row that is saving', () => {
    render([entry({ isSavingStatus: true })]);

    expect((root().querySelector('#doctor-status-d1') as HTMLSelectElement).disabled).toBe(true);
  });

  it('emits the new status when the user selects a different value', () => {
    const emissions: { id: string; status: DoctorStatus }[] = [];
    component.statusChange.subscribe((event) => emissions.push(event));
    render([entry()]);

    const select = root().querySelector('#doctor-status-d1') as HTMLSelectElement;
    select.value = DoctorStatus.OnVacation;
    select.dispatchEvent(new Event('change'));

    expect(emissions).toEqual([{ id: 'd1', status: DoctorStatus.OnVacation }]);
  });

  it('ignores a change back to the stored status', () => {
    const emissions: { id: string; status: DoctorStatus }[] = [];
    component.statusChange.subscribe((event) => emissions.push(event));
    render([entry()]);

    const select = root().querySelector('#doctor-status-d1') as HTMLSelectElement;
    select.value = DoctorStatus.AtWork;
    select.dispatchEvent(new Event('change'));

    expect(emissions).toEqual([]);
  });

  it('emits profileRequested when the doctor name is clicked', () => {
    const requested: string[] = [];
    component.profileRequested.subscribe((id) => requested.push(id));
    render([entry()]);

    const name = Array.from(root().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Alice Brown'
    );
    name?.click();

    expect(requested).toEqual(['d1']);
  });

  it('renders a loading placeholder instead of the table', () => {
    render([], { isLoading: true });

    expect(root().textContent).toContain('Loading doctors');
    expect(root().querySelector('table')).toBeNull();
  });

  it('renders a retryable error state', () => {
    let retries = 0;
    component.retryRequested.subscribe(() => {
      retries += 1;
    });
    render([entry()], { loadError: 'Gateway is down' });

    expect(root().textContent).toContain('Could not load the doctors list.');
    expect(root().textContent).toContain('Gateway is down');

    Array.from(root().querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Try again')
      ?.click();

    expect(retries).toBe(1);
  });

  it('renders the empty state when nothing matches', () => {
    render([]);

    expect(root().textContent).toContain('No doctors found');
    expect(root().querySelector('table')).toBeNull();
  });
});
