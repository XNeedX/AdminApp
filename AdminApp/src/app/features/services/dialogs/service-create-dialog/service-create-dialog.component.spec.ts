import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Subject, of, throwError } from 'rxjs';

import { ServiceService } from '../../../../api/generated/services/services/service.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CancelConfirmDialogComponent } from '../../../../shared/components/cancel-confirm-dialog/cancel-confirm-dialog.component';
import {
  CANCEL_CREATE_DIALOG_MESSAGE,
  ServiceCreateDialogComponent,
} from './service-create-dialog.component';
import { ServiceFormValue } from '../../models/service.model';

const SPECIALIZATION_ID = '11111111-1111-1111-1111-111111111111';

const VALUE: ServiceFormValue = {
  name: 'Blood test',
  price: 10,
  category: 'Analyses',
  status: 'Active',
};

describe('ServiceCreateDialogComponent', () => {
  let fixture: ComponentFixture<ServiceCreateDialogComponent>;
  let component: ServiceCreateDialogComponent;

  const servicePost = vi.fn();
  const close = vi.fn();
  const open = vi.fn();
  const showError = vi.fn();

  beforeEach(async () => {
    servicePost.mockReset();
    close.mockReset();
    open.mockReset();
    showError.mockReset();

    await TestBed.configureTestingModule({
      imports: [ServiceCreateDialogComponent],
      providers: [
        { provide: ServiceService, useValue: { servicePost } },
        { provide: DialogRef, useValue: { close } },
        { provide: DIALOG_DATA, useValue: { specializationId: SPECIALIZATION_ID } },
        { provide: Dialog, useValue: { open } },
        { provide: NotificationService, useValue: { showError, showSuccess: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the service and closes the dialog with its id', () => {
    servicePost.mockReturnValue(of({ isSuccess: true, data: 'new-service-id' }));

    component.onSubmit(VALUE);

    expect(servicePost).toHaveBeenCalledWith({
      body: {
        name: 'Blood test',
        price: 10,
        category: 0,
        status: 0,
        specializationId: SPECIALIZATION_ID,
      },
    });
    expect(close).toHaveBeenCalledWith({ id: 'new-service-id' });
  });

  it('keeps the dialog open and reports the error when creation fails', () => {
    servicePost.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { message: 'Please, enter the name' } })
      )
    );

    component.onSubmit(VALUE);

    expect(close).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('Please, enter the name');
    expect(component.submitting()).toBe(false);
  });

  it('reports a missing id instead of closing with an invalid result', () => {
    servicePost.mockReturnValue(of({ isSuccess: true }));

    component.onSubmit(VALUE);

    expect(close).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledOnce();
  });

  it('ignores a second submit while the request is in flight', () => {
    servicePost.mockReturnValue(new Subject());

    component.onSubmit(VALUE);
    component.onSubmit(VALUE);

    expect(servicePost).toHaveBeenCalledOnce();
  });

  it('opens the cancel confirmation and closes with null on Yes', () => {
    open.mockReturnValue({ closed: of(true) });

    component.onCancel();

    expect(open).toHaveBeenCalledWith(
      CancelConfirmDialogComponent,
      expect.objectContaining({
        data: { message: CANCEL_CREATE_DIALOG_MESSAGE },
        disableClose: true,
      })
    );
    expect(close).toHaveBeenCalledWith(null);
  });

  it('stays open when the user declines the cancellation', () => {
    open.mockReturnValue({ closed: of(false) });

    component.onCancel();

    expect(close).not.toHaveBeenCalled();
  });
});
