import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { of, Subject, throwError } from 'rxjs';

import { SpecializationService } from '../../../../api/generated/services/services/specialization.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ServiceCreateDialogComponent } from '../../dialogs/service-create-dialog/service-create-dialog.component';
import { ServicesPageComponent } from './services-page.component';
import { ViewSpecializationListDto } from '../../../../api/generated/services/models/view-specialization-list-dto';
import { ViewSpecializationDto } from '../../../../api/generated/services/models/view-specialization-dto';

const FIRST_ID = '11111111-1111-1111-1111-111111111111';
const SECOND_ID = '22222222-2222-2222-2222-222222222222';
const SERVICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function specializationList(): ViewSpecializationListDto[] {
  return [
    { id: FIRST_ID, name: 'Cardiology', status: 0 },
    { id: SECOND_ID, name: 'Neurology', status: 0 },
  ];
}

function specializationDetail(id: string, name: string): ViewSpecializationDto {
  return {
    id,
    name,
    status: 0,
    services: [
      { id: SERVICE_ID, name: 'Blood test', price: 12.34, category: 0, status: 0 },
    ],
  };
}

describe('ServicesPageComponent', () => {
  let fixture: ComponentFixture<ServicesPageComponent>;
  let component: ServicesPageComponent;

  const specializationGet = vi.fn();
  const specializationIdGet = vi.fn();
  const open = vi.fn();
  const navigate = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  beforeEach(async () => {
    specializationGet.mockReset();
    specializationIdGet.mockReset();
    open.mockReset();
    navigate.mockReset();
    showSuccess.mockReset();
    showError.mockReset();

    specializationGet.mockReturnValue(
      of({ isSuccess: true, data: { items: specializationList(), totalCount: 2 } })
    );
    specializationIdGet.mockImplementation(({ id }: { id: string }) =>
      of({
        isSuccess: true,
        data: specializationDetail(id, id === FIRST_ID ? 'Cardiology' : 'Neurology'),
      })
    );

    await TestBed.configureTestingModule({
      imports: [ServicesPageComponent],
      providers: [
        { provide: SpecializationService, useValue: { specializationGet, specializationIdGet } },
        { provide: Dialog, useValue: { open } },
        { provide: Router, useValue: { navigate } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicesPageComponent);
    component = fixture.componentInstance;
  });

  function render(): void {
    fixture.detectChanges();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('loads the specializations, auto-selects the first one and lists its services', () => {
    render();

    expect(specializationGet).toHaveBeenCalledWith({ Page: 1, PageSize: 50 });
    expect(component.specializations()).toEqual([
      { id: FIRST_ID, name: 'Cardiology' },
      { id: SECOND_ID, name: 'Neurology' },
    ]);
    expect(component.selectedSpecializationId()).toBe(FIRST_ID);
    expect(specializationIdGet).toHaveBeenCalledWith({ id: FIRST_ID });
    expect(component.rows()).toEqual([
      {
        id: SERVICE_ID,
        name: 'Blood test',
        price: 12.34,
        category: 'Analyses',
        status: 'Active',
      },
    ]);
    expect(text()).toContain('Blood test');
    expect(text()).toContain('Analyses');
    expect(text()).toContain('12.34');
    expect(text()).toContain('Active');
  });

  it('shows the error state and retries when the specializations request fails', () => {
    specializationGet.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' }))
    );
    render();

    expect(text()).toContain('Could not load the specializations.');

    specializationGet.mockReturnValue(
      of({ isSuccess: true, data: { items: specializationList(), totalCount: 2 } })
    );
    component.retry();
    fixture.detectChanges();

    expect(specializationGet).toHaveBeenCalledTimes(2);
    expect(component.specializations().length).toBe(2);
  });

  it('switches the list when another specialization is selected', () => {
    render();

    component.selectSpecialization(SECOND_ID);
    fixture.detectChanges();

    expect(specializationIdGet).toHaveBeenLastCalledWith({ id: SECOND_ID });
    expect(component.selectedSpecializationName()).toBe('Neurology');
  });

  it('shows an empty state when the specialization has no services', () => {
    specializationIdGet.mockReturnValue(
      of({ isSuccess: true, data: { id: FIRST_ID, name: 'Cardiology', status: 0, services: [] } })
    );
    render();

    expect(component.rows()).toEqual([]);
    expect(text()).toContain('No services for this specialization yet.');
  });

  it('shows the services error state and retries the selected specialization', () => {
    specializationIdGet.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' }))
    );
    render();

    expect(text()).toContain('Could not load the services.');

    specializationIdGet.mockImplementation(({ id }: { id: string }) =>
      of({ isSuccess: true, data: specializationDetail(id, 'Cardiology') })
    );
    component.reloadServices();
    fixture.detectChanges();

    expect(specializationIdGet).toHaveBeenCalledTimes(2);
    expect(component.rows().length).toBe(1);
  });

  it('reports an incomplete payload instead of rendering partial rows', () => {
    specializationIdGet.mockReturnValue(
      of({
        isSuccess: true,
        data: {
          id: FIRST_ID,
          name: 'Cardiology',
          status: 0,
          services: [{ name: 'Missing id' }],
        },
      })
    );
    render();

    expect(text()).toContain('The service data returned by the API is incomplete.');
    expect(component.rows()).toEqual([]);
  });

  it('opens the create dialog for the selected specialization and reloads after creation', () => {
    render();
    open.mockReturnValue({ closed: of({ id: 'new-service' }) });

    component.openCreate();
    fixture.detectChanges();

    expect(open).toHaveBeenCalledWith(
      ServiceCreateDialogComponent,
      expect.objectContaining({ data: { specializationId: FIRST_ID } })
    );
    expect(showSuccess).toHaveBeenCalledWith('Service created successfully');
    expect(specializationIdGet).toHaveBeenCalledTimes(2);
  });

  it('does not open the create dialog without a selected specialization', () => {
    component.openCreate();

    expect(open).not.toHaveBeenCalled();
  });

  it('navigates to the service information page', () => {
    render();

    component.openService(SERVICE_ID);

    expect(navigate).toHaveBeenCalledWith(['/services', SERVICE_ID]);
  });

  it('disables the Add service button until a specialization is loaded', () => {
    const pending = new Subject<unknown>();
    specializationGet.mockReturnValue(pending);
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button'
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(true);

    pending.next({ isSuccess: true, data: { items: specializationList(), totalCount: 2 } });
    pending.complete();
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
  });
});
