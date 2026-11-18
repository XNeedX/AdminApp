import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Subject, of, throwError } from 'rxjs';

import { ServiceService } from '../../../../api/generated/services/services/service.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ServiceInfoComponent } from './service-info.component';
import { ServiceFormComponent } from '../../components/service-form/service-form.component';
import { ViewServiceDto } from '../../../../api/generated/services/models/view-service-dto';

const SERVICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SPECIALIZATION_ID = '11111111-1111-1111-1111-111111111111';

function serviceDto(overrides: Partial<ViewServiceDto> = {}): ViewServiceDto {
  return {
    id: SERVICE_ID,
    name: 'Blood test',
    price: 12.34,
    category: 0,
    status: 0,
    specializationId: SPECIALIZATION_ID,
    ...overrides,
  };
}

describe('ServiceInfoComponent', () => {
  let fixture: ComponentFixture<ServiceInfoComponent>;
  let component: ServiceInfoComponent;

  const serviceIdGet = vi.fn();
  const serviceIdPut = vi.fn();
  const serviceIdStatusPatch = vi.fn();
  const open = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  beforeEach(async () => {
    serviceIdGet.mockReset();
    serviceIdPut.mockReset();
    serviceIdStatusPatch.mockReset();
    open.mockReset();
    showSuccess.mockReset();
    showError.mockReset();

    await TestBed.configureTestingModule({
      imports: [ServiceInfoComponent],
      providers: [
        { provide: ServiceService, useValue: { serviceIdGet, serviceIdPut, serviceIdStatusPatch } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: SERVICE_ID }) } },
        },
        { provide: Dialog, useValue: { open } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceInfoComponent);
    component = fixture.componentInstance;
  });

  function render(dto: ViewServiceDto = serviceDto()): void {
    serviceIdGet.mockReturnValue(of({ isSuccess: true, data: dto }));
    fixture.detectChanges();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('loads the service and renders name, price, category and status read-only', () => {
    render();

    expect(serviceIdGet).toHaveBeenCalledWith({ id: SERVICE_ID });
    expect(component.service()).toEqual({
      id: SERVICE_ID,
      name: 'Blood test',
      price: 12.34,
      category: 'Analyses',
      status: 'Active',
      specializationId: SPECIALIZATION_ID,
    });
    expect(text()).toContain('Blood test');
    expect(text()).toContain('12.34');
    expect(text()).toContain('Analyses');
    expect(text()).toContain('Active');
  });

  it('shows the Edit button in View mode', () => {
    render();

    const editButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((button) => button.textContent?.trim() === 'Edit');

    expect(editButton).toBeDefined();
    expect(component.isEditMode()).toBe(false);
  });

  it('keeps the text fields non-editable in View mode', () => {
    render();

    expect(
      fixture.nativeElement.querySelectorAll('input:not([type="radio"]), select, textarea').length
    ).toBe(0);
  });

  it('shows an Inactive service instead of hiding it', () => {
    render(serviceDto({ status: 1 }));

    expect(text()).toContain('Inactive');
    expect(component.service()?.status).toBe('Inactive');
  });

  it('shows "Service not found." for a 404 and retries on demand', () => {
    serviceIdGet.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }))
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(text()).toContain('Service not found.');

    const retry = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((button) => button.textContent?.trim() === 'Retry');

    retry?.click();
    fixture.detectChanges();

    expect(serviceIdGet).toHaveBeenCalledTimes(2);
  });

  function form(): ServiceFormComponent {
    const debugElement = fixture.debugElement.query(By.directive(ServiceFormComponent));
    return debugElement.componentInstance as ServiceFormComponent;
  }

  function submitButton(): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button[type="submit"]')
    )[0] as HTMLButtonElement | undefined;
  }

  it('switches to Edit mode with a pre-filled form and the edit footer', () => {
    render();

    component.enterEdit();
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(form().form.getRawValue()).toEqual({
      name: 'Blood test',
      price: 12.34,
      category: 'Analyses',
      status: 'Active',
    });
    expect(submitButton()?.textContent?.trim()).toBe('Save changes');
    expect(text()).toContain('Cancel');
  });

  it('disables "Save changes" while a field is invalid', () => {
    render();
    component.enterEdit();
    fixture.detectChanges();

    form().form.controls.name.setValue('');
    form().form.controls.name.markAsTouched();
    fixture.detectChanges();

    expect(submitButton()?.disabled).toBe(true);
    expect(text()).toContain('Please, enter the name');
  });

  it('saves the changes and returns to View mode without reloading', () => {
    render();
    serviceIdPut.mockReturnValue(of(undefined));
    component.enterEdit();
    fixture.detectChanges();

    component.onSubmitted({
      name: 'MRI',
      price: 99.99,
      category: 'Diagnostics',
      status: 'Inactive',
    });
    fixture.detectChanges();

    expect(serviceIdPut).toHaveBeenCalledWith({
      id: SERVICE_ID,
      body: { name: 'MRI', price: 99.99, category: 2, status: 1 },
    });
    expect(component.isEditMode()).toBe(false);
    expect(component.service()?.name).toBe('MRI');
    expect(component.service()?.category).toBe('Diagnostics');
    expect(serviceIdGet).toHaveBeenCalledOnce();
    expect(showSuccess).toHaveBeenCalledOnce();
    expect(text()).toContain('MRI');
    expect(text()).toContain('Diagnostics');
  });

  it('keeps Edit mode and the entered values when saving fails', () => {
    render();
    serviceIdPut.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })
      )
    );
    component.enterEdit();
    fixture.detectChanges();

    form().form.patchValue({
      name: 'MRI',
      price: 99.99,
      category: 'Diagnostics',
      status: 'Active',
    });

    component.onSubmitted({
      name: 'MRI',
      price: 99.99,
      category: 'Diagnostics',
      status: 'Active',
    });
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(form().form.getRawValue().name).toBe('MRI');
    expect(showError).toHaveBeenCalledOnce();

    serviceIdPut.mockReturnValue(of(undefined));
    component.onSubmitted({
      name: 'MRI',
      price: 99.99,
      category: 'Diagnostics',
      status: 'Active',
    });

    expect(component.isEditMode()).toBe(false);
  });

  it('keeps the edits when the user declines the cancellation', () => {
    render();
    open.mockReturnValue({ closed: of(false) });
    component.enterEdit();
    fixture.detectChanges();

    form().form.controls.name.setValue('Changed name');
    component.onCancelled();
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(form().form.getRawValue().name).toBe('Changed name');
    expect(serviceIdPut).not.toHaveBeenCalled();
  });

  it('discards the edits and returns to View mode when the user confirms', () => {
    render();
    open.mockReturnValue({ closed: of(true) });
    component.enterEdit();
    fixture.detectChanges();

    form().form.controls.name.setValue('Changed name');
    component.onCancelled();
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(false);
    expect(component.service()?.name).toBe('Blood test');
    expect(serviceIdPut).not.toHaveBeenCalled();
    expect(text()).toContain('Blood test');
  });

  it('opens the edit cancellation dialog with the exact message', () => {
    render();
    open.mockReturnValue({ closed: of(false) });
    component.enterEdit();
    fixture.detectChanges();

    component.onCancelled();

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: { message: 'Do you really want to cancel? Changes will not be saved.' },
        disableClose: true,
      })
    );
  });

  it('ignores a second save while the request is in flight', () => {
    render();
    serviceIdPut.mockReturnValue(new Subject());
    component.enterEdit();
    fixture.detectChanges();

    const value = { name: 'MRI', price: 10, category: 'Analyses', status: 'Active' } as const;
    component.onSubmitted(value);
    component.onSubmitted(value);

    expect(serviceIdPut).toHaveBeenCalledOnce();
  });

  it('saves successfully when nothing changed', () => {
    render();
    serviceIdPut.mockReturnValue(of(undefined));
    component.enterEdit();
    fixture.detectChanges();

    component.onSubmitted({
      name: 'Blood test',
      price: 12.34,
      category: 'Analyses',
      status: 'Active',
    });

    expect(serviceIdPut).toHaveBeenCalledOnce();
    expect(component.isEditMode()).toBe(false);
  });

  function statusRadio(value: 'Active' | 'Inactive'): HTMLInputElement {
    const radios = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('input[type="radio"]')
    ) as HTMLInputElement[];
    // `RadioControlValueAccessor` consumes `[value]`, so the DOM value stays "on";
    // the visible label is the reliable way to identify the option.
    const radio = radios.find(
      (input) => input.closest('label')?.textContent?.trim() === value
    );

    if (radio === undefined) {
      throw new Error(`Status radio "${value}" was not rendered. Found ${radios.length} radios.`);
    }

    return radio;
  }

  it('sends the status change immediately with the mapped numeric value', () => {
    render();
    serviceIdStatusPatch.mockReturnValue(of(undefined));

    component.changeStatus('Inactive');

    expect(serviceIdStatusPatch).toHaveBeenCalledWith({
      id: SERVICE_ID,
      body: { status: 1 },
    });
    expect(showSuccess).toHaveBeenCalledOnce();
  });

  it('reflects the new status optimistically before the response arrives', () => {
    render();
    serviceIdStatusPatch.mockReturnValue(new Subject());
    fixture.detectChanges();

    statusRadio('Inactive').click();
    fixture.detectChanges();

    expect(component.service()?.status).toBe('Inactive');
    expect(component.statusSaving()).toBe(true);
    expect(statusRadio('Inactive').checked).toBe(true);
  });

  it('restores the previous status and reports an error when the change fails', () => {
    render();
    serviceIdStatusPatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' }))
    );
    fixture.detectChanges();

    statusRadio('Inactive').click();
    fixture.detectChanges();

    expect(component.service()?.status).toBe('Active');
    expect(component.statusSaving()).toBe(false);
    expect(showError).toHaveBeenCalledOnce();
    expect(statusRadio('Active').checked).toBe(true);
  });

  it('ignores selecting the status that is already set', () => {
    render();
    fixture.detectChanges();

    statusRadio('Active').click();
    fixture.detectChanges();

    expect(serviceIdStatusPatch).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('ignores a status change while another one is in flight', () => {
    render();
    serviceIdStatusPatch.mockReturnValue(new Subject());
    fixture.detectChanges();

    component.changeStatus('Inactive');
    component.changeStatus('Active');

    expect(serviceIdStatusPatch).toHaveBeenCalledOnce();
    expect(component.service()?.status).toBe('Inactive');
  });

  it('shows the new status after a successful change without reloading', () => {
    render();
    serviceIdStatusPatch.mockReturnValue(of(undefined));
    fixture.detectChanges();

    statusRadio('Inactive').click();
    fixture.detectChanges();

    expect(serviceIdStatusPatch).toHaveBeenCalledOnce();
    expect(statusRadio('Inactive').checked).toBe(true);
    expect(serviceIdGet).toHaveBeenCalledOnce();
    expect(component.service()?.status).toBe('Inactive');
  });
});
