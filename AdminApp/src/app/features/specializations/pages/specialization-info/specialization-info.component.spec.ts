import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Subject, of, throwError } from 'rxjs';

import { SpecializationService } from '../../../../api/generated/services/services/specialization.service';
import { ViewSpecializationDto } from '../../../../api/generated/services/models/view-specialization-dto';
import { NotificationService } from '../../../../core/services/notification.service';
import { CancelConfirmDialogComponent } from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { SpecializationFormComponent } from '../../components/specialization-form/specialization-form.component';
import { SpecializationFormValue } from '../../models/specialization.model';
import { SpecializationWriterService } from '../../services/specialization-writer.service';
import {
  CANCEL_EDIT_DIALOG_MESSAGE,
  SpecializationInfoComponent,
} from './specialization-info.component';

const SPECIALIZATION_ID = '11111111-1111-1111-1111-111111111111';
const SERVICE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function specializationDto(overrides: Partial<ViewSpecializationDto> = {}): ViewSpecializationDto {
  return {
    id: SPECIALIZATION_ID,
    name: 'Cardiology',
    status: 0,
    services: [{ id: SERVICE_ID, name: 'Blood test', price: 12.34, category: 0, status: 0 }],
    ...overrides,
  };
}

function formValue(overrides: Partial<SpecializationFormValue> = {}): SpecializationFormValue {
  return {
    name: 'Cardiology',
    status: 'Active',
    services: [
      {
        key: 'key-1',
        id: SERVICE_ID,
        name: 'Blood test',
        price: 12.34,
        status: 'Active',
        category: 'Analyses',
      },
    ],
    ...overrides,
  };
}

describe('SpecializationInfoComponent', () => {
  let fixture: ComponentFixture<SpecializationInfoComponent>;
  let component: SpecializationInfoComponent;

  const specializationIdGet = vi.fn();
  const specializationIdStatusPatch = vi.fn();
  const update = vi.fn();
  const create = vi.fn();
  const open = vi.fn();
  const navigate = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  beforeEach(async () => {
    specializationIdGet.mockReset();
    specializationIdStatusPatch.mockReset();
    update.mockReset();
    create.mockReset();
    open.mockReset();
    navigate.mockReset();
    showSuccess.mockReset();
    showError.mockReset();

    await TestBed.configureTestingModule({
      imports: [SpecializationInfoComponent],
      providers: [
        {
          provide: SpecializationService,
          useValue: { specializationIdGet, specializationIdStatusPatch },
        },
        { provide: SpecializationWriterService, useValue: { create, update } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: SPECIALIZATION_ID }) },
          },
        },
        { provide: Router, useValue: { navigate } },
        { provide: Dialog, useValue: { open } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpecializationInfoComponent);
    component = fixture.componentInstance;
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().textContent ?? '';
  }

  function render(dto: ViewSpecializationDto = specializationDto()): void {
    specializationIdGet.mockReturnValue(of({ isSuccess: true, data: dto }));
    fixture.detectChanges();
    fixture.detectChanges();
  }

  function buttonByText(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === label,
    );
  }

  function form(): SpecializationFormComponent {
    return fixture.debugElement.query(By.directive(SpecializationFormComponent))
      .componentInstance as SpecializationFormComponent;
  }

  function submitButton(): HTMLButtonElement {
    return host().querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  function statusRadio(value: 'Active' | 'Inactive'): HTMLInputElement {
    const radios = Array.from(host().querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
    const radio = radios.find((input) => input.closest('label')?.textContent?.trim() === value);

    if (radio === undefined) {
      throw new Error(`Status radio "${value}" was not rendered.`);
    }

    return radio;
  }

  it('loads the specialization by route id and renders its services', () => {
    render();

    expect(specializationIdGet).toHaveBeenCalledWith({ id: SPECIALIZATION_ID });
    expect(component.specialization()).toEqual({
      id: SPECIALIZATION_ID,
      name: 'Cardiology',
      status: 'Active',
      services: [
        {
          id: SERVICE_ID,
          name: 'Blood test',
          price: 12.34,
          status: 'Active',
          category: 'Analyses',
        },
      ],
    });
    expect(text()).toContain('Cardiology');
    expect(text()).toContain('Blood test');
    expect(text()).toContain('12.34');
    expect(text()).toContain('Analyses');
    expect(text()).toContain('Active');
  });

  it('renders Inactive services instead of hiding them', () => {
    render(
      specializationDto({
        services: [{ id: SERVICE_ID, name: 'Old test', price: 5, category: 2, status: 1 }],
      }),
    );

    expect(text()).toContain('Old test');
    expect(text()).toContain('Inactive');
  });

  it('shows the empty-services message', () => {
    render(specializationDto({ services: [] }));

    expect(text()).toContain('This specialization has no services yet.');
    expect(component.specialization()?.services).toEqual([]);
  });

  it('starts in View mode without editable text controls', () => {
    render();

    expect(component.isEditMode()).toBe(false);
    expect(buttonByText('Edit')).toBeDefined();
    expect(host().querySelectorAll('input:not([type="radio"]), select, textarea').length).toBe(0);
  });

  it('shows "Specialization not found." for a 404 and retries on demand', () => {
    specializationIdGet.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(text()).toContain('Specialization not found.');

    specializationIdGet.mockReturnValue(of({ isSuccess: true, data: specializationDto() }));
    buttonByText('Retry')?.click();
    fixture.detectChanges();

    expect(specializationIdGet).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Cardiology');
  });

  it('offers a Retry action for other load failures', () => {
    specializationIdGet.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.loadError()).not.toBeNull();
    expect(buttonByText('Retry')).toBeDefined();
  });

  it('switches to Edit mode with a pre-filled form and the edit footer', () => {
    render();

    component.enterEdit();
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(form().form.getRawValue()).toEqual({
      name: 'Cardiology',
      status: 'Active',
      services: [
        {
          key: expect.any(String),
          id: SERVICE_ID,
          name: 'Blood test',
          price: 12.34,
          status: 'Active',
          category: 'Analyses',
        },
      ],
    });
    expect(submitButton().textContent?.trim()).toBe('Save changes');
    expect(text()).toContain('Cancel');
    expect(text()).not.toContain('This specialization has no services yet.');
  });

  it('disables "Save changes" while the name is invalid', () => {
    render();
    component.enterEdit();
    fixture.detectChanges();

    form().form.controls.name.setValue('');
    form().form.controls.name.markAsTouched();
    fixture.detectChanges();

    expect(submitButton().disabled).toBe(true);
    expect(text()).toContain('Please, enter the name');
  });

  it('saves the changes, returns to View mode and refreshes the stored record', () => {
    const value = formValue({ name: 'MRI', status: 'Inactive' });

    render();
    update.mockReturnValue(of({ specializationId: SPECIALIZATION_ID, createdServiceIds: [] }));
    component.enterEdit();
    fixture.detectChanges();

    specializationIdGet.mockReturnValue(
      of({ isSuccess: true, data: specializationDto({ name: 'MRI', status: 1 }) }),
    );

    component.onSubmitted(value);
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith(SPECIALIZATION_ID, value, {
      specializationId: SPECIALIZATION_ID,
      createdServiceIds: [],
    });
    expect(component.isEditMode()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(showSuccess).toHaveBeenCalledWith('Specialization updated successfully');
    expect(specializationIdGet).toHaveBeenCalledTimes(2);
    expect(text()).toContain('MRI');
  });

  it('keeps Edit mode and the entered values when saving fails', () => {
    render();
    update.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );
    component.enterEdit();
    fixture.detectChanges();

    form().form.controls.name.setValue('MRI');

    component.onSubmitted(formValue({ name: 'MRI' }));
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(true);
    expect(component.isSaving()).toBe(false);
    expect(form().form.controls.name.value).toBe('MRI');
    expect(showError).toHaveBeenCalledOnce();
  });

  it('applies one update when Save is activated twice in a row', () => {
    const value = formValue();

    render();
    update.mockReturnValue(new Subject());
    component.enterEdit();
    fixture.detectChanges();

    component.onSubmitted(value);
    component.onSubmitted(value);

    expect(update).toHaveBeenCalledOnce();
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
    expect(form().form.controls.name.value).toBe('Changed name');
    expect(update).not.toHaveBeenCalled();
  });

  it('discards the edits and returns to the stored values when the user confirms', () => {
    render();
    open.mockReturnValue({ closed: of(true) });
    component.enterEdit();
    fixture.detectChanges();

    form().form.controls.name.setValue('Changed name');
    component.onCancelled();
    fixture.detectChanges();

    expect(component.isEditMode()).toBe(false);
    expect(component.specialization()?.name).toBe('Cardiology');
    expect(text()).toContain('Cardiology');
    expect(update).not.toHaveBeenCalled();
  });

  it('opens the edit cancellation dialog with the exact message', () => {
    render();
    open.mockReturnValue({ closed: of(false) });
    component.enterEdit();
    fixture.detectChanges();

    component.onCancelled();

    expect(open).toHaveBeenCalledWith(
      CancelConfirmDialogComponent,
      expect.objectContaining({
        data: { message: CANCEL_EDIT_DIALOG_MESSAGE },
        disableClose: true,
      }),
    );
  });

  it('sends the status change immediately in View mode', () => {
    render();
    specializationIdStatusPatch.mockReturnValue(of(undefined));

    statusRadio('Inactive').click();
    fixture.detectChanges();

    expect(specializationIdStatusPatch).toHaveBeenCalledWith({
      id: SPECIALIZATION_ID,
      body: { status: 1 },
    });
    expect(component.specialization()?.status).toBe('Inactive');
    expect(component.statusSaving()).toBe(false);
    expect(showSuccess).toHaveBeenCalledWith('Specialization status updated successfully');
  });

  it('reflects the new status optimistically and disables the control while saving', () => {
    render();
    specializationIdStatusPatch.mockReturnValue(new Subject());

    statusRadio('Inactive').click();
    fixture.detectChanges();

    expect(component.specialization()?.status).toBe('Inactive');
    expect(component.statusSaving()).toBe(true);
    expect(component.statusControl.disabled).toBe(true);
    expect(statusRadio('Inactive').checked).toBe(true);
  });

  it('rolls the status back and reports an error when the change fails', () => {
    render();
    specializationIdStatusPatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
    );

    statusRadio('Inactive').click();
    fixture.detectChanges();

    expect(component.specialization()?.status).toBe('Active');
    expect(component.statusSaving()).toBe(false);
    expect(component.statusControl.value).toBe('Active');
    expect(statusRadio('Active').checked).toBe(true);
    expect(showError).toHaveBeenCalledOnce();
  });

  it('does not call the API when the selected status is already stored', () => {
    render();

    statusRadio('Active').click();
    fixture.detectChanges();

    expect(specializationIdStatusPatch).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('does not send a status patch while in Edit mode', () => {
    render();
    component.enterEdit();
    fixture.detectChanges();

    component.statusControl.setValue('Inactive');
    fixture.detectChanges();

    expect(specializationIdStatusPatch).not.toHaveBeenCalled();
  });

  it('persists a staged Edit-mode status only through "Save changes"', () => {
    render();
    update.mockReturnValue(of({ specializationId: SPECIALIZATION_ID, createdServiceIds: [] }));
    component.enterEdit();
    fixture.detectChanges();

    form().form.controls.status.setValue('Inactive');
    fixture.detectChanges();

    expect(specializationIdStatusPatch).not.toHaveBeenCalled();

    const value = formValue({ status: 'Inactive' });
    component.onSubmitted(value);

    expect(update).toHaveBeenCalledWith(SPECIALIZATION_ID, value, {
      specializationId: SPECIALIZATION_ID,
      createdServiceIds: [],
    });
    expect(specializationIdStatusPatch).not.toHaveBeenCalled();
  });

  it('navigates back to the list', () => {
    render();

    component.goBack();

    expect(navigate).toHaveBeenCalledWith(['/specializations']);
  });
});
