import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Subject, of, throwError } from 'rxjs';

import { NotificationService } from '../../../../core/services/notification.service';
import { CancelConfirmDialogComponent } from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import { SpecializationFormComponent } from '../../components/specialization-form/specialization-form.component';
import {
  SpecializationFormValue,
  SpecializationServiceFormValue,
} from '../../models/specialization.model';
import {
  SpecializationWriteError,
  SpecializationWriterService,
} from '../../services/specialization-writer.service';
import {
  CANCEL_CREATE_DIALOG_MESSAGE,
  SpecializationCreateDialogComponent,
} from './specialization-create-dialog.component';

function serviceRow(): SpecializationServiceFormValue {
  return {
    key: 'key-1',
    id: null,
    name: 'Blood test',
    price: 10,
    status: 'Active',
    category: 'Analyses',
  };
}

const VALUE: SpecializationFormValue = {
  name: 'Cardiology',
  status: 'Active',
  services: [serviceRow()],
};

describe('SpecializationCreateDialogComponent', () => {
  let fixture: ComponentFixture<SpecializationCreateDialogComponent>;
  let component: SpecializationCreateDialogComponent;

  const create = vi.fn();
  const update = vi.fn();
  const close = vi.fn();
  const open = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  beforeEach(async () => {
    create.mockReset();
    update.mockReset();
    close.mockReset();
    open.mockReset();
    showSuccess.mockReset();
    showError.mockReset();

    await TestBed.configureTestingModule({
      imports: [SpecializationCreateDialogComponent],
      providers: [
        { provide: SpecializationWriterService, useValue: { create, update } },
        { provide: DialogRef, useValue: { close } },
        { provide: DIALOG_DATA, useValue: {} },
        { provide: Dialog, useValue: { open } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpecializationCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function form(): SpecializationFormComponent {
    return fixture.debugElement.query(By.directive(SpecializationFormComponent))
      .componentInstance as SpecializationFormComponent;
  }

  function submitButton(): HTMLButtonElement {
    return host().querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  function fillValidForm(): void {
    const formComponent = form();

    formComponent.form.controls.name.setValue('Cardiology');
    formComponent.addService();

    const row = formComponent.form.controls.services.at(0);
    row.controls.name.setValue('Blood test');
    row.controls.price.setValue(10);
    row.controls.category.setValue('Analyses');
    fixture.detectChanges();
  }

  it('renders the dialog title and disables Confirm until the form is valid', () => {
    expect(host().textContent).toContain('Create specialization');
    expect(submitButton().disabled).toBe(true);

    fillValidForm();

    expect(submitButton().disabled).toBe(false);
  });

  it('creates the specialization once and closes with its id on success', () => {
    create.mockReturnValue(
      of({ specializationId: 'new-specialization-id', createdServiceIds: ['key-1'] }),
    );

    component.onSubmit(VALUE);

    expect(create).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith({ id: 'new-specialization-id' });
    expect(showSuccess).toHaveBeenCalledWith('Specialization created successfully');
    expect(component.submitting()).toBe(false);
  });

  it('ignores a second activation while the request is in flight', () => {
    create.mockReturnValue(new Subject());

    component.onSubmit(VALUE);
    component.onSubmit(VALUE);

    expect(create).toHaveBeenCalledOnce();
  });

  it('keeps the dialog and the entered values open when creation fails', () => {
    create.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { message: 'Please, enter the name' } }),
      ),
    );
    fillValidForm();

    form().onSubmit();
    fixture.detectChanges();

    expect(close).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('Please, enter the name');
    expect(component.submitting()).toBe(false);
    expect(form().form.controls.name.value).toBe('Cardiology');
    expect(form().form.controls.services.length).toBe(1);

    create.mockReturnValue(
      of({ specializationId: 'new-specialization-id', createdServiceIds: ['key-1'] }),
    );
    form().onSubmit();

    expect(close).toHaveBeenCalledWith({ id: 'new-specialization-id' });
  });

  it('shows the partial-failure notice when the specialization already exists', () => {
    create.mockReturnValue(
      throwError(
        () =>
          new SpecializationWriteError(
            new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
            { specializationId: 'new-specialization-id', createdServiceIds: [] },
          ),
      ),
    );

    component.onSubmit(VALUE);
    fixture.detectChanges();

    expect(close).not.toHaveBeenCalled();
    expect(component.partialNotice()).not.toBeNull();
    expect(host().textContent).toContain('some services could not be');
  });

  it('opens the cancellation dialog with the exact message and stays open on No', () => {
    open.mockReturnValue({ closed: of(false) });

    component.onCancel();

    expect(open).toHaveBeenCalledWith(
      CancelConfirmDialogComponent,
      expect.objectContaining({
        data: { message: CANCEL_CREATE_DIALOG_MESSAGE },
        disableClose: true,
      }),
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('closes with null when the user confirms the cancellation', () => {
    open.mockReturnValue({ closed: of(true) });

    component.onCancel();

    expect(close).toHaveBeenCalledWith(null);
  });
});
