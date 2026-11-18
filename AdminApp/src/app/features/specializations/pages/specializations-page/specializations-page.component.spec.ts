import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Subject, of, throwError } from 'rxjs';

import { SpecializationService } from '../../../../api/generated/services/services/specialization.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SpecializationCreateDialogComponent } from '../../dialogs/specialization-create-dialog/specialization-create-dialog.component';
import { SpecializationsPageComponent } from './specializations-page.component';

const FIRST_ID = '11111111-1111-1111-1111-111111111111';
const SECOND_ID = '22222222-2222-2222-2222-222222222222';

interface ListItem {
  id?: string;
  name?: string;
  status?: number;
}

function success(items: ListItem[]) {
  return { isSuccess: true, data: { items, totalCount: items.length } };
}

describe('SpecializationsPageComponent', () => {
  let fixture: ComponentFixture<SpecializationsPageComponent>;
  let component: SpecializationsPageComponent;

  const specializationGet = vi.fn();
  const specializationIdStatusPatch = vi.fn();
  const open = vi.fn();
  const navigate = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  beforeEach(async () => {
    specializationGet.mockReset();
    specializationIdStatusPatch.mockReset();
    open.mockReset();
    navigate.mockReset();
    showSuccess.mockReset();
    showError.mockReset();

    specializationGet.mockReturnValue(
      of(
        success([
          { id: SECOND_ID, name: 'Neurology', status: 0 },
          { id: FIRST_ID, name: 'Cardiology', status: 0 },
        ]),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [SpecializationsPageComponent],
      providers: [
        {
          provide: SpecializationService,
          useValue: { specializationGet, specializationIdStatusPatch },
        },
        { provide: Dialog, useValue: { open } },
        { provide: Router, useValue: { navigate } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpecializationsPageComponent);
    component = fixture.componentInstance;
  });

  function render(): void {
    fixture.detectChanges();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function buttonByText(label: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === label,
    );
  }

  it('loads the list with the full page size and sorts it by name', () => {
    render();

    expect(specializationGet).toHaveBeenCalledWith({ Page: 1, PageSize: 200 });
    expect(component.rows()).toEqual([
      { id: FIRST_ID, name: 'Cardiology', status: 'Active' },
      { id: SECOND_ID, name: 'Neurology', status: 'Active' },
    ]);
    expect(text()).toContain('Cardiology');
  });

  it('shows the empty state when no specializations exist', () => {
    specializationGet.mockReturnValue(of(success([])));
    render();

    expect(component.rows()).toEqual([]);
    expect(component.isEmpty()).toBe(true);
    expect(text()).toContain('No specializations yet.');
  });

  it('shows a retryable error and reloads when Retry is activated', () => {
    specializationGet.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );
    render();

    expect(text()).toContain('Could not load the specializations.');
    expect(component.loadError()).not.toBeNull();

    specializationGet.mockReturnValue(
      of(success([{ id: FIRST_ID, name: 'Cardiology', status: 0 }])),
    );
    buttonByText('Retry')?.click();
    fixture.detectChanges();

    expect(specializationGet).toHaveBeenCalledTimes(2);
    expect(component.rows().length).toBe(1);
    expect(component.loadError()).toBeNull();
  });

  it('ignores an older response that arrives after a newer one', () => {
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();

    specializationGet.mockReset();
    specializationGet.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture.detectChanges();

    component.load();
    second.next(success([{ id: SECOND_ID, name: 'Neurology', status: 0 }]));
    first.next(success([{ id: FIRST_ID, name: 'Cardiology', status: 0 }]));

    expect(component.rows()).toEqual([{ id: SECOND_ID, name: 'Neurology', status: 'Active' }]);
  });

  it('navigates to the detail page when a row is activated', () => {
    render();

    component.onOpen(SECOND_ID);

    expect(navigate).toHaveBeenCalledWith(['/specializations', SECOND_ID]);
  });

  it('opens the create dialog and reloads the list after a successful creation', () => {
    render();
    open.mockReturnValue({ closed: of({ id: 'new-specialization' }) });

    component.onCreate();
    fixture.detectChanges();

    expect(open).toHaveBeenCalledWith(
      SpecializationCreateDialogComponent,
      expect.objectContaining({ disableClose: true, restoreFocus: true }),
    );
    expect(specializationGet).toHaveBeenCalledTimes(2);
  });

  it('does not reload the list when the create dialog is cancelled', () => {
    render();
    open.mockReturnValue({ closed: of(null) });

    component.onCreate();
    fixture.detectChanges();

    expect(open).toHaveBeenCalledOnce();
    expect(specializationGet).toHaveBeenCalledOnce();
  });

  it('updates the status optimistically with the numeric enum payload', () => {
    specializationIdStatusPatch.mockReturnValue(new Subject());
    render();

    component.onStatusChange({ id: FIRST_ID, status: 'Inactive' });

    expect(specializationIdStatusPatch).toHaveBeenCalledWith({
      id: FIRST_ID,
      body: { status: 1 },
    });
    expect(component.rows().find((row) => row.id === FIRST_ID)?.status).toBe('Inactive');
    expect(component.statusSavingId()).toBe(FIRST_ID);
  });

  it('confirms a successful status change and clears the in-flight guard', () => {
    specializationIdStatusPatch.mockReturnValue(of(undefined));
    render();

    component.onStatusChange({ id: FIRST_ID, status: 'Inactive' });

    expect(component.statusSavingId()).toBeNull();
    expect(showSuccess).toHaveBeenCalledWith('Specialization status updated successfully');
  });

  it('rolls the status back and reports an error when the change fails', () => {
    specializationIdStatusPatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );
    render();

    component.onStatusChange({ id: FIRST_ID, status: 'Inactive' });

    expect(component.rows().find((row) => row.id === FIRST_ID)?.status).toBe('Active');
    expect(component.statusSavingId()).toBeNull();
    expect(showError).toHaveBeenCalledOnce();
  });

  it('does not call the API when the selected status is already stored', () => {
    render();

    component.onStatusChange({ id: FIRST_ID, status: 'Active' });

    expect(specializationIdStatusPatch).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('ignores another status change while one is in flight', () => {
    specializationIdStatusPatch.mockReturnValue(new Subject());
    render();

    component.onStatusChange({ id: FIRST_ID, status: 'Inactive' });
    component.onStatusChange({ id: FIRST_ID, status: 'Active' });

    expect(specializationIdStatusPatch).toHaveBeenCalledOnce();
    expect(component.rows().find((row) => row.id === FIRST_ID)?.status).toBe('Inactive');
  });
});
